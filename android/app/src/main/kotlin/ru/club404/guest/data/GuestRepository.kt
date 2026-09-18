package ru.club404.guest.data

import kotlinx.coroutines.flow.StateFlow
import java.time.Instant

/**
 * Единая точка доступа к данным для всех экранов. Сейчас — только
 * [MockGuestRepository] с данными в памяти (сознательный выбор для первой
 * версии приложения — см. README в этом модуле). Когда бэкенд будет готов,
 * добавляется RemoteGuestRepository с тем же интерфейсом на Retrofit/Ktor,
 * и экраны/ViewModel'и не меняются вообще — это ради этого интерфейс и
 * заведён, по аналогии с LLMClient/PaymentProvider в backend-модулях сайта.
 */
interface GuestRepository {

    val currentGuest: StateFlow<Guest?>
    val faq: StateFlow<List<FaqEntry>>
    val zones: List<Zone>
    val tariffs: List<Tariff>
    val stations: List<Station>
    val promotions: List<Promotion>
    val loyaltyTiers: List<LoyaltyTier>

    suspend fun login(phone: String, password: String): Result<Guest>

    // Как на сайте — регистрация НЕ логинит гостя автоматически, анкета
    // уходит "на проверку" (см. RegStatus). Вызывающая сторона переводит UI
    // на экран ожидания сама; войти можно отдельным вызовом login().
    suspend fun register(phone: String, password: String, fio: String): Result<Guest>
    fun logout()

    fun bookingsForCurrentGuest(): StateFlow<List<Booking>>
    fun activeBooking(): Booking?
    fun nextUpcomingBooking(): Booking?

    suspend fun quoteBooking(stationId: String, minutes: Int): BookingQuote
    suspend fun createBooking(stationId: String, startAt: Instant, minutes: Int): Result<Booking>
    suspend fun cancelBooking(bookingId: String): Result<Unit>

    // Редактирование брони кодом на самой станции (см. frontend/pc-widget.html
    // и backend/src/routes/pcAgent.ts) — это действие принадлежит станции, не
    // телефону гостя, поэтому в UI приложения никакой экран его не вызывает
    // (см. android/README.md). Метод остаётся в интерфейсе как контракт
    // станции-виджета на будущее — не мёртвый код, а нереализованная в этом
    // приложении сторона интеграции.
    suspend fun redeemCode(code: String): Result<Booking>

    // Сценарий 1 (гость пришёл без брони, сел за свободный ПК): выбирает
    // место и стартует сессию прямо из приложения — никакого кода вводить не
    // нужно, телефон гостя тут и есть тот "виджет". Сценарий 2 (гость
    // бронировал заранее): код по-прежнему вводится на самой станции,
    // redeemCode() выше — этот метод его не подменяет.
    fun freeStationsNow(): List<Station>
    suspend fun startWalkInSession(stationId: String, minutes: Int): Result<Booking>

    // Продление активной сессии со станции-виджета в приложении — те же
    // правила, что в frontend/pc-widget.html: цена считается по flat
    // tariffPerHour станции (без сетки/лояльности, ровно как у виджета на
    // ПК), minutes/priceRub уже посчитаны вызывающей стороной (см.
    // SessionWidget: пакеты 3ч/6ч или шаг по 10 мин).
    suspend fun extendActiveSession(minutes: Int, priceRub: Int): Result<Unit>

    // Досрочное завершение сессии гостем через виджет — только после
    // подтверждения чистоты места (см. EndSessionScreen); истечение
    // оплаченного времени само по себе сюда не попадает.
    suspend fun endActiveSessionWithReport(): Result<Unit>

    suspend fun topUp(amountRub: Int): Result<Unit>
    suspend fun requestRefund(amountRub: Int, reason: String): Result<Unit>

    fun buildSupportContext(): GuestSupportContext
    suspend fun sendSupportMessage(message: String, history: List<ChatMessage>): ChatMessage
    fun ticketsForCurrentGuest(): List<SupportTicket>
}

data class Promotion(val title: String, val tag: String, val description: String)

data class BookingQuote(
    val baseAmountRub: Int,
    val amountRub: Int,
    val discountPercent: Int,
    val cashbackRub: Int,
)
