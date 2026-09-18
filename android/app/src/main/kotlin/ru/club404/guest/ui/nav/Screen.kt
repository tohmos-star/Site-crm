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
}

// Вкладки нижней навигации — показываются только вошедшему гостю.
// Админка сюда намеренно не переносится (см. задачу): в приложении её нет.
val bottomNavScreens = listOf(Screen.Home, Screen.Booking, Screen.Balance, Screen.Support, Screen.Profile)
