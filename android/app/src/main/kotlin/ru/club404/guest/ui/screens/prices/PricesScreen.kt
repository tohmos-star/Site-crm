package ru.club404.guest.ui.screens.prices

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.rememberGuestRepository
import ru.club404.guest.ui.theme.TextMuted

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
            InfoCard {
                Text(zone.nameRu, style = MaterialTheme.typography.titleMedium)
                zoneStations.forEach { station ->
                    val perHour = station.tariffId?.let { id -> repository.tariffs.firstOrNull { it.id == id }?.priceRubPerHour } ?: station.tariffPerHour
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(station.label, color = TextMuted)
                        Text("${formatMoney(perHour)}/час")
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
