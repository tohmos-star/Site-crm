package ru.club404.guest.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import java.io.File

/**
 * Снимок через системную камеру — TakePicture() с Uri от FileProvider, а не
 * TakePicturePreview() (тот работал ненадёжно: на части устройств камера
 * вообще не открывалась по тапу — обратная связь с реального устройства).
 * Возвращает функцию "запустить камеру"; результат приходит в onPhotoTaken.
 */
@Composable
fun rememberCameraCaptureLauncher(onPhotoTaken: (Bitmap) -> Unit): () -> Unit {
    val context = LocalContext.current
    val onPhotoTakenState = rememberUpdatedState(onPhotoTaken)
    var pendingUri by remember { mutableStateOf<Uri?>(null) }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val uri = pendingUri
        if (success && uri != null) {
            decodeBitmap(context, uri)?.let { onPhotoTakenState.value(it) }
        }
    }

    return {
        val uri = createCaptureUri(context)
        pendingUri = uri
        launcher.launch(uri)
    }
}

private fun createCaptureUri(context: Context): Uri {
    val dir = File(context.cacheDir, "images").apply { mkdirs() }
    val file = File.createTempFile("capture_", ".jpg", dir)
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

private fun decodeBitmap(context: Context, uri: Uri): Bitmap? =
    context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
