package ru.club404.guest.data

import android.graphics.Bitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Реализация [GuestRepository] поверх реального backend API (Fastify+Prisma,
 * см. src/ в корне этого репозитория — задеплоен на 92.242.60.149:3000).
 *
 * Без Retrofit/OkHttp намеренно: CI для android/ уже борется с недоступностью
 * dl.google.com в среде разработки (см. android/README.md) — заводить ещё
 * одну Gradle-зависимость и надеяться, что её резолвинг тоже не упрётся в
 * сетевые ограничения, того не стоило. HttpURLConnection + org.json — то,
 * что уже есть в самом Android SDK, без единой новой зависимости.
 *
 * Явно НЕ покрыто реальным backend (см. AskUserQuestion в истории сессии):
 * - faq / promotions / support-чат и тикеты — backend для этого не существует
 *   вообще (даже frontend/js/offers.js бьёт по несуществующим ручкам), оставлены
 *   как статический контент/локальная заглушка, один в один с MockGuestRepository;
 * - redeemCode — по архитектуре это действие ПК-станции (device-токен), не
 *   гостя с телефона, см. комментарий в GuestRepository.kt;
 * - "мой текущий уровень лояльности" (loyaltyTierId у Guest) — backend отдаёт
 *   только discountPercent/cashbackPercent по formula, не id конкретного тира
 *   (см. LoyaltyService.getEffectiveLoyalty) — оставлено null;
 * - bonusRubToRedeem в createBooking — реальный POST /api/bookings пока
 *   списывает только MONEY-баланс, смешивания с бонусами нет.
 *
 * Известное упрощение архитектуры: zones/stations/loyaltyTiers — обычные
 * `val`, а не Flow (так задан интерфейс, под BookingViewModel, которая читает
 * их синхронно один раз при создании) — поэтому они заполняются один раз,
 * до присвоения репозитория в Club404App, через suspend [initialize].
 */
class RemoteGuestRepository(private val baseUrl: String) : GuestRepository {

    private class ApiException(message: String) : Exception(message)

    @Volatile private var guestToken: String? = null
    @Volatile private var cachedSessionId: String? = null
    @Volatile private var cachedEntryAccess: EntryAccess? = null

    override lateinit var stations: List<Station>
        private set
    override lateinit var zones: List<Zone>
        private set
    override lateinit var loyaltyTiers: List<LoyaltyTier>
        private set

    // См. класс-комментарий — реального аналога нет, MockGuestRepository тоже
    // не тянет тарифы отдельным списком нигде, кроме как через station.tariffId,
    // а у Remote-станций tariffId всегда null (везде есть fallback на tariffPerHour).
    override val tariffs: List<Tariff> = emptyList()

    override val promotions = listOf(
        Promotion("1000 бонусов", "отзыв", "За отзыв на Яндекс Картах и 2ГИС — пришлите скриншот через поддержку."),
        Promotion("Приведи друга", "автоматически", "Бонусы начислятся сами после первой сессии друга."),
    )

    private val faqSeed = listOf(
        FaqEntry("f1", "Часы работы клуба", "Клуб работает круглосуточно, вход полностью автоматический — администратор физически не присутствует."),
        FaqEntry("f2", "Адрес клуба", "Самара, Чапаевская, 178."),
        FaqEntry("f3", "Какие есть тарифы", "DUO (место для игры вдвоём), SOLO (одиночное место), SOLO+ (одиночное место повышенного комфорта)."),
        FaqEntry("f4", "Как забронировать место", "Кнопка «Забронировать» — выбираете место, время и длительность, оплата сразу списывается с баланса."),
        FaqEntry("f5", "Как узнать пароль от Wi-Fi", "Пароль от Wi-Fi отображается на экране сразу после входа в клуб."),
        FaqEntry("f6", "Есть ли приставки", "В клубе 404 Киберхаус приставок нет. Они есть в клубе Reborn, номер для связи: 8 998 543-65-78."),
        FaqEntry("f7", "Не открывается игра, Steam или лаунчер", "Обычно помогает перезагрузка компьютера через кнопку у основания кронштейна монитора."),
        FaqEntry("f8", "Где купить еду или напитки", "Напитки и еда — в вендинговом аппарате в клубе. Там же кулер с водой и микроволновка."),
    )
    private val _faq = MutableStateFlow(faqSeed)
    override val faq: StateFlow<List<FaqEntry>> = _faq.asStateFlow()

