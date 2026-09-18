package ru.club404.guest.ui.screens.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
    onOpenEndSession: () -> Unit,
    onOpenPrices: () -> Unit,
    onOpenPromotions: () -> Unit,
    onOpenClubInfo: () -> Unit,
    onOpenClubEntry: () -> Unit,
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

        // Виджет станции на телефоне гостя — аналог frontend/pc-widget.html.
        SessionWidget(
            guestBalance = guest.balanceRub,
            activeBooking = state.activeBooking,
            activeStation = state.activeStation,
            nextBooking = state.nextBooking,
            nextStation = state.nextStation,
            doorCode = state.doorCode,
            onOpenBalance = onOpenBalance,
            onOpenSupport = onOpenSupport,
            onOpenEndSession = onOpenEndSession,
        )

        // Порядок как в MEMBER_PRIMARY на сайте (frontend/js/layout.js):
        // "Войти в клуб" перед "Забронировать".
        Button(onClick = onOpenClubEntry, modifier = Modifier.fillMaxWidth()) { Text("Войти в клуб") }
        Button(onClick = onOpenBooking, modifier = Modifier.fillMaxWidth()) { Text("Забронировать") }

        InfoCard {
            MenuRow("Цены и тарифы", onOpenPrices)
            HorizontalDivider()
            MenuRow("Акции", onOpenPromotions)
            HorizontalDivider()
            MenuRow("О клубе", onOpenClubInfo)
        }
    }
}

@Composable
private fun MenuRow(title: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.bodyLarge)
        Text("›", color = TextMuted, style = MaterialTheme.typography.titleMedium)
    }
}
