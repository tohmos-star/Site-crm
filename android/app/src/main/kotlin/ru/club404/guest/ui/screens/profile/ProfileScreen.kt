package ru.club404.guest.ui.screens.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.TicketStatus
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.viewModelWithRepo

@Composable
fun ProfileScreen(onLoggedOut: () -> Unit) {
    val viewModel = viewModelWithRepo(::ProfileViewModel)
    val state by viewModel.state.collectAsState()

    LaunchedEffect(state.loggedOut) {
        if (state.loggedOut) onLoggedOut()
    }

    val guest = state.guest ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("club.profile")
        Text(guest.fio, style = MaterialTheme.typography.titleLarge)
        Text(guest.phone, color = TextMuted, style = MaterialTheme.typography.bodyMedium)

        InfoCard {
            Text("Баланс: ${formatMoney(guest.balanceRub)}")
            Text("Бонусы: ${guest.bonusPoints}", color = Ok)
            if (state.tier != null) {
                Text("Статус лояльности: ${state.tier!!.name} (скидка ${state.tier!!.discountPercent}%, кэшбэк ${state.tier!!.cashbackPercent}%)")
            } else {
                Text("Статус лояльности: Новичок", color = TextMuted)
            }
        }

        if (state.tickets.isNotEmpty()) {
            Text("Мои обращения в поддержку", style = MaterialTheme.typography.titleMedium)
            state.tickets.forEach { ticket ->
                InfoCard {
                    Text(ticket.question, style = MaterialTheme.typography.bodyMedium)
                    Text(ticketStatusLabel(ticket.status), color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        OutlinedButton(onClick = viewModel::logout, modifier = Modifier.fillMaxWidth()) {
            Text("Выйти")
        }
    }
}

private fun ticketStatusLabel(status: TicketStatus): String = when (status) {
    TicketStatus.OPEN -> "открыт"
    TicketStatus.IN_PROGRESS -> "в работе"
    TicketStatus.CLOSED -> "закрыт"
}