    private val tickets = mutableListOf<SupportTicket>()
    private var ticketSeq = 1

    private val _currentGuest = MutableStateFlow<Guest?>(null)
    override val currentGuest: StateFlow<Guest?> = _currentGuest.asStateFlow()

    private val _bookingsFlow = MutableStateFlow<List<Booking>>(emptyList())
    @Volatile private var cachedMergedBookings: List<Booking> = emptyList()

    // --- Инициализация каталогов (до логина) -------------------------------

    suspend fun initialize() {
        val fetched = runCatching { fetchStationsAndZones() }.getOrNull()
        stations = fetched?.first ?: emptyList()
        zones = fetched?.second ?: emptyList()
        loyaltyTiers = runCatching { fetchLoyaltyTiers() }.getOrNull() ?: emptyList()
    }

    private suspend fun fetchStationsAndZones(): Pair<List<Station>, List<Zone>> {
        val resp = getObject("/api/stations")
        val arr = resp.getJSONArray("stations")
        val parsedStations = mutableListOf<Station>()
        val zoneLabels = LinkedHashMap<String, String>()
        for (i in 0 until arr.length()) {
            val s = arr.getJSONObject(i)
            val zoneId = s.getString("room")
            zoneLabels.putIfAbsent(zoneId, s.optString("roomLabel", zoneId))
            parsedStations.add(
                Station(
                    id = s.getString("id"),
                    label = s.getString("label"),
                    room = zoneId,
                    seat = s.optInt("seat", 1),
                    zoneId = zoneId,
                    tariffPerHour = s.optInt("tariffPerHour", 0),
                    tariffId = null,
                    status = s.optString("status", "FREE"),
                ),
            )
        }
        // Цвета чисто косметические — backend их не хранит вообще.
        val palette = listOf("#FF5A1F", "#4ADE9C", "#F2C94C", "#5B8DEF", "#E85D75", "#8E6CF0")
        val parsedZones = zoneLabels.entries.mapIndexed { index, (id, label) ->
            Zone(id = id, nameRu = label, colorHex = palette[index % palette.size])
        }
        return parsedStations to parsedZones
    }

    private suspend fun fetchLoyaltyTiers(): List<LoyaltyTier> {
        val arr = getArray("/api/loyalty-tiers")
        return (0 until arr.length()).map { i ->
            val t = arr.getJSONObject(i)
            LoyaltyTier(
                id = t.getString("id"),
                name = t.getString("name"),
                minHours = t.optInt("minHours", 0),
                discountPercent = t.optInt("discountPercent", 0),
                cashbackPercent = t.optInt("cashbackPercent", 0),
            )
        }
    }

    // --- Auth ---------------------------------------------------------------

    override suspend fun login(phone: String, password: String): Result<Guest> = runCatching {
        val resp = postObject("/api/auth/login", JSONObject().put("phone", phone.trim()).put("password", password))
        val token = resp.optString("token", "")
        if (token.isBlank()) throw ApiException("Не удалось войти")
        guestToken = token
        val guest = fetchAndCacheCurrentGuest()
        refreshEntryAccess()
        refreshBookingsAndSession()
        guest
    }

    override suspend fun register(
        phone: String,
        password: String,
        fio: String,
        docPhoto: Bitmap?,
        selfiePhoto: Bitmap?,
    ): Result<Guest> = runCatching {
        val doc = docPhoto ?: throw ApiException("Нужно сфотографировать документ")
        val selfie = selfiePhoto ?: throw ApiException("Нужно сделать селфи")
        val resp = postMultipart(
            "/api/registrations",
            fields = mapOf("phone" to phone.trim(), "password" to password, "fio" to fio.trim()),
            files = listOf(
                Triple("document", "document.jpg", doc.toJpegBytes()),
                Triple("selfie", "selfie.jpg", selfie.toJpegBytes()),
            ),
        )
        Guest(
            id = resp.getString("id"),
            phone = phone.trim(),
            password = "",
            fio = fio.trim(),
            balanceRub = 0,
            bonusPoints = 0,
            loyaltyTierId = null,
            regStatus = if (resp.optString("regStatus").equals("APPROVED", ignoreCase = true)) RegStatus.APPROVED else RegStatus.PENDING,
        )
    }

