package ru.club404.guest.ui.screens.support

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.ChatRole
import ru.club404.guest.ui.components.ChatBubble
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.viewModelWithRepo

@Composable
fun SupportChatScreen() {
    val viewModel = viewModelWithRepo(::SupportChatViewModel)
    val state by viewModel.state.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.size - 1)
    }

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp)) {
        SectionKicker("club.support")
        Text("ИИ-агент поддержки", style = MaterialTheme.typography.titleLarge)
        Text(
            "Видит ваш тариф, статус сессии и бонусы. Если не сможет помочь — передаст вопрос живому саппорту.",
            style = MaterialTheme.typography.bodyMedium,
        )

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth().padding(vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(state.messages) { message ->
                val arrangement = if (message.role == ChatRole.GUEST) Arrangement.End else Arrangement.Start
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = arrangement) {
                    ChatBubble(message = message, modifier = Modifier.widthIn(max = 280.dp))
                }
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = state.input,
                onValueChange = viewModel::onInputChange,
                placeholder = { Text("Написать агенту…") },
                modifier = Modifier.weight(1f),
                singleLine = true,
            )
            IconButton(onClick = viewModel::send) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Отправить")
            }
        }
    }
}
