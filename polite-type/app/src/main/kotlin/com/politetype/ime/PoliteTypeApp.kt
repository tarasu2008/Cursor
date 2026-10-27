package com.politetype.ime

import android.app.Application
import android.os.Build
import com.politetype.ime.data.CrashLog

class PoliteTypeApp : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashLog.install(this)
        CrashLog.note(this, "opened on ${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}")
    }
}
