package ru.club404.guest.data

import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.random.Random

/**
 * Данные только в памяти процесса — приложение "первого шага", без сети.
 * Структура и правила 1:1 повторяют backend/src/modules (billing/booking
 * module) и веб-прототип сайта (404-club-site): 5 минут минимальный лаг
 * перед бронью, комиссия по тарифной сетке или flat tariffPerHour, код от
 * двери выдаётся строго на весь оплаченный период без грейса.
 *
 * Единственный экземпляр на процесс — см. Club404App.
 */
class MockGuestRepository : GuestRepository {

    private val doorCodeMain = "7251957#"

    private val guests = mutableListOf(
        Guest(id = "g1", phone = "+79991234567", password = "demo123", fio = "Иванов Иван Иванович", balanceRub = 3000, bonusPoints = 500, loyaltyTierId = "lt2"),
        Guest(id = "g2", phone = "+79997654321", password = "demo123", fio = "Петров Пётр Петрович", balanceRub = 1500, bonusPoints = 0, loyaltyTierId = null),
    )
    private var guestSeq = 3

    override val zones = listOf(
        Zone("z1", "DUO", "#FF5A1F"),
        Zone("z2", "SOLO", "#4ADE9C"),
        Zone("z3", "SOLO+", "#F2C94C"),
    )

    override val tariffs = listOf(
        Tariff("t1", "DUO вечерний", "z1", 300),
    )

    override val stations = listOf(
        Station("st1", "DUO 1 · место A", "duo-1", 1, "z1", 250, tariffId = "t1"),
        Station("st2", "DUO 1 · место B", "duo-1", 2, "z1", 250),
        Station("st3", "DUO 2 · место A", "duo-2", 1, "z1", 250),
        Station("st4", "DUO 2 · место B", "duo-2", 2, "z1", 250),
        Station("st5", "SOLO", "solo-1", 1, "z2", 250),
        Station("st6", "SOLO+", "solo-plus", 1, "z3", 275),
    )

    override val loyaltyTiers = listOf(
        LoyaltyTier("lt1", "Новичок", 0, 0, 0),
        LoyaltyTier("lt2", "Завсегдатай", 20, 10, 5),
        LoyaltyTier("lt3", "Ветеран", 100, 15, 8),
    )

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

    private val bookings = mutableListOf<Booking>()
    private var bookingSeq = 1
    private val tickets = mutableListOf<SupportTicket>()
    private var ticketSeq = 1

    private val _currentGuest = MutableStateFlow<Guest?>(null)
    override val currentGuest: StateFlow<Guest?> = _currentGuest.asStateFlow()

    private val _faq = MutableStateFlow(faqSeed)
    override val faq: StateFlow<List<FaqEntry>> = _faq.asStateFlow()

    private val _bookingsFlow = MutableStateFlow<List<Booking>>(emptyList())

    // --- Auth -----------------------------------------------------------

    override suspend fun login(phone: String, password: String): Result<Guest> {
        delay(300)
        val guest = guests.firstOrNull { it.phone == phone.trim() }
            ?: return Result.failure(IllegalArgumentException("Гость с таким телефоном не найден"))
        if (guest.password != password) return Result.failure(IllegalArgumentException("Неверный пароль"))
        _currentGuest.value = guest
        refreshBookingsFlow()
        return Result.success(guest)
    }

    override suspend fun register(phone: String, password: String, fio: String, docPhoto: android.graphics.Bitmap?, selfiePhoto: android.graphics.Bitmap?): Result<Guest> {
        delay(300)
        if (guests.any { it.phone == phone.trim() }) {
            return Result.failure(IllegalArgumentException("Такой телефон уже зарегистрирован"))
        }
        // regStatus = APPROVED сразу — в приложении нет админки, которая в
        // реальности рассматривает анкету (см. RegStatus в Models.kt), так
        // что "проверка" здесь чисто визуальная (экран ожидания), а не
        // фактическая блокировка входа.
        val guest = Guest(id = "g${guestSeq++}", phone = phone.trim(), password = password, fio = fio.trim(), balanceRub = 0, bonusPoints = 500, loyaltyTierId = null, regStatus = RegStatus.APPROVED)
        guests.add(guest)
        // Без авто-логина — как на сайте, гость сам идёт логиниться после экрана ожидания.
        return Result.success(guest)
    }

    override fun logout() {
        _currentGuest.value = null
        _bookingsFlow.value = emptyList()
    }

    // --- Bookings ---------------------------------------------------------