    override fun logout() {
        guestToken = null
        cachedSessionId = null
        cachedEntryAccess = null
        _currentGuest.value = null
        _bookingsFlow.value = emptyList()
        cachedMergedBookings = emptyList()
    }

    private suspend fun fetchAndCacheCurrentGuest(): Guest {
        val resp = getObject("/api/auth/me", auth = true)
        val guest = Guest(
            id = resp.getString("id"),
            phone = resp.getString("phone"),
            password = "",
            fio = resp.optString("fio", ""),
            balanceRub = resp.optInt("balanceRub", 0),
            bonusPoints = resp.optInt("bonusPoints", 0),
            loyaltyTierId = null,
            regStatus = RegStatus.APPROVED,
        )
        _currentGuest.value = guest
        return guest
    }

    private suspend fun refreshEntryAccess() {
        val resp = runCatching { getObject("/api/entry-access", auth = true) }.getOrNull()
        cachedEntryAccess = resp?.let {
            EntryAccess(intercomUrl = it.optString("intercomUrl", ""), doorCode = it.optString("doorCodeMain", ""))
        }
    }

    override fun entryAccessForCurrentGuest(): EntryAccess? = cachedEntryAccess

    // --- Bookings -------------------------------------------------------

    override fun bookingsForCurrentGuest(): StateFlow<List<Booking>> = _bookingsFlow.asStateFlow()

    override fun activeBooking(): Booking? {
        val now = Instant.now()
        return cachedMergedBookings.firstOrNull { it.status == BookingStatus.REDEEMED && it.endAt().isAfter(now) }
    }

    override fun nextUpcomingBooking(): Booking? {
        val now = Instant.now()
        return cachedMergedBookings
            .filter { it.status == BookingStatus.CONFIRMED && it.startAt.isAfter(now) }
            .minByOrNull { it.startAt }
    }

    private fun mapBookingStatus(raw: String): BookingStatus = when (raw) {
        "SCHEDULED" -> BookingStatus.CONFIRMED
        "ACTIVE" -> BookingStatus.REDEEMED
        "COMPLETED" -> BookingStatus.COMPLETED
        "CANCELLED" -> BookingStatus.CANCELLED
        else -> BookingStatus.EXPIRED
    }

    // Сливает две разные сущности backend'а в один список Booking, как их
    // видит приложение: Booking (SCHEDULED/ACTIVE через код на станции) и
    // Session без брони (WALK_IN_LOGIN — гость стартовал сессию с телефона).
    // Дедуп по stationId — на одном месте одновременно может быть только
    // одна активная сессия, так что случай "своя же ACTIVE-бронь плюс
    // синтетическая запись для неё же" не должен возникать.
    private suspend fun refreshBookingsAndSession() {
        val guestId = _currentGuest.value?.id
        if (guestId == null) {
            _bookingsFlow.value = emptyList()
            cachedMergedBookings = emptyList()
            cachedSessionId = null
            return
        }

        val bookingsResp = runCatching { getObject("/api/bookings/mine", auth = true) }.getOrNull()
        val bookingsJson = bookingsResp?.optJSONArray("bookings") ?: JSONArray()
        val fromBookings = (0 until bookingsJson.length()).map { i ->
            val b = bookingsJson.getJSONObject(i)
            Booking(
                id = b.getString("id"),
                guestId = guestId,
                stationId = b.optString("stationId", ""),
                startAt = Instant.parse(b.getString("startAt")),
                minutesPaid = b.optInt("minutesPaid", 0),
                amountRub = b.optInt("amountRub", 0),
                code = b.optString("code", ""),
                status = mapBookingStatus(b.optString("status", "SCHEDULED")),
            )
        }

        val sessionResp = runCatching { getObject("/api/sessions/active", auth = true) }.getOrNull()
        val sessionJson = sessionResp?.optJSONObject("session")

        val merged = fromBookings.toMutableList()
        if (sessionJson != null) {
            cachedSessionId = sessionJson.getString("id")
            val sessionStationId = sessionJson.optString("stationId", "")
            val alreadyFromBooking = fromBookings.any { it.stationId == sessionStationId && it.status == BookingStatus.REDEEMED }
            if (!alreadyFromBooking && sessionJson.optString("status") == "ACTIVE") {
                val endsAt = Instant.parse(sessionJson.getString("endsAt"))
                val now = Instant.now()
                val minutesLeft = maxOf(1L, ChronoUnit.MINUTES.between(now, endsAt)).toInt()
                merged.add(
                    0,
                    Booking(
                        id = sessionJson.getString("id"),
                        guestId = guestId,
                        stationId = sessionStationId,
                        startAt = now,
                        minutesPaid = minutesLeft,
                        amountRub = 0,
                        code = "",
                        status = BookingStatus.REDEEMED,
                    ),
                )
            }
        } else {
            cachedSessionId = null
        }

        cachedMergedBookings = merged
        _bookingsFlow.value = merged.sortedByDescending { it.startAt }
    }

