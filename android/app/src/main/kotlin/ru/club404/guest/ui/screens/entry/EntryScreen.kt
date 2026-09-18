package ru.club404.guest.ui.screens.entry

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.viewModelWithRepo

@Composable
fun EntryScreen(
    onLoggedIn: () -> Unit,
    onGoToRegister: () -> Unit,
) {
    val viewModel = viewModelWithRepo(::EntryViewModel)
    val state by viewModel.state.collectAsState()

    LaunchedEffect(state.loggedIn) {
        if (state.loggedIn) onLoggedIn()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Spacer(Modifier.height(40.dp))
        Text("404", style = MaterialTheme.typography.titleLarge)
        Text("Вход в аккаунт клуба", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
        Spacer(Modifier.height(10.dp))

        OutlinedTextField(
            value = state.phone,
            onValueChange = viewModel::onPhoneChange,
            label = { Text("Телефон") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::onPasswordChange,
            label = { Text("Пароль") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        state.error?.let { StatusBanner(it, StatusKind.ERROR) }

        Button(
            onClick = viewModel::submit,
            enabled = !state.loading,
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (state.loading) {
                CircularProgressIndicator(modifier = Modifier.height(18.dp), strokeWidth = 2.dp)
            } else {
                Text("Войти")
            }
        }

        TextButton(onClick = onGoToRegister, modifier = Modifier.fillMaxWidth()) {
            Text("Ещё нет аккаунта — зарегистрироваться")
        }

        Spacer(Modifier.height(8.dp))
        Text(
            "Демо-доступ: +79991234567 / demo123",
            style = MaterialTheme.typography.bodyMedium,
            color = TextMuted,
        )
    }
}
