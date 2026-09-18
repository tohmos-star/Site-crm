package ru.club404.guest.ui.screens.balance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.formatMoney
import ru.club404.guest.ui.components.InfoCard
import ru.club404.guest.ui.components.SectionKicker
import ru.club404.guest.ui.components.StatusBanner
import ru.club404.guest.ui.components.StatusKind
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.viewModelWithRepo

@Composable
fun BalanceScreen() {
    val viewModel = viewModelWithRepo(::BalanceViewModel)
    val state by viewModel.state.collectAsState()
    val guest = state.guest ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SectionKicker("club.balance")
        Text("Баланс и бонусы", style = MaterialTheme.typography.titleLarge)

        InfoCard {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Баланс", color = TextMuted)
                    Text(formatMoney(guest.balanceRub), style = MaterialTheme.typography.titleLarge)
                }
                Column {
                    Text("Бонусы", color = TextMuted)
                    Text("${guest.bonusPoints}", style = MaterialTheme.typography.titleLarge, color = Ok)
                }
            }
        }

        state.error?.let { StatusBanner(it, StatusKind.ERROR) }
        state.message?.let { StatusBanner(it, StatusKind.OK) }

        Text("Пополнить баланс", style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            topUpPresets.forEach { amount ->
                FilterChip(
                    selected = state.topUpAmountText == amount.toString(),
                    onClick = { viewModel.setTopUpAmount(amount.toString()) },
                    label = { Text("$amount ₽") },
                )
            }
        }
        OutlinedTextField(
            value = state.topUpAmountText,
            onValueChange = viewModel::setTopUpAmount,
            label = { Text("Сумма, ₽") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "Демо-режим: платёж подтверждается сразу (в полном бэкенде — СБП/эквайринг через Т-Банк, см. src/modules/payments).",
            color = TextMuted, style = MaterialTheme.typography.bodyMedium,
        )
        Button(onClick = viewModel::topUp, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
            Text(if (state.loading) "Обрабатываем…" else "Пополнить")
        }

        HorizontalDivider()

        Text("Запросить возврат", style = MaterialTheme.typography.titleMedium)
        Text("Согласно ст. 32 ЗоЗПП — заявку рассматривает персонал клуба.", color = TextMuted, style = MaterialTheme.typography.bodyMedium)
        OutlinedTextField(
            value = state.refundAmountText,
            onValueChange = viewModel::setRefundAmount,
            label = { Text("Сумма, ₽") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = state.refundReason,
            onValueChange = viewModel::setRefundReason,
            label = { Text("Причина") },
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedButton(onClick = viewModel::requestRefund, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
            Text("Отправить заявку")
        }
    }
}
