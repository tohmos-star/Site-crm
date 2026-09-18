package ru.club404.guest.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import ru.club404.guest.data.Booking
import ru.club404.guest.data.DoorCodeInfo
import ru.club404.guest.data.Guest
import ru.club404.guest.data.GuestRepository
import ru.club404.guest.data.Station

data class HomeUiState(
    val guest: Guest? = null,
    val activeBooking: Booking? = null,
    val activeStation: Station? = null,
    val nextBooking: Booking? = null,
    val nextStation: Station? = null,
    val doorCode: DoorCodeInfo? = null,
)

class HomeViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            combine(repository.currentGuest, repository.bookingsForCurrentGuest()) { guest, _ -> guest }
                .collect { guest ->
                    val active = repository.activeBooking()
                    val next = repository.nextUpcomingBooking()
                    _state.value = HomeUiState(
                        guest = guest,
                        activeBooking = active,
                        activeStation = active?.let { b -> repository.stations.firstOrNull { it.id == b.stationId } },
                        nextBooking = next,
                        nextStation = next?.let { b -> repository.stations.firstOrNull { it.id == b.stationId } },
                        doorCode = guest?.let { repository.buildSupportContext().doorCode },
                    )
                }
        }
    }

    fun logout() = repository.logout()
}
