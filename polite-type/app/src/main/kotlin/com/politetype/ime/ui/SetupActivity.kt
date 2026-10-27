package com.politetype.ime.ui

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.politetype.ime.R
import com.politetype.ime.data.Alerts
import com.politetype.ime.data.CrashLog
import com.politetype.ime.data.Preferences
import com.politetype.ime.ime.PoliteTypeService

class SetupActivity : android.app.Activity() {
    private lateinit var prefs: Preferences
    private lateinit var status: TextView
    private var binding = false
    private var askedNotifications = false
    private val handler = Handler(Looper.getMainLooper())
    private val refreshLog = Runnable { showCrash() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Alerts.ensure(this)
        setContentView(R.layout.activity_setup)
        prefs = Preferences(this)
        status = findViewById(R.id.status)

        findViewById<Button>(R.id.enable).setOnClickListener {
            try {
                startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            } catch (_: ActivityNotFoundException) {
                Toast.makeText(this, R.string.status_off, Toast.LENGTH_LONG).show()
            }
        }
        findViewById<Button>(R.id.choose).setOnClickListener {
            val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showInputMethodPicker()
        }
        findViewById<Button>(R.id.allow_notifications).setOnClickListener { allowNotifications() }

        wire(R.id.autocorrect_switch) { prefs.autocorrect = it }
        wire(R.id.haptic_switch) { prefs.haptic = it }
        wire(R.id.double_space_switch) { prefs.doubleSpacePeriod = it }
        CrashLog.note(this, "setup screen opened")
        if (Build.VERSION.SDK_INT == 29 &&
            checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), REQUEST_STORAGE)
        }
    }

    override fun onResume() {
        super.onResume()
        render()
        handler.removeCallbacks(refreshLog)
        handler.postDelayed(refreshLog, 1500)
    }

    override fun onPause() {
        handler.removeCallbacks(refreshLog)
        super.onPause()
    }

    private fun allowNotifications() {
        Alerts.ensure(this)
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            askedNotifications = true
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
            return
        }
        if (!Alerts.enabled(this)) openNotificationSettings()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS) {
            if (Alerts.enabled(this)) {
                Alerts.show(this, getString(R.string.app_name), getString(R.string.notification_ready), 2)
            } else {
                openNotificationSettings()
            }
        }
        render()
    }

    private fun openNotificationSettings() {
        try {
            startActivity(
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            )
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.notifications_blocked, Toast.LENGTH_LONG).show()
        }
    }

    private fun wire(id: Int, write: (Boolean) -> Unit) {
        findViewById<Switch>(id).setOnCheckedChangeListener { _, checked ->
            if (!binding) write(checked)
        }
    }

    private fun render() {
        binding = true
        findViewById<Switch>(R.id.autocorrect_switch).isChecked = prefs.autocorrect
        findViewById<Switch>(R.id.haptic_switch).isChecked = prefs.haptic
        findViewById<Switch>(R.id.double_space_switch).isChecked = prefs.doubleSpacePeriod
        binding = false

        val id = ComponentName(this, PoliteTypeService::class.java).flattenToShortString()
        val enabled = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_INPUT_METHODS)
        val current = Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
        val isEnabled = enabled?.contains(id) == true || enabled?.contains("PoliteTypeService") == true
        val isCurrent = current?.contains(id) == true || current?.contains("PoliteTypeService") == true
        status.setText(
            when {
                isCurrent -> R.string.status_current
                isEnabled -> R.string.status_on
                else -> R.string.status_off
            }
        )
        showNotifications()
        showCrash()
    }

    private fun showNotifications() {
        val allowed = Alerts.enabled(this)
        findViewById<TextView>(R.id.notification_status).setText(
            if (allowed) R.string.notifications_on else R.string.notifications_blocked
        )
        findViewById<Button>(R.id.allow_notifications).visibility = if (allowed) View.GONE else View.VISIBLE
        if (!allowed && !askedNotifications && Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            askedNotifications = true
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        }
    }

    private fun showCrash() {
        val crash = CrashLog.read(this)
        val view = findViewById<TextView>(R.id.crash_log) ?: return
        view.text = if (crash.isBlank()) {
            getString(R.string.crash_empty) + "\n" + CrashLog.path(this)
        } else {
            CrashLog.path(this) + "\n\n" + crash
        }
    }

    private companion object {
        const val REQUEST_NOTIFICATIONS = 41
        const val REQUEST_STORAGE = 42
    }
}
