package ru.club404.guest.ui.screens.promotions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.rememberGuestRepository
import ru.club404.guest.ui.theme.Accent
import ru.club404.guest.ui.theme.TextMuted

@Composable
fun PromotionsScreen() {
    val repository = rememberGuestRepository()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("club.promotions")
        Text("Акции", style = MaterialTheme.typography.titleLarge)

        repository.promotions.forEach { promo ->
            InfoCard {
                Text(promo.tag, color = Accent, style = MaterialTheme.typography.labelLarge)
                Text(promo.title, style = MaterialTheme.typography.titleMedium)
                Text(promo.description, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