    override suspend fun quoteBooking(stationId: String, minutes: Int): BookingQuote {
        val resp = postObject(
            "/api/bookings/quote",
            JSONObject().put("stationId", stationId).put("minutes", minutes),
            auth = true,
        )
        return BookingQuote(
            baseAmountRub = resp.optInt("baseAmountRub", 0),
            amountRub = resp.optInt("amountRub", 0),
            discountPercent = resp.optInt("discountPercent", 0),
            cashbackRub = resp.optInt("cashbackRub", 0),
        )
    }

    override suspend fun createBooking(stationId: String, startAt: Instant, minutes: Int, bonusRubToRedeem: Int): Result<Booking> = runCatching {
        val resp = postObject(
            "/api/bookings",
            JSONObject().put("stationId", stationId).put("startAt", startAt.toString()).put("minutes", minutes),
            auth = true,
        )
        val booking = resp.getJSONObject("booking")
        val id = booking.getString("id")
        val code = booking.getString("code")
        refreshBookingsAndSession()
        cachedMergedBookings.firstOrNull { it.id == id } ?: Booking(
            id = id,
            guestId = _currentGuest.value?.id ?: "",
            stationId = stationId,
            startAt = startAt,
            minutesPaid = minutes,
            amountRub = 0,
            code = code,
            status = BookingStatus.CONFIRMED,
        )
    }

    override suspend fun cancelBooking(bookingId: String): Result<Unit> = runCatching {
        postObject("/api/bookings/$bookingId/cancel", null, auth = true)
        refreshBookingsAndSession()
    }

    override suspend fun redeemCode(code: String): Result<Booking> =
        Result.failure(IllegalStateException("Ввод кода брони — действие на самой станции (ПК-виджет), а не в приложении"))

    override fun freeStationsNow(): List<Station> = stations.filter { it.status == "FREE" }

    override suspend fun startWalkInSession(stationId: String, minutes: Int): Result<Booking> = runCatching {
        val resp = postObject(
            "/api/sessions",
            JSONObject().put("stationId", stationId).put("minutes", minutes),
            auth = true,
        )
        refreshBookingsAndSession()
        Booking(
            id = resp.getString("id"),
            guestId = _currentGuest.value?.id ?: "",
            stationId = resp.optString("stationId", stationId),
            startAt = Instant.now(),
            minutesPaid = minutes,
            amountRub = 0,
            code = "",
            status = BookingStatus.REDEEMED,
        )
    }

    override suspend fun extendActiveSession(minutes: Int, priceRub: Int): Result<Unit> = runCatching {
        // priceRub игнорируется — это клиентская оценка для UI, сервер сам
        // пересчитывает и списывает актуальную сумму (см. SessionService.extend).
        val sessionId = cachedSessionId ?: run { refreshBookingsAndSession(); cachedSessionId }
            ?: throw ApiException("Нет активной сессии")
        postObject("/api/sessions/$sessionId/extend", JSONObject().put("minutes", minutes), auth = true)
        refreshBookingsAndSession()
    }

