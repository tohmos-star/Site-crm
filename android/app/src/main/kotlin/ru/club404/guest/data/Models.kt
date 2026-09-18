package ru.club404.guest.data

import java.time.Instant

data class Guest(
    val id: String,
    val phone: String,
    val password: String,
    val fio: String,
    var balanceRub: Int,
    var bonusPoints: Int,
    val loyaltyTierId: String?,
)

data class Zone(val id: String, val nameRu: String, val colorHex: String)

data class Tariff(val id: String, val name: String, val zoneId: String, val priceRubPerHour: Int)

data class Station(
    val id: String,
    val label: String,
    val room: String,
    val seat: Int,
    val zoneId: String,
    val tariffPerHour: Int,
    // Назначенный тариф из сетки — если null, цена считается по tariffPerHour
    // (как в backend/src/modules/tariffs: flat vs grid), см. MockGuestRepository.quoteBooking.
    val tariffId: String? = null,
)

enum class BookingStatus { CONFIRMED, REDEEMED, CANCELLED, EXPIRED }

data class Booking(
    val id: String,
    val guestId: String,
    val stationId: String,
    val startAt: Instant,
    val minutesPaid: Int,
    val amountRub: Int,
    val code: String,
    var status: BookingStatus,
)

fun Booking.endAt(): Instant = startAt.plusSeconds(minutesPaid * 60L)

data class LoyaltyTier(val id: String, val name: String, val minHours: Int, val discountPercent: Int, val cashbackPercent: Int)

data class FaqEntry(val id: String, val question: String, val answer: String)

enum class ChatRole { GUEST, BOT, TYPING, ERROR }

data class ChatMessage(val role: ChatRole, val text: String)

enum class TicketStatus { OPEN, IN_PROGRESS, CLOSED }

data class SupportTicket(
    val id: String,
    val guestId: String,
    val question: String,
    val reason: String,
    var status: TicketStatus,
    val createdAt: Instant,
)

// Результат сборки контекста гостя для ИИ-агента — 1:1 повторяет
// backend/src/lib/supportContext.ts из полной версии бэкенда: код от двери
// присутствует в объекте, только если сейчас есть активная (redeemed) сессия.
// Это тот же принцип "жёсткое правило в коде, не на усмотрение модели".
data class GuestSupportContext(
    val name: String,
    val phone: String,
    val bonusPoints: Int,
    val balanceRub: Int,
    val tariffLabel: String,
    val activeSession: ActiveSessionInfo?,
    val nextBooking: NextBookingInfo?,
    val doorCode: DoorCodeInfo,
)

data class ActiveSessionInfo(val stationLabel: String, val endsAt: Instant)
data class NextBookingInfo(val stationLabel: String, val startAt: Instant)
sealed class DoorCodeInfo {
    data class Available(val code: String) : DoorCodeInfo()
    data class Unavailable(val reason: String) : DoorCodeInfo()
}
