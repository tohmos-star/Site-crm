package ru.club404.guest.ui.screens.support

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import ru.club404.guest.data.ChatMessage
import ru.club404.guest.data.ChatRole
import ru.club404.guest.data.GuestRepository

data class SupportChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val input: String = "",
    val sending: Boolean = false,
)

class SupportChatViewModel(private val repository: GuestRepository) : ViewModel() {

    private val _state = MutableStateFlow(
        SupportChatUiState(
            messages = listOf(
                ChatMessage(ChatRole.BOT, "Здравствуйте! Спросите про тариф, бонусы, бронирование или код на дверь — отвечу на основе ваших данных."),
            )
        )
    )
    val state: StateFlow<SupportChatUiState> = _state.asStateFlow()

    // История для контекста LLM — без служебных TYPING/ERROR сообщений.
    private val history = mutableListOf<ChatMessage>()

    fun onInputChange(value: String) = _state.update { it.copy(input = value) }

    fun send() {
        val text = _state.value.input.trim()
        if (text.isBlank() || _state.value.sending) return

        _state.update {
            it.copy(
                messages = it.messages + ChatMessage(ChatRole.GUEST, text) + ChatMessage(ChatRole.TYPING, "печатает…"),
                input = "",
                sending = true,
            )
        }

        viewModelScope.launch {
            val reply = repository.sendSupportMessage(text, history)
            history += ChatMessage(ChatRole.GUEST, text)
            history += reply
            _state.update {
                it.copy(
                    messages = it.messages.dropLast(1) + reply,
                    sending = false,
                )
            }
        }
    }
}
