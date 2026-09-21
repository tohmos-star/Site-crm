package ru.club404.guest

import android.app.Application
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import ru.club404.guest.data.GuestRepository
import ru.club404.guest.data.RemoteGuestRepository

// Реальный сервер вместо MockGuestRepository — см. RemoteGuestRepository.
private const val API_BASE_URL = "http://92.242.60.149:3000"

class Club404App : Application() {
    lateinit var repository: GuestRepository
        private set

    override fun onCreate() {
        super.onCreate()
        val remote = RemoteGuestRepository(API_BASE_URL)
        // Известное упрощение: BookingViewModel читает repository.stations/zones
        // синхронно один раз при создании (см. GuestRepository — это val, не
        // Flow), так что каталоги должны быть готовы ДО первого экрана.
        // Полноценный splash с асинхронной загрузкой — отдельная задача;
        // пока просто блокируем холодный старт на паре быстрых публичных
        // запросов. initialize() сама не бросает исключений — при недоступной
        // сети приложение всё равно откроется, просто с пустыми списками.
        runBlocking(Dispatchers.IO) { remote.initialize() }
        repository = remote
    }
}
