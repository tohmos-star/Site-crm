package ru.club404.guest.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import ru.club404.guest.Club404App
import ru.club404.guest.data.GuestRepository

/** Простая фабрика для ViewModel'ей с конструктором (GuestRepository) -> VM. */
class SimpleViewModelFactory<T : ViewModel>(private val creator: () -> T) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <VM : ViewModel> create(modelClass: Class<VM>): VM = creator() as VM
}

@Composable
fun rememberGuestRepository(): GuestRepository {
    val app = LocalContext.current.applicationContext as Club404App
    return app.repository
}

@Composable
inline fun <reified VM : ViewModel> viewModelWithRepo(crossinline create: (GuestRepository) -> VM): VM {
    val repository = rememberGuestRepository()
    return viewModel(factory = SimpleViewModelFactory { create(repository) })
}
