package ru.club404.guest.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.launch
import ru.club404.guest.data.Booking
import ru.club404.guest.data.BookingQuote
import ru.club404.guest.data.DoorCodeInfo
import ru.club404.guest.data.Station
import ru.club404.guest.data.endAt
import ru.club404.guest.data.formatDateTime
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.rememberGuestRepository
import ru.club404.guest.ui.screens.booking.durationPresets
import ru.club404.guest.ui.screens.booking.roomLabels
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted

// Гостевой аналог frontend/pc-widget.html прямо в приложении — те же 4 действия,
// что попросили перенести, минус "Перезагрузить" (это действие имеет смысл
// только с самой станции, не с телефона гостя).
//
// "Начать сессию" — сценарий 1 (гость без брони): выбор свободного места
// прямо сейчас, без ввода кода — телефон тут и есть виджет. Сценарий 2
// (гость с бронью) сюда не подмешан: код по-прежнему вводится на самой
// станции (redeemCode() в GuestRepository существует для этого, но не
// вызывается из UI приложения — см. android/README.md).
@Composable
fun SessionWidget(
    guestBalance: Int,
    activeBooking: Booking?,
    activeStation: Station?,
    nextBooking: Booking?,
    nextStation: Station?,
    doorCode: DoorCodeInfo?,
    onOpenBalance: () -> Unit,
    onOpenSupport: () -> Unit,
    onOpenEndSession: () -> Unit,
) {
    var showExtendDialog by remember { mutableStateOf(false) }
    var showWalkInDialog by remember { mutableStateOf(false) }

    InfoCard {
        when {
            activeBooking != null -> {
                Text("Сессия активна сейчас", color = Ok, style = MaterialTheme.typography.labelLarge)
                Text("Место: ${activeStation?.label ?: "—"}", style = MaterialTheme.typography.bodyMedium)
                Text("До ${formatDateTime(activeBooking.endAt())}", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                if (doorCode is DoorCodeInfo.Available) {
                    Spacer(Modifier.height(4.dp))
                    Text("Код от двери", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    Text(doorCode.code, style = MaterialTheme.typography.titleLarge, color = Ok)
                }
            }
            nextBooking != null -> {
                Text("Ближайшая бронь", color = TextMuted, style = MaterialTheme.typography.labelLarge)
                Text("Место: ${nextStation?.label ?: "—"}", style = MaterialTheme.typography.bodyMedium)
                Text(formatDateTime(nextBooking.startAt), color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Text("Код от неё вводится на самой станции при приходе.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(4.dp))
                Text("Код брони", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Text(nextBooking.code, style = MaterialTheme.typography.titleLarge, color = Ok)
            }
            else -> {
                Text("Активной сессии и броней нет", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
        }

        Spacer(Modifier.height(6.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            if (activeBooking != null) {
                Button(onClick = { showExtendDialog = true }, modifier = Modifier.weight(1f)) { Text("Продлить") }
            } else {
                Button(onClick = { showWalkInDialog = true }, modifier = Modifier.weight(1f)) { Text("Начать сессию") }
            }
            OutlinedButton(onClick = onOpenBalance, modifier = Modifier.weight(1f)) { Text("Баланс") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            OutlinedButton(onClick = onOpenEndSession, enabled = activeBooking != null, modifier = Modifier.weight(1f)) { Text("Завершить") }
            OutlinedButton(onClick = onOpenSupport, modifier = Modifier.weight(1f)) { Text("Поддержка") }
        }
    }

    if (showExtendDialog && activeStation != null) {
        ExtendSessionDialog(
            guestBalance = guestBalance,
            hourlyTariff = activeStation.tariffPerHour,
            onDismiss = { showExtendDialog = false },
        )
    }

    if (showWalkInDialog) {
        WalkInDialog(onDismiss = { showWalkInDialog = false })
    }
}

// Пакеты 3ч/6ч (6ч со скидкой 12%) + поминутный шаг — 1:1 с PACKAGES()/
// minutePrice() в pc-widget.html, только без ребута (см. комментарий выше).
private data class ExtendPackage(val label: String, val minutes: Int, val priceRub: Int)

private fun packagesFor(hourlyTariff: Int) = listOf(
    ExtendPackage("3 часа", 180, Math.round(hourlyTariff * 3f)),
    ExtendPackage("6 часов", 360, Math.round(hourlyTariff * 6f * 0.88f)),
)

private const val EXTEND_STEP_MINUTES = 10

@Composable
private fun ExtendSessionDialog(
    guestBalance: Int,
    hourlyTariff: Int,
    onDismiss: () -> Unit,
) {
    val repository = rememberGuestRepository()
    val scope = rememberCoroutineScope()
    var stepMinutes by remember { mutableStateOf(30) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val stepPrice = Math.round(hourlyTariff * (stepMinutes / 60f))

    fun confirm(minutes: Int, priceRub: Int) {
        loading = true
        error = null
        scope.launch {
            val result = repository.extendActiveSession(minutes, priceRub)
            loading = false
            result.fold(onSuccess = { onDismiss() }, onFailure = { e -> error = e.message })
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        InfoCard {
            Text("Продлить время", style = MaterialTheme.typography.titleMedium)
            Text("Баланс: ${formatMoney(guestBalance)} · тариф $hourlyTariff ₽/ч", color = TextMuted, style = MaterialTheme.typography.bodyMedium)

            Text("Пакеты", color = TextMuted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                packagesFor(hourlyTariff).forEach { pkg ->
                    val affordable = guestBalance >= pkg.priceRub
                    OutlinedButton(
                        onClick = { confirm(pkg.minutes, pkg.priceRub) },
                        enabled = affordable && !loading,
                        modifier = Modifier.weight(1f),
                    ) {
                        Column {
                            Text(pkg.label, style = MaterialTheme.typography.bodyMedium)
                            Text(formatMoney(pkg.priceRub), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            Text("Поминутно · шаг $EXTEND_STEP_MINUTES мин", color = TextMuted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = { stepMinutes = maxOf(EXTEND_STEP_MINUTES, stepMinutes - EXTEND_STEP_MINUTES) }) { Text("−") }
                Column(modifier = Modifier.weight(1f)) {
                    Text("$stepMinutes мин", style = MaterialTheme.typography.bodyMedium)
                    Text(formatMoney(stepPrice), color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                }
                OutlinedButton(onClick = { stepMinutes += EXTEND_STEP_MINUTES }) { Text("+") }
            }

            error?.let { StatusBanner(it, StatusKind.ERROR) }

            Button(
                onClick = { confirm(stepMinutes, stepPrice) },
                enabled = guestBalance >= stepPrice && !loading,
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            ) { Text(if (loading) "Продлеваем…" else "Продлить на $stepMinutes мин") }

            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Отмена") }
        }
    }
}

@Composable
private fun WalkInDialog(onDismiss: () -> Unit) {
    val repository = rememberGuestRepository()
    val scope = rememberCoroutineScope()
    val freeStations = remember { repository.freeStationsNow() }
    var selectedStationId by remember { mutableStateOf(freeStations.firstOrNull()?.id) }
    var minutes by remember { mutableStateOf(60) }
    var quote by remember { mutableStateOf<BookingQuote?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(selectedStationId, minutes) {
        val stationId = selectedStationId
        quote = if (stationId != null) repository.quoteBooking(stationId, minutes) else null
    }

    Dialog(onDismissRequest = onDismiss) {
        InfoCard {
            Text("Начать сессию сейчас", style = MaterialTheme.typography.titleMedium)

            if (freeStations.isEmpty()) {
                Text("Сейчас нет свободных мест.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            } else {
                Text("Место", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    freeStations.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                            row.forEach { station ->
                                FilterChip(
                                    selected = station.id == selectedStationId,
                                    onClick = { selectedStationId = station.id },
                                    label = { Text(roomLabels[station.room] ?: station.label, style = MaterialTheme.typography.bodyMedium) },
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                }

                Text("Длительность", color = TextMuted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    durationPresets.forEach { (presetMinutes, label) ->
                        FilterChip(selected = minutes == presetMinutes, onClick = { minutes = presetMinutes }, label = { Text(label) })
                    }
                }

                quote?.let { q ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Стоимость", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                        Text(formatMoney(q.amountRub), style = MaterialTheme.typography.titleMedium)
                    }
                }

                error?.let { StatusBanner(it, StatusKind.ERROR) }

                Button(
                    onClick = {
                        val stationId = selectedStationId
                        if (stationId != null) {
                            loading = true
                            error = null
                            scope.launch {
                                val result = repository.startWalkInSession(stationId, minutes)
                                loading = false
                                result.fold(onSuccess = { onDismiss() }, onFailure = { e -> error = e.message })
                            }
                        }
                    },
                    enabled = selectedStationId != null && !loading,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                ) { Text(if (loading) "Запускаем…" else "Начать") }
            }

            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Отмена") }
        }
    }
}
