package ru.club404.guest.data

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val dateTimeFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("dd.MM HH:mm").withZone(ZoneId.systemDefault())

fun formatDateTime(instant: Instant): String = dateTimeFormatter.format(instant)

fun formatMoney(rub: Int): String = "$rub ₽"
