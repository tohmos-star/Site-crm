package ru.club404.guest.ui.theme

import androidx.compose.ui.graphics.Color

/** Zone.colorHex ("#RRGGBB") из мока — сюда, чтобы места/тарифы красились по зоне. */
fun hexColor(hex: String): Color = Color(android.graphics.Color.parseColor(hex))