    override suspend fun endActiveSessionWithReport(
        cleanDesk: Boolean,
        cleanPc: Boolean,
        cleanHeadset: Boolean,
        photos: List<Bitmap>,
    ): Result<Unit> = runCatching {
        val sessionId = cachedSessionId ?: run { refreshBookingsAndSession(); cachedSessionId }
            ?: throw ApiException("Нет активной сессии")
        if (photos.size < 2) throw ApiException("Нужны минимум 2 фото")
        val files = photos.mapIndexed { index, bmp -> Triple("photo_$index", "photo_$index.jpg", bmp.toJpegBytes()) }
        postMultipart(
            "/api/session-reports",
            fields = mapOf(
                "sessionId" to sessionId,
                "checkDesk" to cleanDesk.toString(),
                "checkPc" to cleanPc.toString(),
                "checkHeadset" to cleanHeadset.toString(),
            ),
            files = files,
            // Без auth — sessionId сам по себе разовый предъявитель, как код
            // брони (см. src/modules/sessionReports на backend).
        )
        refreshBookingsAndSession()
    }

    // --- Balance ------------------------------------------------------

    override suspend fun topUp(amountRub: Int): Result<Unit> = runCatching {
        postObject("/api/topup", JSONObject().put("amount", amountRub), auth = true)
        fetchAndCacheCurrentGuest()
        Unit
    }

    override suspend fun requestRefund(amountRub: Int, reason: String): Result<Unit> = runCatching {
        val body = JSONObject().put("amount", amountRub)
        if (reason.isNotBlank()) body.put("reason", reason)
        postObject("/api/refund-requests", body, auth = true)
        Unit
    }

    // --- Support agent (нет backend — тот же офлайн SupportAgent, что и в Mock) --

    override fun buildSupportContext(): GuestSupportContext {
        val guest = _currentGuest.value ?: error("Не авторизован")
        val active = activeBooking()
        val next = nextUpcomingBooking()
        val refBooking = active ?: next
        val tariffLabel = if (refBooking != null) {
            val station = stations.firstOrNull { it.id == refBooking.stationId }
            "${station?.tariffPerHour ?: 0} ₽/час"
        } else {
            "не назначен (нет брони)"
        }
        val doorCode = if (active != null) {
            DoorCodeInfo.Available(cachedEntryAccess?.doorCode ?: "—")
        } else {
            DoorCodeInfo.Unavailable("нет активной сессии прямо сейчас")
        }
        return GuestSupportContext(
            name = guest.fio,
            phone = guest.phone,
            bonusPoints = guest.bonusPoints,
            balanceRub = guest.balanceRub,
            tariffLabel = tariffLabel,
            activeSession = active?.let { b -> ActiveSessionInfo(stations.firstOrNull { it.id == b.stationId }?.label ?: "—", b.endAt()) },
            nextBooking = next?.let { b -> NextBookingInfo(stations.firstOrNull { it.id == b.stationId }?.label ?: "—", b.startAt) },
            doorCode = doorCode,
        )
    }

    override suspend fun sendSupportMessage(message: String, history: List<ChatMessage>): ChatMessage {
        val guest = _currentGuest.value ?: error("Не авторизован")
        val context = buildSupportContext()
        val raw = SupportAgent.reply(context, _faq.value, message)
        if (!raw.startsWith("ESCALATE:")) return ChatMessage(ChatRole.BOT, raw)

        val reason = raw.removePrefix("ESCALATE:").trim()
        val ticket = SupportTicket(
            id = "sup-${ticketSeq++}",
            guestId = guest.id,
            question = message,
            reason = reason,
            status = TicketStatus.OPEN,
            createdAt = Instant.now(),
        )
        tickets.add(ticket)
        return ChatMessage(
            ChatRole.BOT,
            "${reason.ifBlank { "Передал ваш вопрос живому саппорту." }} Номер обращения: ${ticket.id}. Мы свяжемся с вами по телефону ${guest.phone}.",
        )
    }

    override fun ticketsForCurrentGuest(): List<SupportTicket> {
        val guestId = _currentGuest.value?.id ?: return emptyList()
        return tickets.filter { it.guestId == guestId }.sortedByDescending { it.createdAt }
    }

