package ru.club404.guest

import android.app.Application
import ru.club404.guest.data.GuestRepository
import ru.club404.guest.data.MockGuestRepository

class Club404App : Application() {
    lateinit var repository: GuestRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repository = MockGuestRepository()
    }
}
