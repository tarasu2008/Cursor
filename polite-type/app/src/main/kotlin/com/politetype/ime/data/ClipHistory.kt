package com.politetype.ime.data

import android.content.Context

/** Last few text clips, stored in preferences. Not a database and not synced. */
class ClipHistory(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun recent(): List<String> {
        return prefs.getString(KEY, "").orEmpty()
            .split(SEPARATOR)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .take(MAX)
    }

    fun add(text: String) {
        val clean = text.replace(SEPARATOR.toString(), " ").trim().take(500)
        if (clean.isEmpty()) return
        val next = listOf(clean) + recent().filter { it != clean }
        prefs.edit().putString(KEY, next.take(MAX).joinToString(SEPARATOR.toString())).apply()
    }

    private companion object {
        const val NAME = "polite_type_clips"
        const val KEY = "items"
        const val SEPARATOR = '\u001e'
        const val MAX = 18
    }
}
