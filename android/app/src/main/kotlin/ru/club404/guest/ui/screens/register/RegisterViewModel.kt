package ru.club404.guest.ui.screens.register

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.GuestRepository

data class RegisterUiState(
    val phone: String = "+7",
    val password: String = "",
    val fio: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val registered: Boolean = false,
)

class RegisterViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(RegisterUiState())
    val state: StateFlow<RegisterUiState> = _state.asStateFlow()

    fun onPhoneChange(v: String) = _state.update { it.copy(phone = v, error = null) }
    fun onPasswordChange(v: String) = _state.update { it.copy(password = v, error = null) }
    fun onFioChange(v: String) = _state.update { it.copy(fio = v, error = null) }

    fun submit() {
        val s = _state.value
        if (s.phone.isBlank() || s.password.length < 4 || s.fio.isBlank()) {
            _state.update { it.copy(error = "Заполните ФИО, телефон и пароль (минимум 4 символа)") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            val result = repository.register(s.phone, s.password, s.fio)
            result.fold(
                onSuccess = { _state.update { it.copy(loading = false, registered = true) } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message ?: "Не удалось зарегистрироваться") } },
            )
        }
    }
}