    // --- HTTP core --------------------------------------------------------

    private fun Bitmap.toJpegBytes(quality: Int = 85): ByteArray {
        val stream = ByteArrayOutputStream()
        compress(Bitmap.CompressFormat.JPEG, quality, stream)
        return stream.toByteArray()
    }

    private suspend fun rawRequest(method: String, path: String, jsonBody: JSONObject?, auth: Boolean): Pair<Int, String> =
        withContext(Dispatchers.IO) {
            val conn = URL(baseUrl + path).openConnection() as HttpURLConnection
            try {
                conn.requestMethod = method
                conn.connectTimeout = 10_000
                conn.readTimeout = 15_000
                conn.setRequestProperty("Accept", "application/json")
                if (auth) {
                    val token = guestToken ?: throw ApiException("Не авторизован")
                    conn.setRequestProperty("Authorization", "Bearer $token")
                }
                if (jsonBody != null) {
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true
                    conn.outputStream.use { it.write(jsonBody.toString().toByteArray(Charsets.UTF_8)) }
                }
                val status = conn.responseCode
                val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                status to text
            } finally {
                conn.disconnect()
            }
        }

    private fun errorMessageFrom(json: JSONObject, status: Int): String {
        when (json.optString("status", "")) {
            "pending" -> return "Ваша анкета ещё на проверке — вход станет доступен после одобрения администратором клуба"
            "rejected" -> return "Ваша анкета отклонена — обратитесь в поддержку клуба"
        }
        if (json.has("required") && json.has("available")) {
            return "Не хватает баланса: нужно ${json.optInt("required")} ₽, на счету ${json.optInt("available")} ₽"
        }
        val msg = json.optString("message", "").ifBlank { json.optString("error", "") }
        return msg.ifBlank { "Ошибка сервера ($status)" }
    }

    private fun parseObjectOrThrow(status: Int, text: String): JSONObject {
        val obj = if (text.isBlank()) JSONObject() else JSONObject(text)
        if (status !in 200..299) throw ApiException(errorMessageFrom(obj, status))
        return obj
    }

    private suspend fun getObject(path: String, auth: Boolean = false): JSONObject {
        val (status, text) = rawRequest("GET", path, null, auth)
        return parseObjectOrThrow(status, text)
    }

    private suspend fun postObject(path: String, body: JSONObject?, auth: Boolean = false): JSONObject {
        val (status, text) = rawRequest("POST", path, body, auth)
        return parseObjectOrThrow(status, text)
    }

    private suspend fun getArray(path: String, auth: Boolean = false): JSONArray {
        val (status, text) = rawRequest("GET", path, null, auth)
        if (status !in 200..299) {
            val obj = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            throw ApiException(errorMessageFrom(obj, status))
        }
        return if (text.isBlank()) JSONArray() else JSONArray(text)
    }

    private suspend fun postMultipart(
        path: String,
        fields: Map<String, String>,
        files: List<Triple<String, String, ByteArray>>,
        auth: Boolean = false,
    ): JSONObject = withContext(Dispatchers.IO) {
        val boundary = "----404kh${UUID.randomUUID()}"
        val conn = URL(baseUrl + path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            if (auth) {
                val token = guestToken ?: throw ApiException("Не авторизован")
                conn.setRequestProperty("Authorization", "Bearer $token")
            }
            conn.outputStream.use { out ->
                fun writeLine(s: String) = out.write((s + "\r\n").toByteArray(Charsets.UTF_8))
                for ((name, value) in fields) {
                    writeLine("--$boundary")
                    writeLine("Content-Disposition: form-data; name=\"$name\"")
                    writeLine("")
                    writeLine(value)
                }
                for ((fieldName, filename, bytes) in files) {
                    writeLine("--$boundary")
                    writeLine("Content-Disposition: form-data; name=\"$fieldName\"; filename=\"$filename\"")
                    writeLine("Content-Type: image/jpeg")
                    writeLine("")
                    out.write(bytes)
                    out.write("\r\n".toByteArray(Charsets.UTF_8))
                }
                writeLine("--$boundary--")
            }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            parseObjectOrThrow(status, text)
        } finally {
            conn.disconnect()
        }
    }
}
