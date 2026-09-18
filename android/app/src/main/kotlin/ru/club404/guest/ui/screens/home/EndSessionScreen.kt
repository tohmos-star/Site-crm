package ru.club404.guest.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.PhotoCaptureBox
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.components.rememberCameraCaptureLauncher
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.viewModelWithRepo

// Как frontend/report.html: подтвердить чистоту места (карШеринг-стиль
// "закрыть поездку") ПЕРЕД тем, как сессия реально завершится.
@Composable
fun EndSessionScreen(onDone: () -> Unit) {
    val viewModel = viewModelWithRepo(::EndSessionViewModel)
    val state by viewModel.state.collectAsState()

    LaunchedEffect(state.done) {
        if (state.done) onDone()
    }

    val takePhoto0 = rememberCameraCaptureLauncher(viewModel::onPhoto0Taken)
    val takePhoto1 = rememberCameraCaptureLauncher(viewModel::onPhoto1Taken)
    val takePhoto2 = rememberCameraCaptureLauncher(viewModel::onPhoto2Taken)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("session.report")
        Text("Отправь отчёт — получи бонус", style = MaterialTheme.typography.titleLarge)
        Text(
            "Отметь пункты и прикрепи 2–3 фото места. Это закроет сессию с начислением баллов.",
            color = TextMuted, style = MaterialTheme.typography.bodyMedium,
        )

        InfoCard {
            CheckRow("Стол свободен", "Кружки, обёртки и личные вещи убраны", state.checkDesk, viewModel::onCheckDeskChange)
            CheckRow("ПК и периферия на месте", "Клавиатура, мышь, коврик — там же, где были", state.checkPc, viewModel::onCheckPcChange)
            CheckRow("Наушники на зарядке", "Подключены к станции, не оставлены на столе", state.checkHeadset, viewModel::onCheckHeadsetChange)
        }

        Text("Фото места (минимум 2)", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            PhotoCaptureBox(bitmap = state.photo0, placeholder = "Фото 1", onClick = takePhoto0, modifier = Modifier.weight(1f))
            PhotoCaptureBox(bitmap = state.photo1, placeholder = "Фото 2", onClick = takePhoto1, modifier = Modifier.weight(1f))
            PhotoCaptureBox(bitmap = state.photo2, placeholder = "Необязательно", onClick = takePhoto2, modifier = Modifier.weight(1f))
        }
        Text("Снимок стола и зоны с ПК — этого достаточно.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)

        state.error?.let { StatusBanner(it, StatusKind.ERROR) }

        Button(onClick = viewModel::submit, enabled = state.canSubmit, modifier = Modifier.fillMaxWidth()) {
            Text(if (state.loading) "Отправка…" else "Отправить отчёт")
        }
    }
}

@Composable
private fun CheckRow(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Checkbox(checked = checked, onCheckedChange = onCheckedChange)
        Column {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            Text(subtitle, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
