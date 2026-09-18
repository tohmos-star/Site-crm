package ru.club404.guest.ui.screens.booking

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.DesktopWindows
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.IntrinsicSize
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.Booking
import ru.club404.guest.data.Station
import ru.club404.guest.data.Zone
import ru.club404.guest.data.formatDateTime
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.theme.Accent
import ru.club404.guest.ui.theme.BorderColor
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.PanelRaised
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.theme.TextPrimary
import ru.club404.guest.ui.theme.hexColor
import ru.club404.guest.ui.viewModelWithRepo
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun BookingScreen(onOpenBalance: () -> Unit) {
    val viewModel = viewModelWithRepo(::BookingViewModel)
    val state by viewModel.state.collectAsState()

    val completed = state.completedBooking
    if (completed != null) {
        BookingCodeScreen(completed, onBookAnother = viewModel::bookAnother)
        return
    }

    if (state.pendingConfirmation) {
        BookingConfirmScreen(state, viewModel)
        return
    }

    // Своя лента дат + лента времени вместо системных DatePicker/TimePicker —
    // крупнее, без диалогов поверх экрана, в стиле карточек LANGAME.
    var selectedDate by remember { mutableStateOf(LocalDate.now()) }
    var selectedSlotMinutes by remember { mutableStateOf<Int?>(null) }

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
            FloorPlan(
                stations = state.stations,
                zones = state.zones,
                selectedStationId = state.selectedStationId,
                onSelect = viewModel::selectStation,
            )
        }

        if (state.selectedStationId != null) {
            InfoCard {
                SectionLabel("2. Время")

                Text("Дата", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    (0..6).forEach { offset ->
                        val date = LocalDate.now().plusDays(offset.toLong())
                        DateChip(
                            date = date,
                            selected = date == selectedDate,
                            onClick = { selectedDate = date; selectedSlotMinutes = null },
                        )
                    }
                }

                // Как на LANGAME: почасовой тариф — произвольная длительность
                // шагом; пакеты — фиксированные 3ч/6ч. Переключаются вкладками.
                TariffModeToggle(mode = state.tariffMode, onModeChange = viewModel::setTariffMode)

                Text("Время начала", color = TextMuted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                val slots = timeSlotsFor(selectedDate)
                if (slots.isEmpty()) {
                    Text("На сегодня свободного времени не осталось — выберите другой день.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        slots.forEach { slotMinutes ->
                            TimeSlotChip(
                                minutesSinceMidnight = slotMinutes,
                                selected = slotMinutes == selectedSlotMinutes,
                                onClick = {
                                    selectedSlotMinutes = slotMinutes
                                    viewModel.setStartAt(
                                        selectedDate.atStartOfDay().plusMinutes(slotMinutes.toLong())
                                            .atZone(ZoneId.systemDefault()).toInstant(),
                                    )
                                },
                            )
                        }
                    }
                }

                if (state.tariffMode == TariffMode.HOURLY) {
                    Text("Продолжительность", color = TextMuted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.fillMaxWidth(),
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
                } else {
                    Text("Пакет", color = TextMuted, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        packagePresets.forEach { (minutes, label) ->
                            DurationChip(
                                label = label,
                                selected = minutes == state.durationMinutes,
                                onClick = { viewModel.setDurationMinutes(minutes) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
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
                    onClick = viewModel::proceedToConfirmation,
                    enabled = !state.loading && state.startAt != null,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                ) { Text("Далее") }
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
}

// Первый слот — ровно "сейчас + 5 минут" (как 13:08 на LANGAME-скриншотах),
// дальше сетка по 30 минут до конца суток. На будущие дни — вся сетка с 00:00.
private fun timeSlotsFor(date: LocalDate): List<Int> {
    val slots = mutableListOf<Int>()
    if (date == LocalDate.now()) {
        val earliest = LocalDateTime.now().plusMinutes(5)
        val earliestMinute = earliest.hour * 60 + earliest.minute
        if (earliestMinute >= 24 * 60) return emptyList()
        slots += earliestMinute
        var next = ((earliestMinute / 30) + 1) * 30
        while (next < 24 * 60) {
            slots += next
            next += 30
        }
    } else {
        var m = 0
        while (m < 24 * 60) {
            slots += m
            m += 30
        }
    }
    return slots
}

private fun formatSlot(minutesSinceMidnight: Int): String =
    "%02d:%02d".format(minutesSinceMidnight / 60, minutesSinceMidnight % 60)

@Composable
private fun SectionLabel(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium)
}

// Схема зала — топология (что где стоит) списана с реального плана клуба на
// скриншоте бронирования LANGAME (тот же адрес, Чапаевская 178): слева SOLO /
// SOLO+ / DUO 1, справа тех.зона (не бронируется) и DUO 2, снизу W/C и техника
// (чайник/кофемашина/холодильник/куллер — тоже с того скриншота, это реальные
// удобства клуба, не выдумка). Комнаты жёстко привязаны к местам в разметке,
// а не выводятся из произвольного списка станций, — так и должно быть для
// чертежа конкретного помещения.
@Composable
private fun FloorPlan(
    stations: List<Station>,
    zones: List<Zone>,
    selectedStationId: String?,
    onSelect: (String) -> Unit,
) {
    fun zoneColorFor(zoneId: String): Color =
        zones.firstOrNull { it.id == zoneId }?.colorHex?.let(::hexColor) ?: Accent
    fun stationsFor(room: String) = stations.filter { it.room == room }

    val solo = stationsFor("solo-1")
    val soloPlus = stationsFor("solo-plus")
    val duo1 = stationsFor("duo-1")
    val duo2 = stationsFor("duo-2")

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, BorderColor, RoundedCornerShape(12.dp)),
    ) {
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            Column(Modifier.weight(1f)) {
                FloorCompartment("SOLO", solo, zoneColorFor(solo.firstOrNull()?.zoneId ?: ""), selectedStationId, onSelect)
                HorizontalDivider(color = BorderColor)
                FloorCompartment("SOLO+", soloPlus, zoneColorFor(soloPlus.firstOrNull()?.zoneId ?: ""), selectedStationId, onSelect)
                HorizontalDivider(color = BorderColor)
                FloorCompartment("DUO 1", duo1, zoneColorFor(duo1.firstOrNull()?.zoneId ?: ""), selectedStationId, onSelect)
            }
            Box(Modifier.width(1.dp).fillMaxHeight().background(BorderColor))
            Column(Modifier.weight(1f)) {
                TechZoneCompartment()
                HorizontalDivider(color = BorderColor)
                FloorCompartment("DUO 2", duo2, zoneColorFor(duo2.firstOrNull()?.zoneId ?: ""), selectedStationId, onSelect)
            }
        }
        HorizontalDivider(color = BorderColor)
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            Box(Modifier.weight(1f).padding(12.dp), contentAlignment = Alignment.Center) {
                Text("W/C", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
            Box(Modifier.width(1.dp).fillMaxHeight().background(BorderColor))
            Column(Modifier.weight(1f).padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Чайник · кофемашина", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Text("Холодильник · кулер", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun FloorCompartment(
    label: String,
    seats: List<Station>,
    zoneColor: Color,
    selectedStationId: String?,
    onSelect: (String) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(label, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        seats.forEach { station ->
            FloorSeatTile(
                label = "Место ${station.seat}",
                tariffPerHour = station.tariffPerHour,
                zoneColor = zoneColor,
                selected = station.id == selectedStationId,
                onClick = { onSelect(station.id) },
            )
        }
    }
}

@Composable
private fun TechZoneCompartment() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("Тех. зона", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PanelRaised)
                .border(1.dp, BorderColor, RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = 10.dp),
        ) {
            Text("не бронируется", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun FloorSeatTile(
    label: String,
    tariffPerHour: Int,
    zoneColor: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) zoneColor.copy(alpha = 0.18f) else PanelRaised)
            .border(if (selected) 2.dp else 1.dp, if (selected) zoneColor else BorderColor, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.DesktopWindows, contentDescription = null, tint = zoneColor, modifier = Modifier.size(18.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text("$tariffPerHour ₽/ч", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun DateChip(date: LocalDate, selected: Boolean, onClick: () -> Unit) {
    val today = LocalDate.now()
    val topLabel = when (date) {
        today -> "Сегодня"
        today.plusDays(1) -> "Завтра"
        else -> date.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, Locale("ru")).replaceFirstChar { it.uppercase() }
    }
    PillTile(
        topLabel = topLabel,
        bottomLabel = date.format(DateTimeFormatter.ofPattern("dd.MM")),
        selected = selected,
        onClick = onClick,
        modifier = Modifier.width(76.dp),
    )
}

@Composable
private fun TimeSlotChip(minutesSinceMidnight: Int, selected: Boolean, onClick: () -> Unit) {
    PillTile(
        topLabel = formatSlot(minutesSinceMidnight),
        bottomLabel = null,
        selected = selected,
        onClick = onClick,
        modifier = Modifier.width(72.dp),
    )
}

@Composable
private fun TariffModeToggle(mode: TariffMode, onModeChange: (TariffMode) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(PanelRaised)
            .padding(4.dp),
    ) {
        TariffModeSegment("Почасовой тариф", selected = mode == TariffMode.HOURLY, onClick = { onModeChange(TariffMode.HOURLY) }, modifier = Modifier.weight(1f))
        TariffModeSegment("Пакеты времени", selected = mode == TariffMode.PACKAGE, onClick = { onModeChange(TariffMode.PACKAGE) }, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun TariffModeSegment(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) BorderColor else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (selected) TextPrimary else TextMuted,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun DurationChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    PillTile(topLabel = label, bottomLabel = null, selected = selected, onClick = onClick, modifier = modifier)
}

@Composable
private fun PillTile(
    topLabel: String,
    bottomLabel: String?,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) Accent.copy(alpha = 0.18f) else PanelRaised)
            .border(if (selected) 2.dp else 1.dp, if (selected) Accent else BorderColor, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(topLabel, color = if (selected) Accent else TextPrimary, style = MaterialTheme.typography.bodyMedium)
        if (bottomLabel != null) {
            Text(bottomLabel, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

// Отдельный шаг подтверждения перед списанием денег — время/место/сумма и
// переключатель "Списать бонусы", как на экране "Подтверди бронирование" у
// LANGAME (включая состояние кнопки "Недостаточно средств").
@Composable
private fun BookingConfirmScreen(state: BookingUiState, viewModel: BookingViewModel) {
    val station = state.stations.firstOrNull { it.id == state.selectedStationId }
    val quote = state.quote
    val amount = quote?.amountRub ?: 0
    val bonusAvailable = minOf(state.guestBonusPoints, amount)
    val bonusRedeemed = if (state.useBonus) bonusAvailable else 0
    val totalToPay = amount - bonusRedeemed
    val insufficientFunds = totalToPay > state.guestBalance

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("club.booking")
        Text("Подтверди бронирование", style = MaterialTheme.typography.titleLarge)

        InfoCard {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.CalendarToday, contentDescription = null, tint = TextMuted)
                Column {
                    Text("Выбранное время", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    Text(
                        "${state.startAt?.let { formatDateTime(it) } ?: "—"} · ${state.durationMinutes} мин",
                        style = MaterialTheme.typography.bodyLarge,
                    )
                }
            }
        }

        InfoCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.DesktopWindows, contentDescription = null, tint = TextMuted)
                    Column {
                        Text("Выбранное место", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                        Text(station?.label ?: "—", style = MaterialTheme.typography.bodyLarge)
                    }
                }
                TextButton(onClick = viewModel::cancelConfirmation) { Text("Изменить") }
            }
        }

        InfoCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Сумма к оплате", style = MaterialTheme.typography.bodyMedium)
                Text(formatMoney(amount), style = MaterialTheme.typography.bodyMedium)
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Текущий баланс", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Text(formatMoney(state.guestBalance), color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
            if (state.guestBonusPoints > 0) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text("Списать бонусы", style = MaterialTheme.typography.bodyMedium)
                        Text("Доступно: ${state.guestBonusPoints}", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                    }
                    Switch(checked = state.useBonus, onCheckedChange = { viewModel.toggleUseBonus() })
                }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Итого к оплате", style = MaterialTheme.typography.titleMedium)
                Text(formatMoney(totalToPay), style = MaterialTheme.typography.titleMedium)
            }
        }

        state.error?.let { StatusBanner(it, StatusKind.ERROR) }

        Button(
            onClick = viewModel::confirmBooking,
            enabled = !state.loading && !insufficientFunds,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                when {
                    state.loading -> "Бронируем…"
                    insufficientFunds -> "Недостаточно средств"
                    else -> "Подтвердить бронирование"
                },
            )
        }
    }
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
