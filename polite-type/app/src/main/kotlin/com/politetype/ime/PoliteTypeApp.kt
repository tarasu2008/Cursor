package com.politetype.ime

import android.app.Application
import android.content.Context
import android.os.Build
import com.politetype.ime.data.Alerts
import com.politetype.ime.data.CrashLog

class PoliteTypeApp : Application() {
    override fun attachBaseContext(base: Context) {
        super.attachBaseContext(base)
        CrashLog.install(this)
    }

    override fun onCreate() {
        super.onCreate()
        Alerts.ensure(this)
        CrashLog.note(this, "opened on ${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}")
    }
}
