package com.politetype.ime.data

import android.content.Context
import android.os.Build
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Writes a plain-text log the phone owner can open without a computer.
 * The file lives in this app's own folder:
 * Android/data/com.politetype.ime/files/crash-log.txt
 */
object CrashLog {
    private const val NAME = "crash-log.txt"
    private const val MAX_BYTES = 200_000

    fun install(context: Context) {
        val app = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            record(app, "uncaught on ${thread.name}", error)
            previous?.uncaughtException(thread, error)
        }
    }

    fun note(context: Context, message: String) {
        append(context, "${stamp()}  $message")
    }

    fun record(context: Context, where: String, error: Throwable) {
        val text = buildString {
            appendLine("---")
            appendLine(stamp())
            appendLine("${Build.MANUFACTURER} ${Build.MODEL}  Android ${Build.VERSION.RELEASE}  API ${Build.VERSION.SDK_INT}")
            appendLine(where)
            append(Log.getStackTraceString(error))
        }
        append(context, text)
    }

    fun read(context: Context): String {
        val file = file(context)
        if (!file.exists()) return ""
        return try {
            val text = file.readText()
            if (text.length > 12_000) text.takeLast(12_000) else text
        } catch (_: Throwable) {
            ""
        }
    }

    fun path(context: Context): String = file(context).absolutePath

    private fun append(context: Context, text: String) {
        try {
            val file = file(context)
            file.parentFile?.mkdirs()
            file.appendText(text.trimEnd() + "\n")
            if (file.length() > MAX_BYTES) {
                file.writeText(file.readText().takeLast(MAX_BYTES / 2))
            }
        } catch (_: Throwable) {
            // Logging must never become the crash.
        }
    }

    private fun file(context: Context): File {
        val dir = context.applicationContext.getExternalFilesDir(null)
            ?: context.applicationContext.filesDir
        return File(dir, NAME)
    }

    private fun stamp(): String {
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
    }
}