    override fun bookingsForCurrentGuest(): StateFlow<List<Booking>> = _bookingsFlow.asStateFlow()

    private fun refreshBookingsFlow() {
        val guestId = _currentGuest.value?.id ?: return
        _bookingsFlow.value = bookings.filter { it.guestId == guestId }.sortedByDescending { it.startAt }
    }

    override fun activeBooking(): Booking? {
        val guestId = _currentGuest.value?.id ?: return null
        val now = Instant.now()
        return bookings.firstOrNull { it.guestId == guestId && it.status == BookingStatus.REDEEMED && it.endAt().isAfter(now) }
    }

    override fun nextUpcomingBooking(): Booking? {
        val guestId = _currentGuest.value?.id ?: return null
        val now = Instant.now()
        return bookings
            .filter { it.guestId == guestId && it.status == BookingStatus.CONFIRMED && it.startAt.isAfter(now) }
            .minByOrNull { it.startAt }
    }

    override suspend fun quoteBooking(stationId: String, minutes: Int): BookingQuote {
        val station = stations.first { it.id == stationId }
        val perHour = station.tariffId?.let { id -> tariffs.first { it.id == id }.priceRubPerHour } ?: station.tariffPerHour
        val baseAmount = Math.round(perHour * (minutes / 60.0)).toInt()
        val guest = _currentGuest.value
        val tier = guest?.loyaltyTierId?.let { id -> loyaltyTiers.firstOrNull { it.id == id } }
        val discountPercent = tier?.discountPercent ?: 0
        val amount = if (discountPercent > 0) Math.round(baseAmount * (100 - discountPercent) / 100.0).toInt() else baseAmount
        val cashbackPercent = tier?.cashbackPercent ?: 0
        val cashback = if (cashbackPercent > 0) Math.round(amount * cashbackPercent / 100.0).toInt() else 0
        return BookingQuote(baseAmountRub = baseAmount, amountRub = amount, discountPercent = discountPercent, cashbackRub = cashback)
    }

    override suspend fun createBooking(stationId: String, startAt: Instant, minutes: Int, bonusRubToRedeem: Int): Result<Booking> {
        delay(400)
        val guest = _currentGuest.value ?: return Result.failure(IllegalStateException("Не авторизован"))
        if (minutes < 10) return Result.failure(IllegalArgumentException("Минимальная длительность брони — 10 минут"))
        if (startAt.isBefore(Instant.now().plus(5, ChronoUnit.MINUTES))) {
            return Result.failure(IllegalArgumentException("Бронь должна начинаться минимум через 5 минут от текущего момента"))
        }
        val endAt = startAt.plusSeconds(minutes * 60L)
        val bufferSeconds = 60L * 60L
        val overlaps = bookings.any { b ->
            b.stationId == stationId &&
                (b.status == BookingStatus.CONFIRMED || b.status == BookingStatus.REDEEMED) &&
                startAt.isBefore(b.endAt().plusSeconds(bufferSeconds)) && b.startAt.isBefore(endAt.plusSeconds(bufferSeconds))
        }
        if (overlaps) {
            return Result.failure(IllegalStateException("Это место занято рядом с выбранным временем — нужен зазор 60 минут между бронями"))
        }
        val quote = quoteBooking(stationId, minutes)
        val bonusRedeemed = bonusRubToRedeem.coerceIn(0, minOf(guest.bonusPoints, quote.amountRub))
        val amountFromBalance = quote.amountRub - bonusRedeemed
        if (guest.balanceRub < amountFromBalance) {
            return Result.failure(IllegalStateException("Не хватает баланса: нужно ${formatMoney(amountFromBalance)}, на счету ${formatMoney(guest.balanceRub)}"))
        }
        guest.balanceRub -= amountFromBalance
        guest.bonusPoints -= bonusRedeemed
        if (quote.cashbackRub > 0) guest.bonusPoints += quote.cashbackRub
        val booking = Booking(
            id = "bk-${bookingSeq++}",
            guestId = guest.id,
            stationId = stationId,
            startAt = startAt,
            minutesPaid = minutes,
            amountRub = amountFromBalance,
            code = (100000 + Random.nextInt(900000)).toString(),
            status = BookingStatus.CONFIRMED,
        )
        bookings.add(booking)
        _currentGuest.value = guest.copy()
        refreshBookingsFlow()
        return Result.success(booking)
    }

