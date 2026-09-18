package ru.club404.guest.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.Guest
import ru.club404.guest.data.GuestRepository
import ru.club404.guest.data.LoyaltyTier
import ru.club404.guest.data.SupportTicket

data class ProfileUiState(
    val guest: Guest? = null,
    val tier: LoyaltyTier? = null,
    val tickets: List<SupportTicket> = emptyList(),
    val loggedOut: Boolean = false,
)

class ProfileViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.currentGuest.collect { guest ->
                _state.update {
                    it.copy(
                        guest = guest,
                        tier = guest?.loyaltyTierId?.let { id -> repository.loyaltyTiers.firstOrNull { t -> t.id == id } },
                        tickets = repository.ticketsForCurrentGuest(),
                    )
                }
            }
        }
    }

    fun logout() {
        repository.logout()
        _state.update { ProfileUiState(loggedOut = true) }
    }
}
