package com.politetype.ime.data

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.politetype.ime.R

/** Makes PoliteType alerts visible. Android 13 and Samsung leave them blocked until the app asks. */
object Alerts {
    const val CHANNEL = "politetype"

    fun ensure(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        try {
            val manager = context.applicationContext.getSystemService(NotificationManager::class.java) ?: return
            val channel = NotificationChannel(
                CHANNEL,
                "PoliteType",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            channel.description = "Keyboard alerts, including the reason if PoliteType closes."
            manager.createNotificationChannel(channel)
        } catch (_: Throwable) {
            // A missing channel must not close the app.
        }
    }

    fun enabled(context: Context): Boolean {
        return try {
            val manager = context.applicationContext.getSystemService(NotificationManager::class.java) ?: return false
            if (!manager.areNotificationsEnabled()) return false
            if (Build.VERSION.SDK_INT >= 33) {
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
        } catch (_: Throwable) {
            false
        }
    }

    fun show(context: Context, title: String, text: String, id: Int) {
        if (!enabled(context)) return
        try {
            ensure(context)
            val manager = context.applicationContext.getSystemService(NotificationManager::class.java) ?: return
            val notification = notification(context, title, text, R.drawable.ic_notification)
            try {
                manager.notify(id, notification)
            } catch (_: Throwable) {
                manager.notify(id, notification(context, title, text, android.R.drawable.stat_notify_error))
            }
        } catch (_: Throwable) {
            // Posting must not become a second crash.
        }
    }

    private fun notification(context: Context, title: String, text: String, icon: Int): Notification {
        return Notification.Builder(context.applicationContext, CHANNEL)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(text.take(120))
            .setStyle(Notification.BigTextStyle().bigText(text.take(1200)))
            .setAutoCancel(true)
            .build()
    }
}
