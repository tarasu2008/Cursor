package com.politetype.ime.data

import android.content.Context
import android.content.SharedPreferences

class Preferences(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    var polite: Boolean
        get() = prefs.getBoolean(KEY_POLITE, false)
        set(value) = prefs.edit().putBoolean(KEY_POLITE, value).apply()

    var professional: Boolean
        get() = prefs.getBoolean(KEY_PRO, false)
        set(value) = prefs.edit().putBoolean(KEY_PRO, value).apply()

    var autocorrect: Boolean
        get() = prefs.getBoolean(KEY_AUTOCORRECT, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTOCORRECT, value).apply()

    var haptic: Boolean
        get() = prefs.getBoolean(KEY_HAPTIC, true)
        set(value) = prefs.edit().putBoolean(KEY_HAPTIC, value).apply()

    var doubleSpacePeriod: Boolean
        get() = prefs.getBoolean(KEY_DOUBLE_SPACE, true)
        set(value) = prefs.edit().putBoolean(KEY_DOUBLE_SPACE, value).apply()

    fun listen(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        prefs.registerOnSharedPreferenceChangeListener(listener)
    }

    fun unlisten(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        prefs.unregisterOnSharedPreferenceChangeListener(listener)
    }

    private companion object {
        const val NAME = "polite_type"
        const val KEY_POLITE = "polite"
        const val KEY_PRO = "professional"
        const val KEY_AUTOCORRECT = "autocorrect"
        const val KEY_HAPTIC = "haptic"
        const val KEY_DOUBLE_SPACE = "double_space"
    }
}
