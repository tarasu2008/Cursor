package com.politetype.ime.ui

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.politetype.ime.R
import com.politetype.ime.data.Preferences
import com.politetype.ime.ime.PoliteTypeService

class SetupActivity : android.app.Activity() {
    private lateinit var prefs: Preferences
    private lateinit var status: TextView
    private var binding = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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

        wire(R.id.polite_switch) { prefs.polite = it }
        wire(R.id.pro_switch) { prefs.professional = it }
        wire(R.id.autocorrect_switch) { prefs.autocorrect = it }
        wire(R.id.haptic_switch) { prefs.haptic = it }
        wire(R.id.double_space_switch) { prefs.doubleSpacePeriod = it }
        findViewById<EditText>(R.id.try_field).requestFocus()
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun wire(id: Int, write: (Boolean) -> Unit) {
        findViewById<Switch>(id).setOnCheckedChangeListener { _, checked ->
            if (!binding) write(checked)
        }
    }

    private fun render() {
        binding = true
        findViewById<Switch>(R.id.polite_switch).isChecked = prefs.polite
        findViewById<Switch>(R.id.pro_switch).isChecked = prefs.professional
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
    }
}
