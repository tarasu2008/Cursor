package com.politetype.engine

object Text {
    private val tokenPattern = Regex("[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+(?:[.,][0-9]+)?|[^\\s]")
    private val noSpaceBefore = setOf(",", ".", "!", "?", ";", ":", "%", ")", "]", "}", "n't")

    fun tokenize(raw: String): MutableList<String> {
        return tokenPattern.findAll(raw.trim()).map { it.value }.toMutableList()
    }

    fun detokenize(tokens: List<String>): String {
        val sb = StringBuilder()
        for (token in tokens) {
            if (token.isEmpty()) continue
            if (sb.isNotEmpty() && token !in noSpaceBefore && !sb.endsWith("(") && !sb.endsWith("[") && !sb.endsWith("{")) {
                sb.append(' ')
            }
            sb.append(token)
        }
        return sb.toString()
    }

    fun capitalizeFirst(raw: String): String {
        val chars = raw.toCharArray()
        for (i in chars.indices) {
            if (!chars[i].isLetter()) continue
            if (chars[i].isLowerCase()) {
                val next = chars.getOrNull(i + 1)
                if (next == null || !next.isLetter() || next.isLowerCase()) {
                    chars[i] = chars[i].uppercaseChar()
                }
            }
            break
        }
        return String(chars)
    }

    fun matchCase(original: String, replacement: String): String {
        if (original.length > 1 && original.all { !it.isLetter() || it.isUpperCase() }) {
            return replacement.uppercase()
        }
        if (original.firstOrNull()?.isUpperCase() == true) {
            return replacement.replaceFirstChar { char ->
                if (char.isLowerCase()) char.uppercaseChar() else char
            }
        }
        return replacement
    }

    fun normalize(raw: String): String = raw.trim().replace(Regex("\\s+"), " ")

    fun damerau(a: String, b: String): Int {
        if (a == b) return 0
        val n = a.length
        val m = b.length
        if (n == 0) return m
        if (m == 0) return n
        if (kotlin.math.abs(n - m) > 3) return 4
        val d = Array(n + 1) { IntArray(m + 1) }
        for (i in 0..n) d[i][0] = i
        for (j in 0..m) d[0][j] = j
        for (i in 1..n) {
            for (j in 1..m) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                var value = minOf(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) {
                    value = minOf(value, d[i - 2][j - 2] + 1)
                }
                d[i][j] = value
            }
        }
        return d[n][m]
    }
}
