package ru.club404.guest.ui.screens.balance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.Guest
import ru.club404.guest.data.GuestRepository

val topUpPresets = listOf(500, 1000, 2000, 5000)

data class BalanceUiState(
    val guest: Guest? = null,
    val topUpAmountText: String = "1000",
    val refundAmountText: String = "",
    val refundReason: String = "",
    val loading: Boolean = false,
    val message: String? = null,
    val error: String? = null,
)

class BalanceViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(BalanceUiState())
    val state: StateFlow<BalanceUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.currentGuest.collect { guest -> _state.update { it.copy(guest = guest) } }
        }
    }

    fun setTopUpAmount(text: String) = _state.update { it.copy(topUpAmountText = text.filter { c -> c.isDigit() }, message = null, error = null) }
    fun setRefundAmount(text: String) = _state.update { it.copy(refundAmountText = text.filter { c -> c.isDigit() }, message = null, error = null) }
    fun setRefundReason(text: String) = _state.update { it.copy(refundReason = text, message = null, error = null) }

    fun topUp() {
        val amount = _state.value.topUpAmountText.toIntOrNull()
        if (amount == null || amount < 50) {
            _state.update { it.copy(error = "Минимальная сумма пополнения — 50 ₽") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, message = null) }
            val result = repository.topUp(amount)
            result.fold(
                onSuccess = { _state.update { it.copy(loading = false, message = "Баланс пополнен на $amount ₽") } },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message ?: "Не удалось пополнить") } },
            )
        }
    }

    fun requestRefund() {
        val amount = _state.value.refundAmountText.toIntOrNull()
        if (amount == null || amount <= 0) {
            _state.update { it.copy(error = "Укажите сумму возврата") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null, message = null) }
            val result = repository.requestRefund(amount, _state.value.refundReason)
            result.fold(
                onSuccess = {
                    _state.update { it.copy(loading = false, message = "Заявка на возврат отправлена — решение придёт от персонала клуба", refundAmountText = "", refundReason = "") }
                },
                onFailure = { e -> _state.update { it.copy(loading = false, error = e.message ?: "Не удалось отправить заявку") } },
            )
        }
    }
}
