package ru.club404.guest.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import ru.club404.guest.data.ChatMessage
import ru.club404.guest.data.ChatRole
import ru.club404.guest.ui.theme.Accent
import ru.club404.guest.ui.theme.BorderColor
import ru.club404.guest.ui.theme.Ok
import ru.club404.guest.ui.theme.Panel
import ru.club404.guest.ui.theme.PanelRaised
import ru.club404.guest.ui.theme.TextMuted
import ru.club404.guest.ui.theme.TextPrimary

/** Аналог .panel / .form-panel на сайте — карточка с рамкой на фоне панели. */
@Composable
fun InfoCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Panel, RoundedCornerShape(14.dp))
            .border(1.dp, BorderColor, RoundedCornerShape(14.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

enum class StatusKind { OK, ERROR, NEUTRAL }

/** Аналог .status-msg.{ok,err,neutral} на сайте. */
@Composable
fun StatusBanner(text: String, kind: StatusKind, modifier: Modifier = Modifier) {
    val (bg, fg) = when (kind) {
        StatusKind.OK -> Ok.copy(alpha = 0.12f) to Ok
        StatusKind.ERROR -> Accent.copy(alpha = 0.12f) to Accent
        StatusKind.NEUTRAL -> PanelRaised to TextMuted
    }
    Text(
        text = text,
        color = fg,
        style = MaterialTheme.typography.bodyMedium,
        modifier = modifier
            .fillMaxWidth()
            .background(bg, RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
    )
}

@Composable
fun SectionKicker(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        color = Accent,
        style = MaterialTheme.typography.labelLarge,
        modifier = modifier,
    )
}

/**
 * Слот "сфотографировать документ/селфи/место" — камера через
 * TakePicturePreview (см. вызывающий код), здесь только превью + подпись.
 * Общий для RegisterScreen (документ/селфи) и EndSessionScreen (фото места).
 */
@Composable
fun PhotoCaptureBox(bitmap: Bitmap?, placeholder: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        InfoCard(modifier = Modifier.height(140.dp).clip(RoundedCornerShape(14.dp))) {
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                if (bitmap != null) {
                    Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    Text(placeholder, color = TextMuted, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        TextButton(onClick = onClick) { Text(if (bitmap != null) "Переснять" else "Открыть камеру") }
    }
}

@Composable
fun ChatBubble(message: ChatMessage, modifier: Modifier = Modifier) {
    val bg: Color
    val fg: Color
    when (message.role) {
        ChatRole.GUEST -> { bg = Accent; fg = Color(0xFF12100E) }
        ChatRole.BOT -> { bg = PanelRaised; fg = TextPrimary }
        ChatRole.ERROR -> { bg = Accent.copy(alpha = 0.12f); fg = Accent }
        ChatRole.TYPING -> { bg = Color.Transparent; fg = TextMuted }
    }
    Text(
        text = message.text,
        color = fg,
        style = MaterialTheme.typography.bodyMedium,
        modifier = modifier
            .background(bg, RoundedCornerShape(14.dp))
            .padding(horizontal = 13.dp, vertical = 9.dp),
    )
}
