package com.politetype.engine

object Sentences {
    fun contentStart(before: String): Int {
        var start = 0
        var index = before.length - 1
        while (index >= 0) {
            val char = before[index]
            if (char == '\n' || char == '!' || char == '?') {
                start = index + 1
                break
            }
            if (char == '.') {
                val prev = before.getOrNull(index - 1)
                val next = before.getOrNull(index + 1)
                if (!(prev?.isDigit() == true && next?.isDigit() == true)) {
                    start = index + 1
                    break
                }
            }
            index--
        }
        while (start < before.length && before[start].isWhitespace()) start++
        return start
    }

    fun shouldAutoCap(before: String): Boolean {
        if (before.isEmpty()) return true
        if (!before.last().isWhitespace()) return false
        val trimmed = before.trimEnd()
        if (trimmed.isEmpty()) return true
        val char = trimmed.last()
        if (char == '.' ) {
            val prev = trimmed.getOrNull(trimmed.lastIndex - 1)
            if (prev?.isDigit() == true) return false
        }
        return char == '.' || char == '!' || char == '?' || char == '\n'
    }

    fun previousWord(before: String): String? {
        if (before.isEmpty() || !before.last().isWhitespace()) return null
        val word = before.trimEnd().takeLastWhile { it.isLetter() || it == '\'' }
        return word.lowercase().ifEmpty { null }
    }

    fun wordPrefix(before: String): String {
        if (before.isEmpty() || !(before.last().isLetter() || before.last() == '\'')) return ""
        return before.takeLastWhile { it.isLetter() || it == '\'' }
    }

    fun wordSuffix(after: String): String = after.takeWhile { it.isLetter() || it == '\'' }
}
