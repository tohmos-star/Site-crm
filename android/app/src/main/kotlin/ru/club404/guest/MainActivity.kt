package ru.club404.guest

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import ru.club404.guest.ui.nav.AppNavHost
import ru.club404.guest.ui.theme.Bg
import ru.club404.guest.ui.theme.Club404Theme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Club404Theme {
                Surface(modifier = Modifier.fillMaxSize().background(Bg)) {
                    AppNavHost()
                }
            }
        }
    }
}
