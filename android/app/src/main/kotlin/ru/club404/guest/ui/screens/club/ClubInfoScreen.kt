package ru.club404.guest.ui.screens.club

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
import ru.club404.guest.ui.theme.TextMuted

private data class InfoItem(val title: String, val body: String)

// Тексты те же, что в FAQ ИИ-агента поддержки (backend/prisma/seed.ts /
// SupportAgent) — единый источник фактов о клубе, а не два расходящихся.
private val clubInfo = listOf(
    InfoItem("Адрес", "Самара, Чапаевская, 178."),
    InfoItem("Часы работы", "Клуб работает круглосуточно, вход полностью автоматический — администратор физически не присутствует."),
    InfoItem("Wi-Fi", "Пароль от Wi-Fi отображается на экране сразу после входа в клуб."),
    InfoItem("Приставки", "В клубе 404 Киберхаус приставок нет. Они есть в клубе Reborn, номер для связи: 8 998 543-65-78."),
    InfoItem("Еда и напитки", "Напитки и еда — в вендинговом аппарате в клубе. Там же кулер с водой и микроволновка."),
    InfoItem("Если завис ПК или Steam", "Обычно помогает перезагрузка компьютера — кнопка у основания кронштейна монитора."),
)

@Composable
fun ClubInfoScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("club.info")
        Text("О клубе", style = MaterialTheme.typography.titleLarge)

        clubInfo.forEach { item ->
            InfoCard {
                Text(item.title, style = MaterialTheme.typography.titleMedium)
                Text(item.body, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
