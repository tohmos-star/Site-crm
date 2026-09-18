package ru.club404.guest.ui.screens.register

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.PhotoCaptureBox
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.theme.Accent
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.viewModelWithRepo

@Composable
fun RegisterScreen(
    onGoToLogin: () -> Unit,
) {
    val viewModel = viewModelWithRepo(::RegisterViewModel)
    val state by viewModel.state.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        SectionKicker("access.register")
        Text("Регистрация в клубе", style = MaterialTheme.typography.titleLarge)

        when (state.step) {
            RegisterStep.INTRO -> IntroStep(state, viewModel)
            RegisterStep.PHONE -> PhoneStep(state, viewModel)
            RegisterStep.PASSWORD -> PasswordStep(state, viewModel)
            RegisterStep.FIO -> FioStep(state, viewModel)
            RegisterStep.DOC_PHOTO -> DocPhotoStep(state, viewModel)
            RegisterStep.SELFIE -> SelfieStep(state, viewModel)
            RegisterStep.PENDING -> PendingStep(onGoToLogin)
        }
    }
}

@Composable
private fun StepProgress(text: String) {
    Text(text, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun IntroStep(state: RegisterUiState, viewModel: RegisterViewModel) {
    Text("Занимает 3–5 минут и проходит полностью здесь. После подтверждения — доступ 24/7 и 500 бонусов на баланс.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)

    InfoCard {
        Text("Что понадобится:", style = MaterialTheme.typography.titleMedium)
        Text("📱 Номер телефона")
        Text("🪪 ФИО как в документе")
        Text("📸 Фото документа, удостоверяющего личность")
        Text("🤳 Селфи")
    }

    Text("⚠️ Доступ в клуб — строго с 18 лет.", color = Accent, style = MaterialTheme.typography.bodyMedium)
    Text(
        "Документ и селфи нужны, чтобы подтвердить личность и возраст. Телефон и ФИО — для вашего клубного аккаунта. Мы ничего не храним лишнего и нигде не публикуем.",
        color = TextMuted, style = MaterialTheme.typography.bodyMedium,
    )
    Text("🎁 За прохождение регистрации — 500 бонусов на баланс, начислим после подтверждения.")

    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = state.consentChecked, onCheckedChange = viewModel::onConsentChange)
        Text("Согласен(на) на обработку персональных данных", style = MaterialTheme.typography.bodyMedium)
    }

    Button(onClick = viewModel::startWizard, enabled = state.consentChecked, modifier = Modifier.fillMaxWidth()) {
        Text("Начать")
    }
}

@Composable
private fun PhoneStep(state: RegisterUiState, viewModel: RegisterViewModel) {
    StepProgress("Шаг 1 из 5")
    OutlinedTextField(
        value = state.phone,
        onValueChange = viewModel::onPhoneChange,
        label = { Text("Номер телефона") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    state.phoneError?.let { StatusBanner(it, StatusKind.ERROR) }
    Button(onClick = viewModel::submitPhone, modifier = Modifier.fillMaxWidth()) { Text("Далее") }
}

@Composable
private fun PasswordStep(state: RegisterUiState, viewModel: RegisterViewModel) {
    StepProgress("Шаг 2 из 5")
    OutlinedTextField(
        value = state.password,
        onValueChange = viewModel::onPasswordChange,
        label = { Text("Придумайте пароль") },
        visualTransformation = PasswordVisualTransformation(),
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    Text("Понадобится при следующих входах — вместе с номером телефона.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
    state.error?.let { StatusBanner(it, StatusKind.ERROR) }
    Button(onClick = viewModel::submitPassword, modifier = Modifier.fillMaxWidth()) { Text("Далее") }
}

@Composable
private fun FioStep(state: RegisterUiState, viewModel: RegisterViewModel) {
    StepProgress("Шаг 3 из 5")
    OutlinedTextField(
        value = state.fio,
        onValueChange = viewModel::onFioChange,
        label = { Text("ФИО — точно как в документе") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    Text("Важно, чтобы совпадало с документом, который будете загружать дальше.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
    state.error?.let { StatusBanner(it, StatusKind.ERROR) }
    Button(onClick = viewModel::submitFio, modifier = Modifier.fillMaxWidth()) { Text("Далее") }
}

@Composable
private fun DocPhotoStep(state: RegisterUiState, viewModel: RegisterViewModel) {
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) viewModel.onDocPhotoTaken(bitmap)
    }
    StepProgress("Шаг 4 из 5 — самый важный")
    Text(
        "Нужна фотография документа с фото и ФИО — подойдёт паспорт (главный разворот), водительское удостоверение или загранпаспорт.",
        color = TextMuted, style = MaterialTheme.typography.bodyMedium,
    )
    PhotoCaptureBox(bitmap = state.docPhoto, placeholder = "Нажмите, чтобы сфотографировать документ", onClick = { launcher.launch(null) })
    Button(onClick = viewModel::submitDocPhoto, enabled = state.docPhoto != null, modifier = Modifier.fillMaxWidth()) { Text("Далее") }
}

@Composable
private fun SelfieStep(state: RegisterUiState, viewModel: RegisterViewModel) {
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        if (bitmap != null) viewModel.onSelfiePhotoTaken(bitmap)
    }
    StepProgress("Шаг 5 из 5 — последний!")
    Text("Фото своего лица — сверим с документом, и всё, вы в системе.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
    PhotoCaptureBox(bitmap = state.selfiePhoto, placeholder = "Нажмите, чтобы сделать селфи", onClick = { launcher.launch(null) })
    state.error?.let { StatusBanner(it, StatusKind.ERROR) }
    Button(
        onClick = viewModel::submitRegistration,
        enabled = state.selfiePhoto != null && !state.loading,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(if (state.loading) "Отправка…" else "Отправить на проверку")
    }
}

@Composable
private fun PendingStep(onGoToLogin: () -> Unit) {
    InfoCard {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text("✓", color = Ok, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text("Готово! Все данные отправлены на проверку", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(10.dp))
            Text(
                "С 9:00 до 23:00 отвечаем быстро — обычно в течение 10 минут. Ночью поддержка тоже на месте, но людей меньше, поэтому ответ может занять до 1 часа.",
                color = TextMuted, style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "Как только подтвердим — откроем доступ и начислим 500 бонусов. Если не ответим за час — звоните: 8 (908) 404-04-40.",
                color = TextMuted, style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
    Button(onClick = onGoToLogin, modifier = Modifier.fillMaxWidth()) { Text("Перейти ко входу") }
}
