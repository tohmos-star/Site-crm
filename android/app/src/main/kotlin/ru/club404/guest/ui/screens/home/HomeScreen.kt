package ru.club404.guest.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.DoorCodeInfo
import ru.club404.guest.data.endAt
import ru.club404.guest.data.formatDateTime
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.viewModelWithRepo

@Composable
fun HomeScreen(
    onOpenBooking: () -> Unit,
    onOpenBalance: () -> Unit,
    onOpenSupport: () -> Unit,
    onOpenPrices: () -> Unit,
    onOpenPromotions: () -> Unit,
    onOpenClubInfo: () -> Unit,
) {
    val viewModel = viewModelWithRepo(::HomeViewModel)
    val state by viewModel.state.collectAsState()
    val guest = state.guest ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column {
            SectionKicker("club.home")
            Text(guest.fio, style = MaterialTheme.typography.titleLarge)
        }

        InfoCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Баланс", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    Text(formatMoney(guest.balanceRub), style = MaterialTheme.typography.titleMedium)
                }
                Column {
                    Text("Бонусы", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    Text("${guest.bonusPoints}", style = MaterialTheme.typography.titleMedium, color = Ok)
                }
            }
        }

        if (state.activeBooking != null) {
            InfoCard {
                Text("Сессия активна сейчас", color = Ok, style = MaterialTheme.typography.labelLarge)
                Text("Место: ${state.activeStation?.label ?: "—"}", style = MaterialTheme.typography.bodyMedium)
                Text("До ${formatDateTime(state.activeBooking!!.endAt())}", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
                val code = state.doorCode
                if (code is DoorCodeInfo.Available) {
                    Spacer(Modifier.height(4.dp))
                    Text("Код от двери", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    Text(code.code, style = MaterialTheme.typography.titleLarge, color = Ok)
                }
            }
        } else if (state.nextBooking != null) {
            InfoCard {
                Text("Ближайшая бронь", color = TextMuted, style = MaterialTheme.typography.labelLarge)
                Text("Место: ${state.nextStation?.label ?: "—"}", style = MaterialTheme.typography.bodyMedium)
                Text(formatDateTime(state.nextBooking!!.startAt), style = MaterialTheme.typography.bodyMedium, color = TextMuted)
                Text("Код появится, когда сессия станет активной", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
            }
        } else {
            InfoCard {
                Text("Активной сессии и броней нет", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = onOpenBooking, modifier = Modifier.fillMaxWidth()) { Text("Забронировать") }
            OutlinedButton(onClick = onOpenBalance, modifier = Modifier.fillMaxWidth()) { Text("Пополнить баланс") }
            OutlinedButton(onClick = onOpenSupport, modifier = Modifier.fillMaxWidth()) { Text("Тех.поддержка") }
        }

        HorizontalDivider()

        TextButton(onClick = onOpenPrices, modifier = Modifier.fillMaxWidth()) { Text("Цены и тарифы") }
        TextButton(onClick = onOpenPromotions, modifier = Modifier.fillMaxWidth()) { Text("Акции") }
        TextButton(onClick = onOpenClubInfo, modifier = Modifier.fillMaxWidth()) { Text("О клубе") }
    }
}
