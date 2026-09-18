package ru.club404.guest.ui.screens.booking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.Booking
import ru.club404.guest.data.BookingQuote
import ru.club404.guest.data.BookingStatus
import ru.club404.guest.data.GuestRepository
import ru.club404.guest.data.Station
import java.time.Instant
import java.time.temporal.ChronoUnit

// Быстрые пресеты вместо полноценного календаря-пикера даты/времени — сделано
// осознанно для первой версии (см. README модуля): бронь клуба обычно "прямо
// сейчас" или "через N часов", полный календарь — кандидат на следующий шаг.
val startOffsetOptions = listOf(10 to "Через 10 мин", 30 to "Через 30 мин", 60 to "Через 1 час", 180 to "Через 3 часа")
val durationOptions = listOf(30, 60, 120, 180)

data class BookingUiState(
    val stations: List<Station> = emptyList(),
    val selectedStationId: String? = null,
    val startOffsetMinutes: Int = 10,
    val durationMinutes: Int = 60,
    val quote: BookingQuote? = null,
    val myBookings: List<Booking> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,
)

class BookingViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(
        BookingUiState(stations = repository.stations, selectedStationId = repository.stations.firstOrNull()?.id)
    )
    val state: StateFlow<BookingUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.bookingsForCurrentGuest().collect { list ->
                _state.update { it.copy(myBookings = list) }
            }
        }
        refreshQuote()
    }

    fun selectStation(stationId: String) {
        _state.update { it.copy(selectedStationId = stationId, error = null) }
        refreshQuote()
    }

    fun selectStartOffset(minutes: Int) = _state.update { it.copy(startOffsetMinutes = minutes) }

    fun selectDuration(minutes: Int) {
        _state.update { it.copy(durationMinutes = minutes) }
        refreshQuote()
    }

    private fun refreshQuote() {
        val stationId = _state.value.selectedStationId ?: return
        viewModelScope.launch {
            val quote = repository.quoteBooking(stationId, _state.value.durationMinutes)
            _state.update { it.copy(quote = quote) }
        }
    }

    fun confirmBooking() {
        val s = _state.value
        val stationId = s.selectedStationId ?: return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, successMessage = null) }
            val startAt = Instant.now().plus(s.startOffsetMinutes.toLong(), ChronoUnit.MINUTES)
            val result = repository.createBooking(stationId, startAt, s.durationMinutes)
            result.fold(
                onSuccess = { booking ->
                    _state.update { it.copy(loading = false, successMessage = "Забронировано! Код: ${booking.code}") }
                },
                onFailure = { e ->
                    _state.update { it.copy(loading = false, error = e.message ?: "Не удалось забронировать") }
                },
            )
        }
    }

    fun cancelBooking(bookingId: String) {
        viewModelScope.launch {
            repository.cancelBooking(bookingId)
        }
    }

    fun isCancellable(booking: Booking) = booking.status == BookingStatus.CONFIRMED
}
