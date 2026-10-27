package com.politetype.ime.data

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.politetype.engine.Lexicon
import com.politetype.engine.SuggestionEngine
import kotlin.concurrent.thread

object LexiconLoader {
    @Volatile
    var lexicon: Lexicon? = null
        private set

    @Volatile
    var engine: SuggestionEngine? = null
        private set

    private val waiting = ArrayList<() -> Unit>()
    private var started = false

    fun ensure(context: Context, onReady: (() -> Unit)? = null) {
        if (engine != null) {
            onReady?.invoke()
            return
        }
        val app = context.applicationContext
        synchronized(this) {
            if (engine != null) {
                onReady?.invoke()
                return
            }
            if (onReady != null) waiting.add(onReady)
            if (started) return
            started = true
        }
        thread(name = "politetype-lexicon", isDaemon = true) {
            try {
                val words = app.assets.open("lexicon.txt").bufferedReader().use { it.readLines() }
                val loaded = Lexicon(words)
                lexicon = loaded
                engine = SuggestionEngine(loaded)
            } catch (_: Throwable) {
                synchronized(this) { started = false }
            }
            val callbacks = synchronized(this) { waiting.toList().also { waiting.clear() } }
            Handler(Looper.getMainLooper()).post {
                callbacks.forEach { it.invoke() }
            }
        }
    }
}
