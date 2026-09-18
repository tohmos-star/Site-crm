package ru.club404.guest.ui.screens.booking

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import ru.club404.guest.data.Booking
import ru.club404.guest.data.formatDateTime
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.theme.Accent
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.viewModelWithRepo
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingScreen(onOpenBalance: () -> Unit) {
    val viewModel = viewModelWithRepo(::BookingViewModel)
    val state by viewModel.state.collectAsState()

    val completed = state.completedBooking
    if (completed != null) {
        BookingCodeScreen(completed, onBookAnother = viewModel::bookAnother)
        return
    }

    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var pickedDate by remember { mutableStateOf<LocalDate?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("club.booking")
        Text("Забронировать место", style = MaterialTheme.typography.titleLarge)

        InfoCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Баланс", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    Text(formatMoney(state.guestBalance), style = MaterialTheme.typography.titleMedium)
                }
                TextButton(onClick = onOpenBalance) { Text("Пополнить") }
            }
        }

        InfoCard {
            SectionLabel("1. Место")
            Text(
                "Оплата сразу с баланса, ПК включится сам за 5 минут до начала.",
                color = TextMuted, style = MaterialTheme.typography.bodyMedium,
            )
            // Всего 6 станций в моке — обычный Column/Row из чанков по 3, без Lazy*
            // и без ручного подсчёта высоты, который понадобился бы для LazyVerticalGrid
            // внутри уже прокручиваемой колонки.
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                state.stations.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        row.forEach { station ->
                            StationCell(
                                label = station.label,
                                room = roomLabels[station.room] ?: station.room,
                                tariffPerHour = station.tariffPerHour,
                                selected = station.id == state.selectedStationId,
                                onClick = { viewModel.selectStation(station.id) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }

        if (state.selectedStationId != null) {
            InfoCard {
                SectionLabel("2. Время")

                OutlinedButton(
                    onClick = { showDatePicker = true },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                ) {
                    Text(
                        state.startAt?.let { formatDateTime(it) } ?: "Выбрать дату и время",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }

                Text("Длительность", color = TextMuted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    durationPresets.forEach { (minutes, label) ->
                        FilterChip(
                            selected = minutes == state.durationMinutes,
                            onClick = { viewModel.setDurationMinutes(minutes) },
                            label = { Text(label) },
                        )
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                ) {
                    OutlinedButton(onClick = { viewModel.setDurationMinutes(state.durationMinutes - DURATION_STEP_MINUTES) }) { Text("−") }
                    Text(
                        "${state.durationMinutes} мин",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                    )
                    OutlinedButton(onClick = { viewModel.setDurationMinutes(state.durationMinutes + DURATION_STEP_MINUTES) }) { Text("+") }
                }

                state.quote?.let { quote ->
                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Итого", style = MaterialTheme.typography.bodyMedium)
                        Text(formatMoney(quote.amountRub), style = MaterialTheme.typography.titleMedium)
                    }
                    if (quote.discountPercent > 0) {
                        Text("Скидка по лояльности: ${quote.discountPercent}%", color = Ok, style = MaterialTheme.typography.bodyMedium)
                    }
                }

                state.error?.let { StatusBanner(it, StatusKind.ERROR) }

                Button(
                    onClick = viewModel::confirmBooking,
                    enabled = !state.loading,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                ) {
                    Text(if (state.loading) "Бронируем…" else "Забронировать и оплатить")
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionLabel("Мои брони")
            if (state.myBookings.isEmpty()) {
                Text("Пока нет предстоящих броней.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
            state.myBookings.forEach { booking ->
                MyBookingRow(
                    booking = booking,
                    stationLabel = state.stations.firstOrNull { it.id == booking.stationId }?.label ?: "—",
                    onCancel = { viewModel.cancelBooking(booking.id) },
                )
            }
        }
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = System.currentTimeMillis())
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val millis = datePickerState.selectedDateMillis
                    if (millis != null) {
                        pickedDate = Instant.ofEpochMilli(millis).atZone(ZoneId.of("UTC")).toLocalDate()
                    }
                    showDatePicker = false
                    showTimePicker = true
                }) { Text("Далее") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Отмена") } },
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showTimePicker) {
        val timePickerState = rememberTimePickerState(initialHour = 12, initialMinute = 0, is24Hour = true)
        TimePickerDialog(
            onDismiss = { showTimePicker = false },
            onConfirm = {
                val date = pickedDate
                if (date != null) {
                    val localDateTime = date.atTime(LocalTime.of(timePickerState.hour, timePickerState.minute))
                    viewModel.setStartAt(localDateTime.atZone(ZoneId.systemDefault()).toInstant())
                }
                showTimePicker = false
            },
        ) {
            TimePicker(state = timePickerState)
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium)
}

@Composable
private fun StationCell(
    label: String,
    room: String,
    tariffPerHour: Int,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text(label, style = MaterialTheme.typography.bodyMedium)
                Text("$room · $tariffPerHour ₽/ч", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
        },
        modifier = modifier,
    )
}

@Composable
private fun BookingCodeScreen(booking: Booking, onBookAnother: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SectionKicker("club.booking")
        InfoCard {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text("Код для входа на ПК при приходе", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Text(booking.code, style = MaterialTheme.typography.titleLarge, color = Accent)
                Text(
                    "ПК включится сам за 5 минут до начала брони. Код действует до конца оплаченного времени.",
                    color = TextMuted, style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        OutlinedButton(onClick = onBookAnother, modifier = Modifier.fillMaxWidth()) { Text("Забронировать ещё") }
    }
}

@Composable
private fun MyBookingRow(booking: Booking, stationLabel: String, onCancel: () -> Unit) {
    InfoCard {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column {
                Text("$stationLabel · ${booking.code}", style = MaterialTheme.typography.bodyMedium)
                Text(
                    "${formatDateTime(booking.startAt)} · ${booking.minutesPaid} мин · ${formatMoney(booking.amountRub)}",
                    color = TextMuted, style = MaterialTheme.typography.bodyMedium,
                )
            }
            TextButton(onClick = onCancel) { Text("Отменить") }
        }
    }
}

@Composable
private fun TimePickerDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
    content: @Composable () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = MaterialTheme.shapes.extraLarge) {
            Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                content()
                Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
                    TextButton(onClick = onDismiss) { Text("Отмена") }
                    TextButton(onClick = onConfirm) { Text("ОК") }
                }
            }
        }
    }
}
