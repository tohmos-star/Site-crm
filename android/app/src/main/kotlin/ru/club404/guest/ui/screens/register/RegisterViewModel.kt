package ru.club404.guest.ui.screens.register

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.GuestRepository

// Шаги 1:1 с frontend/register.html + register.js: intro (согласие) -> телефон
// -> пароль -> ФИО -> фото документа -> селфи -> анкета на проверке.
enum class RegisterStep { INTRO, PHONE, PASSWORD, FIO, DOC_PHOTO, SELFIE, PENDING }

data class RegisterUiState(
    val step: RegisterStep = RegisterStep.INTRO,
    val consentChecked: Boolean = false,
    val phone: String = "+7",
    val phoneError: String? = null,
    val password: String = "",
    val fio: String = "",
    val docPhoto: Bitmap? = null,
    val selfiePhoto: Bitmap? = null,
    val loading: Boolean = false,
    val error: String? = null,
)

class RegisterViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(RegisterUiState())
    val state: StateFlow<RegisterUiState> = _state.asStateFlow()

    fun onConsentChange(checked: Boolean) = _state.update { it.copy(consentChecked = checked) }
    fun startWizard() = _state.update { it.copy(step = RegisterStep.PHONE) }

    fun onPhoneChange(value: String) = _state.update { it.copy(phone = value, phoneError = null) }

    fun submitPhone() {
        val phone = _state.value.phone.trim()
        if (!Regex("^\\+7\\d{10}$").matches(phone)) {
            _state.update { it.copy(phoneError = "Хм, не похоже на номер 🤔 Формат: +79991234567 (11 цифр, начиная с +7)") }
            return
        }
        _state.update { it.copy(step = RegisterStep.PASSWORD) }
    }

    fun onPasswordChange(value: String) = _state.update { it.copy(password = value, error = null) }

    fun submitPassword() {
        if (_state.value.password.length < 6) {
            _state.update { it.copy(error = "Минимум 6 символов") }
            return
        }
        _state.update { it.copy(step = RegisterStep.FIO, error = null) }
    }

    fun onFioChange(value: String) = _state.update { it.copy(fio = value, error = null) }

    fun submitFio() {
        val fio = _state.value.fio.trim()
        if (fio.isBlank() || fio.split(" ").size < 2) {
            _state.update { it.copy(error = "Укажите ФИО полностью, как в документе") }
            return
        }
        _state.update { it.copy(step = RegisterStep.DOC_PHOTO, error = null) }
    }

    fun onDocPhotoTaken(bitmap: Bitmap) = _state.update { it.copy(docPhoto = bitmap) }
    fun submitDocPhoto() = _state.update { it.copy(step = RegisterStep.SELFIE) }

    fun onSelfiePhotoTaken(bitmap: Bitmap) = _state.update { it.copy(selfiePhoto = bitmap) }

    fun submitRegistration() {
        val s = _state.value
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            val result = repository.register(s.phone, s.password, s.fio)
            result.fold(
                onSuccess = { _state.update { it.copy(loading = false, step = RegisterStep.PENDING) } },
                // В отличие от сайта (который на любой ошибке всё равно показывает
                // экран ожидания — там это чисто демо-заглушка на случай сетевого
                // сбоя), настоящую ошибку валидации (например, телефон уже занят)
                // показываем гостю, а не притворяемся, что всё прошло успешно.
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message ?: "Не удалось отправить анкету") } },
            )
        }
    }
}
