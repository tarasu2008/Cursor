package com.politetype.ime.data

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import com.politetype.ime.R
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Saves the reason PoliteType closed, shows it as a notification, and copies it to Downloads.
 */
object CrashLog {
    private const val NAME = "crash-log.txt"
    private const val DOWNLOAD_NAME = "PoliteType-crash.txt"
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
        val body = read(context).ifBlank { text }
        copyToDownloads(context, body)
        Alerts.show(
            context,
            context.getString(R.string.notification_crash_title),
            "$where\n${error.javaClass.simpleName}: ${error.message ?: ""}",
            1
        )
    }

    fun read(context: Context): String {
        val external = readFile(externalFile(context))
        if (external.isNotBlank()) return external
        return readFile(File(context.applicationContext.filesDir, NAME))
    }

    fun path(context: Context): String = externalFile(context).absolutePath

    private fun append(context: Context, text: String) {
        val line = text.trimEnd() + "\n"
        write(externalFile(context), line)
        write(File(context.applicationContext.filesDir, NAME), line)
    }

    private fun write(file: File, text: String) {
        try {
            file.parentFile?.mkdirs()
            file.appendText(text)
            if (file.length() > MAX_BYTES) {
                file.writeText(file.readText().takeLast(MAX_BYTES / 2))
            }
        } catch (_: Throwable) {
            // Logging must never become the crash.
        }
    }

    private fun readFile(file: File): String {
        if (!file.exists()) return ""
        return try {
            val text = file.readText()
            if (text.length > 12_000) text.takeLast(12_000) else text
        } catch (_: Throwable) {
            ""
        }
    }

    private fun externalFile(context: Context): File {
        val dir = context.applicationContext.getExternalFilesDir(null)
            ?: context.applicationContext.filesDir
        return File(dir, NAME)
    }

    private fun copyToDownloads(context: Context, body: String) {
        try {
            val resolver = context.applicationContext.contentResolver
            val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, DOWNLOAD_NAME)
                put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            val uri = resolver.insert(collection, values) ?: return
            resolver.openOutputStream(uri)?.use { stream ->
                stream.write(body.toByteArray())
            }
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } catch (_: Throwable) {
            // Downloads can be unavailable. The in-app log still exists.
        }
    }

    private fun stamp(): String {
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
    }
}
