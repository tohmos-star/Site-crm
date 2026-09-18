package ru.club404.guest.ui.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.compose.composable
import ru.club404.guest.ui.screens.balance.BalanceScreen
import ru.club404.guest.ui.screens.booking.BookingScreen
import ru.club404.guest.ui.screens.club.ClubInfoScreen
import ru.club404.guest.ui.screens.entry.EntryScreen
import ru.club404.guest.ui.screens.home.HomeScreen
import ru.club404.guest.ui.screens.prices.PricesScreen
import ru.club404.guest.ui.screens.profile.ProfileScreen
import ru.club404.guest.ui.screens.promotions.PromotionsScreen
import ru.club404.guest.ui.screens.register.RegisterScreen
import ru.club404.guest.ui.screens.support.SupportChatScreen

private fun bottomNavIcon(screen: Screen) = when (screen) {
    Screen.Home -> Icons.Filled.Home
    Screen.Booking -> Icons.Filled.CalendarMonth
    Screen.Balance -> Icons.Filled.Wallet
    Screen.Support -> Icons.Filled.Chat
    Screen.Profile -> Icons.Filled.AccountCircle
    else -> Icons.Filled.Home
}

private fun bottomNavLabel(screen: Screen) = when (screen) {
    Screen.Home -> "Клуб"
    Screen.Booking -> "Бронь"
    Screen.Balance -> "Баланс"
    Screen.Support -> "Поддержка"
    Screen.Profile -> "Профиль"
    else -> ""
}

@Composable
fun AppNavHost() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val showBottomBar = bottomNavScreens.any { it.route == currentRoute }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavScreens.forEach { screen ->
                        NavigationBarItem(
                            selected = currentRoute == screen.route,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(bottomNavIcon(screen), contentDescription = bottomNavLabel(screen)) },
                            label = { Text(bottomNavLabel(screen)) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Entry.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(Screen.Entry.route) {
                EntryScreen(
                    onLoggedIn = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(navController.graph.id) { inclusive = true }
                        }
                    },
                    onGoToRegister = { navController.navigate(Screen.Register.route) },
                )
            }
            composable(Screen.Register.route) {
                RegisterScreen(
                    onRegistered = {
                        navController.navigate(Screen.Home.route) {
                            popUpTo(navController.graph.id) { inclusive = true }
                        }
                    },
                    onBackToLogin = { navController.popBackStack() },
                )
            }
            composable(Screen.Home.route) {
                HomeScreen(
                    onOpenBooking = { navController.navigate(Screen.Booking.route) },
                    onOpenBalance = { navController.navigate(Screen.Balance.route) },
                    onOpenSupport = { navController.navigate(Screen.Support.route) },
                    onOpenPrices = { navController.navigate(Screen.Prices.route) },
                    onOpenPromotions = { navController.navigate(Screen.Promotions.route) },
                    onOpenClubInfo = { navController.navigate(Screen.ClubInfo.route) },
                )
            }
            composable(Screen.Booking.route) { BookingScreen() }
            composable(Screen.Balance.route) { BalanceScreen() }
            composable(Screen.Support.route) { SupportChatScreen() }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onLoggedOut = {
                        navController.navigate(Screen.Entry.route) {
                            popUpTo(navController.graph.id) { inclusive = true }
                        }
                    },
                )
            }
            composable(Screen.Prices.route) { PricesScreen() }
            composable(Screen.Promotions.route) { PromotionsScreen() }
            composable(Screen.ClubInfo.route) { ClubInfoScreen() }
        }
    }
}
