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
    suspend fun register(phone: String, password: String, fio: String): Result<Guest>
    fun logout()

    fun bookingsForCurrentGuest(): StateFlow<List<Booking>>
    fun activeBooking(): Booking?
    fun nextUpcomingBooking(): Booking?

    suspend fun quoteBooking(stationId: String, minutes: Int): BookingQuote
    suspend fun createBooking(stationId: String, startAt: Instant, minutes: Int): Result<Booking>
    suspend fun cancelBooking(bookingId: String): Result<Unit>
    suspend fun redeemCode(code: String): Result<Booking>

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
