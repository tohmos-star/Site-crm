package ru.club404.guest.ui.nav

sealed class Screen(val route: String) {
    data object Entry : Screen("entry")
    data object Register : Screen("register")

    data object Home : Screen("home")
    data object Booking : Screen("booking")
    data object Balance : Screen("balance")
    data object Support : Screen("support")
    data object Profile : Screen("profile")

    data object Prices : Screen("prices")
    data object Promotions : Screen("promotions")
    data object ClubInfo : Screen("club_info")
    data object EndSession : Screen("end_session")

    // Не путать со Screen.Entry (экран входа/логина) — это "Войти в клуб"
    // с сайта (frontend/entry.html), общий доступ в помещение для уже
    // залогиненного гостя.
    data object ClubEntry : Screen("club_entry")
}

// Вкладки нижней навигации — показываются только вошедшему гостю.
// Админка сюда намеренно не переносится (см. задачу): в приложении её нет.
val bottomNavScreens = listOf(Screen.Home, Screen.Booking, Screen.Balance, Screen.Support, Screen.Profile)
