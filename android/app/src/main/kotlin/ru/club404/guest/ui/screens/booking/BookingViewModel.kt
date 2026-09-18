package ru.club404.guest.ui.screens.booking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.Booking
import ru.club404.guest.data.BookingQuote
import ru.club404.guest.data.BookingStatus
import ru.club404.guest.data.GuestRepository
import ru.club404.guest.data.Station
import ru.club404.guest.data.Zone
import java.time.Instant
import java.time.temporal.ChronoUnit

// Как в frontend/js/booking.js: ROOM_LABELS для подписи под кнопкой места.
val roomLabels = mapOf("duo-1" to "DUO 1", "duo-2" to "DUO 2", "solo-1" to "SOLO", "solo-plus" to "SOLO+")

// Пресеты для быстрого выбора длительности в виджете сессии (SessionWidget) —
// там нет разделения на "почасовой"/"пакеты", просто 1ч/3ч/6ч в одном списке.
val durationPresets = listOf(60 to "1 час", 180 to "3 часа", 360 to "6 часов")

// Только пакеты для вкладки "Пакеты времени" на экране бронирования —
// 1ч туда не входит, это уже "почасовой тариф" (см. LANGAME-скриншоты).
val packagePresets = listOf(180 to "3 часа", 360 to "6 часов")

const val DURATION_STEP_MINUTES = 10
const val MIN_DURATION_MINUTES = 10

enum class TariffMode { HOURLY, PACKAGE }

data class BookingUiState(
    val stations: List<Station> = emptyList(),
    val zones: List<Zone> = emptyList(),
    val guestBalance: Int = 0,
    val guestBonusPoints: Int = 0,
    val selectedStationId: String? = null,
    val startAt: Instant? = null,
    val tariffMode: TariffMode = TariffMode.HOURLY,
    val durationMinutes: Int = 60,
    val quote: BookingQuote? = null,
    val myBookings: List<Booking> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
    val completedBooking: Booking? = null,
    // Отдельный шаг "Подтверди бронирование" (время + место + сумма + бонусы)
    // перед списанием денег — как на LANGAME-скриншотах, вместо одной кнопки
    // "Забронировать и оплатить" сразу на форме выбора.
    val pendingConfirmation: Boolean = false,
    val useBonus: Boolean = false,
)

class BookingViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(BookingUiState(stations = repository.stations, zones = repository.zones))
    val state: StateFlow<BookingUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            combine(repository.currentGuest, repository.bookingsForCurrentGuest()) { guest, bookings -> guest to bookings }
                .collect { (guest, bookings) ->
                    _state.update {
                        it.copy(
                            guestBalance = guest?.balanceRub ?: 0,
                            guestBonusPoints = guest?.bonusPoints ?: 0,
                            myBookings = bookings.filter { b -> b.status == BookingStatus.CONFIRMED || b.status == BookingStatus.REDEEMED },
                        )
                    }
                }
        }
    }

    fun selectStation(stationId: String) {
        _state.update { it.copy(selectedStationId = stationId, error = null) }
        refreshQuote()
    }

    fun setStartAt(instant: Instant) {
        _state.update { it.copy(startAt = instant, error = null) }
        refreshQuote()
    }

    fun setTariffMode(mode: TariffMode) {
        _state.update {
            it.copy(tariffMode = mode, durationMinutes = if (mode == TariffMode.PACKAGE) 180 else 60)
        }
        refreshQuote()
    }

    fun setDurationMinutes(minutes: Int) {
        _state.update { it.copy(durationMinutes = maxOf(MIN_DURATION_MINUTES, minutes)) }
        refreshQuote()
    }

    fun toggleUseBonus() {
        _state.update { it.copy(useBonus = !it.useBonus) }
    }

    private fun refreshQuote() {
        val stationId = _state.value.selectedStationId ?: return
        viewModelScope.launch {
            val quote = repository.quoteBooking(stationId, _state.value.durationMinutes)
            _state.update { it.copy(quote = quote) }
        }
    }

    fun proceedToConfirmation() {
        val s = _state.value
        if (s.selectedStationId == null) return
        if (s.startAt == null) {
            _state.update { it.copy(error = "Укажите дату и время.") }
            return
        }
        if (s.startAt.isBefore(Instant.now().plus(5, ChronoUnit.MINUTES))) {
            _state.update { it.copy(error = "Бронь должна начинаться минимум через 5 минут от текущего момента.") }
            return
        }
        _state.update { it.copy(pendingConfirmation = true, error = null) }
    }

    fun cancelConfirmation() {
        _state.update { it.copy(pendingConfirmation = false, error = null) }
    }

    fun confirmBooking() {
        val s = _state.value
        val stationId = s.selectedStationId ?: return
        val startAt = s.startAt ?: return
        val bonusToRedeem = if (s.useBonus) minOf(s.guestBonusPoints, s.quote?.amountRub ?: 0) else 0
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            val result = repository.createBooking(stationId, startAt, s.durationMinutes, bonusToRedeem)
            result.fold(
                onSuccess = { booking -> _state.update { it.copy(loading = false, completedBooking = booking, pendingConfirmation = false) } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message ?: "Не удалось забронировать.", pendingConfirmation = false) } },
            )
        }
    }

    fun bookAnother() {
        _state.update {
            it.copy(
                completedBooking = null,
                selectedStationId = null,
                startAt = null,
                tariffMode = TariffMode.HOURLY,
                durationMinutes = 60,
                quote = null,
                error = null,
                pendingConfirmation = false,
                useBonus = false,
            )
        }
    }

    fun cancelBooking(bookingId: String) {
        viewModelScope.launch { repository.cancelBooking(bookingId) }
    }
}
