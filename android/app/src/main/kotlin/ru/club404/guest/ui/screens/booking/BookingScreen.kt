package ru.club404.guest.ui.screens.booking

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.Booking
import ru.club404.guest.data.BookingStatus
import ru.club404.guest.data.endAt
import ru.club404.guest.data.formatDateTime
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.viewModelWithRepo

@Composable
fun BookingScreen() {
    val viewModel = viewModelWithRepo(::BookingViewModel)
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("club.booking")
        Text("Забронировать место", style = MaterialTheme.typography.titleLarge)

        Text("Место", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.stations) { station ->
                FilterChip(
                    selected = station.id == state.selectedStationId,
                    onClick = { viewModel.selectStation(station.id) },
                    label = { Text(station.label) },
                )
            }
        }

        Text("Начало", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(startOffsetOptions) { (minutes, label) ->
                FilterChip(
                    selected = minutes == state.startOffsetMinutes,
                    onClick = { viewModel.selectStartOffset(minutes) },
                    label = { Text(label) },
                )
            }
        }

        Text("Длительность", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(durationOptions) { minutes ->
                FilterChip(
                    selected = minutes == state.durationMinutes,
                    onClick = { viewModel.selectDuration(minutes) },
                    label = { Text("$minutes мин") },
                )
            }
        }

        state.quote?.let { quote ->
            InfoCard {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Стоимость", color = TextMuted)
                    Column(horizontalAlignment = Alignment.End) {
                        if (quote.discountPercent > 0) {
                            Text(formatMoney(quote.baseAmountRub), color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                        }
                        Text(formatMoney(quote.amountRub), style = MaterialTheme.typography.titleMedium)
                    }
                }
                if (quote.discountPercent > 0) {
                    Text("Скидка по лояльности: ${quote.discountPercent}%", color = Ok, style = MaterialTheme.typography.bodyMedium)
                }
                if (quote.cashbackRub > 0) {
                    Text("Кэшбэк бонусами: +${quote.cashbackRub}", color = Ok, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        state.error?.let { StatusBanner(it, StatusKind.ERROR) }
        state.successMessage?.let { StatusBanner(it, StatusKind.OK) }

        Button(onClick = viewModel::confirmBooking, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
            Text(if (state.loading) "Бронируем…" else "Забронировать")
        }

        HorizontalDivider()

        Text("Мои брони", style = MaterialTheme.typography.titleMedium)
        if (state.myBookings.isEmpty()) {
            Text("Пока нет броней", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        }
        state.myBookings.forEach { booking ->
            BookingRow(booking = booking, stationLabel = state.stations.firstOrNull { it.id == booking.stationId }?.label ?: "—", onCancel = { viewModel.cancelBooking(booking.id) }, cancellable = viewModel.isCancellable(booking))
        }
    }
}

@Composable
private fun BookingRow(booking: Booking, stationLabel: String, onCancel: () -> Unit, cancellable: Boolean) {
    InfoCard {
        Text(stationLabel, style = MaterialTheme.typography.titleMedium)
        Text("${formatDateTime(booking.startAt)} — ${formatDateTime(booking.endAt())}", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        Text("Код: ${booking.code} · ${formatMoney(booking.amountRub)} · ${statusLabel(booking.status)}", style = MaterialTheme.typography.bodyMedium)
        if (cancellable) {
            OutlinedButton(onClick = onCancel) { Text("Отменить") }
        }
    }
}

private fun statusLabel(status: BookingStatus): String = when (status) {
    BookingStatus.CONFIRMED -> "подтверждена"
    BookingStatus.REDEEMED -> "активна"
    BookingStatus.CANCELLED -> "отменена"
    BookingStatus.EXPIRED -> "истекла"
}
