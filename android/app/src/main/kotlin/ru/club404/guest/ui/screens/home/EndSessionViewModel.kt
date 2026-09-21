package ru.club404.guest.ui.screens.home

import android.graphics.Bitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.GuestRepository

// Чек-лист + фото — как frontend/report.html: подтверждение чистоты места
// перед фактическим завершением сессии (карШеринг-стиль "закрыть поездку").
data class EndSessionUiState(
    val checkDesk: Boolean = false,
    val checkPc: Boolean = false,
    val checkHeadset: Boolean = false,
    val photo0: Bitmap? = null,
    val photo1: Bitmap? = null,
    val photo2: Bitmap? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val done: Boolean = false,
) {
    val checklistComplete get() = checkDesk && checkPc && checkHeadset
    val photosComplete get() = photo0 != null && photo1 != null
    val canSubmit get() = checklistComplete && photosComplete && !loading
}

class EndSessionViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(EndSessionUiState())
    val state: StateFlow<EndSessionUiState> = _state.asStateFlow()

    fun onCheckDeskChange(v: Boolean) = _state.update { it.copy(checkDesk = v) }
    fun onCheckPcChange(v: Boolean) = _state.update { it.copy(checkPc = v) }
    fun onCheckHeadsetChange(v: Boolean) = _state.update { it.copy(checkHeadset = v) }
    fun onPhoto0Taken(bitmap: Bitmap) = _state.update { it.copy(photo0 = bitmap) }
    fun onPhoto1Taken(bitmap: Bitmap) = _state.update { it.copy(photo1 = bitmap) }
    fun onPhoto2Taken(bitmap: Bitmap) = _state.update { it.copy(photo2 = bitmap) }

    fun submit() {
        if (!_state.value.canSubmit) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            val s = _state.value
            val result = repository.endActiveSessionWithReport(
                cleanDesk = s.checkDesk,
                cleanPc = s.checkPc,
                cleanHeadset = s.checkHeadset,
                photos = listOfNotNull(s.photo0, s.photo1, s.photo2),
            )
            result.fold(
                onSuccess = { _state.update { it.copy(loading = false, done = true) } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message ?: "Не удалось отправить отчёт") } },
            )
        }
    }
}
