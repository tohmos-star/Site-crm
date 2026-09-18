package ru.club404.guest.ui.screens.entry

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.GuestRepository

data class EntryUiState(
    val phone: String = "+7",
    val password: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val loggedIn: Boolean = false,
)

class EntryViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(EntryUiState())
    val state: StateFlow<EntryUiState> = _state.asStateFlow()

    fun onPhoneChange(value: String) = _state.update { it.copy(phone = value, error = null) }
    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, error = null) }

    fun submit() {
        val s = _state.value
        if (s.phone.isBlank() || s.password.isBlank()) {
            _state.update { it.copy(error = "Заполните телефон и пароль") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            val result = repository.login(s.phone, s.password)
            result.fold(
                onSuccess = { _state.update { it.copy(loading = false, loggedIn = true) } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message ?: "Не удалось войти") } },
            )
        }
    }
}
