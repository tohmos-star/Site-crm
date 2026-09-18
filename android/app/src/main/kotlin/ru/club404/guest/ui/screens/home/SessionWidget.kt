package ru.club404.guest.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.launch
import ru.club404.guest.data.Booking
import ru.club404.guest.data.DoorCodeInfo
import ru.club404.guest.data.Station
import ru.club404.guest.data.endAt
import ru.club404.guest.data.formatDateTime
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.rememberGuestRepository
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted

// Гостевой аналог frontend/pc-widget.html прямо в приложении — те же 4 действия,
// что попросили перенести, минус "Перезагрузить" (это действие имеет смысл
// только с самой станции, не с телефона гостя).
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
    val repository = rememberGuestRepository()
    val scope = rememberCoroutineScope()
    var actionError by remember { mutableStateOf<String?>(null) }
    var actionLoading by remember { mutableStateOf(false) }
    var showExtendDialog by remember { mutableStateOf(false) }

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
            }
            else -> {
                Text("Активной сессии и броней нет", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
        }

        actionError?.let { StatusBanner(it, StatusKind.ERROR, modifier = Modifier.padding(top = 6.dp)) }

        Spacer(Modifier.height(6.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            if (activeBooking != null) {
                Button(
                    onClick = { showExtendDialog = true },
                    enabled = !actionLoading,
                    modifier = Modifier.weight(1f),
                ) { Text("Продлить") }
            } else {
                Button(
                    onClick = {
                        if (nextBooking != null) {
                            actionLoading = true
                            actionError = null
                            scope.launch {
                                val result = repository.redeemCode(nextBooking.code)
                                actionLoading = false
                                result.onFailure { e -> actionError = e.message }
                            }
                        }
                    },
                    enabled = nextBooking != null && !actionLoading,
                    modifier = Modifier.weight(1f),
                ) { Text("Начать сессию") }
            }
            OutlinedButton(onClick = onOpenBalance, modifier = Modifier.weight(1f)) { Text("Пополнить баланс") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
            OutlinedButton(onClick = onOpenEndSession, enabled = activeBooking != null, modifier = Modifier.weight(1f)) { Text("Закончить сессию") }
            OutlinedButton(onClick = onOpenSupport, modifier = Modifier.weight(1f)) { Text("Тех.поддержка") }
        }
    }

    if (showExtendDialog && activeStation != null) {
        ExtendSessionDialog(
            guestBalance = guestBalance,
            hourlyTariff = activeStation.tariffPerHour,
            onDismiss = { showExtendDialog = false },
            onConfirm = { minutes, price ->
                actionLoading = true
                actionError = null
                scope.launch {
                    val result = repository.extendActiveSession(minutes, price)
                    actionLoading = false
                    result.onFailure { e -> actionError = e.message }
                    showExtendDialog = false
                }
            },
        )
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
    onConfirm: (minutes: Int, priceRub: Int) -> Unit,
) {
    var stepMinutes by remember { mutableStateOf(30) }
    val stepPrice = Math.round(hourlyTariff * (stepMinutes / 60f))

    Dialog(onDismissRequest = onDismiss) {
        InfoCard {
            Text("Продлить время", style = MaterialTheme.typography.titleMedium)
            Text("Баланс: ${formatMoney(guestBalance)} · тариф $hourlyTariff ₽/ч", color = TextMuted, style = MaterialTheme.typography.bodyMedium)

            Text("Пакеты", color = TextMuted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                packagesFor(hourlyTariff).forEach { pkg ->
                    val affordable = guestBalance >= pkg.priceRub
                    OutlinedButton(
                        onClick = { onConfirm(pkg.minutes, pkg.priceRub) },
                        enabled = affordable,
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
            Button(
                onClick = { onConfirm(stepMinutes, stepPrice) },
                enabled = guestBalance >= stepPrice,
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            ) { Text("Продлить на $stepMinutes мин") }

            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) { Text("Отмена") }
        }
    }
}
