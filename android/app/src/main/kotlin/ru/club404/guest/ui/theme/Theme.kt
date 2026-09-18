package ru.club404.guest.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val Club404ColorScheme = darkColorScheme(
    primary = Accent,
    onPrimary = Color(0xFF12100E),
    secondary = Ok,
    background = Bg,
    onBackground = TextPrimary,
    surface = Panel,
    onSurface = TextPrimary,
    surfaceVariant = PanelRaised,
    onSurfaceVariant = TextMuted,
    outline = BorderColor,
    error = ErrorRed,
)

private val Club404Typography = Typography(
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    titleLarge = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium),
)

// Сайт всегда тёмный (см. frontend/css/main.css) — приложение намеренно
// не поддерживает светлую тему, чтобы выглядеть продолжением сайта.
@Composable
fun Club404Theme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = Club404ColorScheme,
        typography = Club404Typography,
        content = content,
    )
}