    override suspend fun cancelBooking(bookingId: String): Result<Unit> {
        delay(200)
        val booking = bookings.firstOrNull { it.id == bookingId } ?: return Result.failure(IllegalArgumentException("Бронь не найдена"))
        if (booking.status != BookingStatus.CONFIRMED) return Result.failure(IllegalStateException("Эту бронь нельзя отменить"))
        val hoursUntilStart = ChronoUnit.MINUTES.between(Instant.now(), booking.startAt) / 60.0
        booking.status = BookingStatus.CANCELLED
        if (hoursUntilStart > 24) {
            val guest = guests.first { it.id == booking.guestId }
            guest.balanceRub += booking.amountRub
            if (_currentGuest.value?.id == guest.id) _currentGuest.value = guest.copy()
        }
        refreshBookingsFlow()
        return Result.success(Unit)
    }

    override suspend fun redeemCode(code: String): Result<Booking> {
        delay(300)
        val booking = bookings.firstOrNull { it.code == code }
            ?: return Result.failure(IllegalArgumentException("Код не найден или уже использован"))
        if (booking.status == BookingStatus.CANCELLED || booking.status == BookingStatus.EXPIRED) {
            return Result.failure(IllegalArgumentException("Код не найден или уже использован"))
        }
        if (booking.endAt().isBefore(Instant.now())) {
            booking.status = BookingStatus.EXPIRED
            return Result.failure(IllegalStateException("Бронь истекла — оплаченное время уже закончилось"))
        }
        if (booking.status == BookingStatus.CONFIRMED) booking.status = BookingStatus.REDEEMED
        refreshBookingsFlow()
        return Result.success(booking)
    }

    override fun freeStationsNow(): List<Station> {
        val now = Instant.now()
        val occupiedIds = bookings
            .filter { it.status == BookingStatus.REDEEMED && it.endAt().isAfter(now) }
            .map { it.stationId }
            .toSet()
        return stations.filter { it.id !in occupiedIds }
    }

    override suspend fun startWalkInSession(stationId: String, minutes: Int): Result<Booking> {
        delay(400)
        val guest = _currentGuest.value ?: return Result.failure(IllegalStateException("Не авторизован"))
        if (minutes < 10) return Result.failure(IllegalArgumentException("Минимальная длительность — 10 минут"))
        val now = Instant.now()
        val endAt = now.plusSeconds(minutes * 60L)
        val bufferSeconds = 60L * 60L
        val overlaps = bookings.any { b ->
            b.stationId == stationId &&
                (b.status == BookingStatus.CONFIRMED || b.status == BookingStatus.REDEEMED) &&
                now.isBefore(b.endAt().plusSeconds(bufferSeconds)) && b.startAt.isBefore(endAt.plusSeconds(bufferSeconds))
        }
        if (overlaps) {
            return Result.failure(IllegalStateException("Это место сейчас занято или скоро забронировано — выберите другое"))
        }
        val quote = quoteBooking(stationId, minutes)
        if (guest.balanceRub < quote.amountRub) {
            return Result.failure(IllegalStateException("Не хватает баланса: нужно ${formatMoney(quote.amountRub)}, на счету ${formatMoney(guest.balanceRub)}"))
        }
        guest.balanceRub -= quote.amountRub
        if (quote.cashbackRub > 0) guest.bonusPoints += quote.cashbackRub
        val booking = Booking(
            id = "bk-${bookingSeq++}",
            guestId = guest.id,
            stationId = stationId,
            startAt = now,
            minutesPaid = minutes,
            amountRub = quote.amountRub,
            code = (100000 + Random.nextInt(900000)).toString(),
            status = BookingStatus.REDEEMED,
        )
        bookings.add(booking)
        _currentGuest.value = guest.copy()
        refreshBookingsFlow()
        return Result.success(booking)
    }

    override suspend fun extendActiveSession(minutes: Int, priceRub: Int): Result<Unit> {
        delay(300)
        val guest = _currentGuest.value ?: return Result.failure(IllegalStateException("Не авторизован"))
        val booking = activeBooking() ?: return Result.failure(IllegalStateException("Нет активной сессии"))
        if (guest.balanceRub < priceRub) {
            return Result.failure(IllegalStateException("Не хватает баланса: нужно ${formatMoney(priceRub)}, на счету ${formatMoney(guest.balanceRub)}"))
        }
        guest.balanceRub -= priceRub
        val index = bookings.indexOfFirst { it.id == booking.id }
        bookings[index] = booking.copy(minutesPaid = booking.minutesPaid + minutes)
        _currentGuest.value = guest.copy()
        refreshBookingsFlow()
        return Result.success(Unit)
    }

