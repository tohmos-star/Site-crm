package ru.club404.guest.ui.screens.clubentry

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.rememberGuestRepository
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted

// Как frontend/entry.html: два независимых шага для входа в помещение —
// ссылка от домофона (первая дверь) и персональный код (вторая, нижняя
// дверь). Не путать с DoorCodeInfo в SessionWidget — тот код открывает
// станцию/комнату конкретной активной сессии, а не сам клуб.
@Composable
fun ClubEntryScreen() {
    val repository = rememberGuestRepository()
    val context = LocalContext.current
    val access = repository.entryAccessForCurrentGuest()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("access.entry")
        Text("Вход в клуб", style = MaterialTheme.typography.titleLarge)

        if (access == null) {
            Text("Доступ появится после входа в аккаунт.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        } else {
            InfoCard {
                Text("1. Ссылка от домофона (первая дверь)", style = MaterialTheme.typography.titleMedium)
                Text("Откройте по ссылке:", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Button(
                    onClick = {
                        try {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(access.intercomUrl)))
                        } catch (e: ActivityNotFoundException) {
                            // Нет приложения, способного открыть ссылку, — молча
                            // игнорируем, как и на сайте (просто нерабочая ссылка).
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Открыть домофон") }
                Text(
                    "Не открывается? Сначала отключите VPN — с ним ссылка не срабатывает. Если всё равно не работает — напишите в поддержку или звоните: 8 (908) 404-04-40.",
                    color = TextMuted, style = MaterialTheme.typography.bodyMedium,
                )
            }

            InfoCard {
                Text("2. Код от двери (нижняя дверь)", style = MaterialTheme.typography.titleMedium)
                Text("Введите код на панели:", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(access.doorCode, style = MaterialTheme.typography.titleLarge, color = Ok)
                }
                Text(
                    "Код персональный, сгенерирован автоматически именно для вас.",
                    color = TextMuted, style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}
