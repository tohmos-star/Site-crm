package ru.club404.guest.ui.screens.prices

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.rememberGuestRepository
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.theme.hexColor

@Composable
fun PricesScreen() {
    val repository = rememberGuestRepository()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("club.prices")
        Text("Цены и тарифы", style = MaterialTheme.typography.titleLarge)

        repository.zones.forEach { zone ->
            val zoneStations = repository.stations.filter { it.zoneId == zone.id }
            if (zoneStations.isEmpty()) return@forEach
            val zoneColor = hexColor(zone.colorHex)
            InfoCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(zoneColor))
                    Text(zone.nameRu, style = MaterialTheme.typography.titleMedium)
                }
                zoneStations.forEach { station ->
                    val perHour = station.tariffId?.let { id -> repository.tariffs.firstOrNull { it.id == id }?.priceRubPerHour } ?: station.tariffPerHour
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(station.label, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "${formatMoney(perHour)}/час",
                            color = zoneColor,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(zoneColor.copy(alpha = 0.14f))
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                }
            }
        }

        Text(
            "Скидки и кэшбэк по программе лояльности применяются автоматически при бронировании — см. вкладку «Профиль».",
            color = TextMuted, style = MaterialTheme.typography.bodyMedium,
        )
    }
}