    override suspend fun endActiveSessionWithReport(
        cleanDesk: Boolean,
        cleanPc: Boolean,
        cleanHeadset: Boolean,
        photos: List<android.graphics.Bitmap>,
    ): Result<Unit> {
        delay(400)
        val booking = activeBooking() ?: return Result.failure(IllegalStateException("Нет активной сессии"))
        booking.status = BookingStatus.COMPLETED
        refreshBookingsFlow()
        return Result.success(Unit)
    }

    // --- Balance ------------------------------------------------------

    override suspend fun topUp(amountRub: Int): Result<Unit> {
        delay(500) // имитация СБП/эквайринга; в полном бэкенде — dev-stub PaymentProvider
        val guest = _currentGuest.value ?: return Result.failure(IllegalStateException("Не авторизован"))
        guest.balanceRub += amountRub
        _currentGuest.value = guest.copy()
        return Result.success(Unit)
    }

    override suspend fun requestRefund(amountRub: Int, reason: String): Result<Unit> {
        delay(300)
        val guest = _currentGuest.value ?: return Result.failure(IllegalStateException("Не авторизован"))
        if (amountRub <= 0 || amountRub > guest.balanceRub) {
            return Result.failure(IllegalArgumentException("Некорректная сумма возврата"))
        }
        // В приложении нет админки для решения по заявке (по условию задачи) —
        // заявка просто регистрируется как обращение поддержки, как ст.32 ЗоЗПП
        // требует; решение принимает персонал через веб-админку сайта.
        tickets.add(
            SupportTicket(
                id = "sup-${ticketSeq++}",
                guestId = guest.id,
                question = "Заявка на возврат ${formatMoney(amountRub)}",
                reason = reason.ifBlank { "без указания причины" },
                status = TicketStatus.OPEN,
                createdAt = Instant.now(),
            )
        )
        return Result.success(Unit)
    }

    // --- Support agent --------------------------------------------------

    override fun buildSupportContext(): GuestSupportContext {
        val guest = _currentGuest.value ?: error("Не авторизован")
        val active = activeBooking()
        val next = nextUpcomingBooking()
        val refBooking = active ?: next
        val tariffLabel = if (refBooking != null) {
            val station = stations.first { it.id == refBooking.stationId }
            val tariff = station.tariffId?.let { id -> tariffs.firstOrNull { it.id == id } }
            tariff?.name ?: "${station.tariffPerHour} ₽/час"
        } else {
            "не назначен (нет брони)"
        }
        val doorCode = if (active != null) {
            DoorCodeInfo.Available(doorCodeMain)
        } else {
            DoorCodeInfo.Unavailable("нет активной сессии прямо сейчас")
        }
        return GuestSupportContext(
            name = guest.fio,
            phone = guest.phone,
            bonusPoints = guest.bonusPoints,
            balanceRub = guest.balanceRub,
            tariffLabel = tariffLabel,
            activeSession = active?.let { ActiveSessionInfo(stations.first { s -> s.id == it.stationId }.label, it.endAt()) },
            nextBooking = next?.let { NextBookingInfo(stations.first { s -> s.id == it.stationId }.label, it.startAt) },
            doorCode = doorCode,
        )
    }

    override suspend fun sendSupportMessage(message: String, history: List<ChatMessage>): ChatMessage {
        delay(400 + Random.nextLong(400))
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
        val guestFacing = "${reason.ifBlank { "Передал ваш вопрос живому саппорту." }} Номер обращения: ${ticket.id}. Мы свяжемся с вами по телефону ${guest.phone}."
        return ChatMessage(ChatRole.BOT, guestFacing)
    }

    override fun ticketsForCurrentGuest(): List<SupportTicket> {
        val guestId = _currentGuest.value?.id ?: return emptyList()
        return tickets.filter { it.guestId == guestId }.sortedByDescending { it.createdAt }
    }

    override fun entryAccessForCurrentGuest(): EntryAccess? {
        val guest = _currentGuest.value ?: return null
        // Стабильно для гостя (не пересоздаётся при каждом открытии экрана) —
        // как на сайте: "персональный, сгенерирован автоматически именно для вас".
        val rnd = Random(guest.id.hashCode().toLong())
        val doorCode = (0 until 7).joinToString("") { rnd.nextInt(10).toString() } + "#"
        return EntryAccess(
            intercomUrl = "https://intercom.404kh.example/open?guest=${guest.id}",
            doorCode = doorCode,
        )
    }
}
