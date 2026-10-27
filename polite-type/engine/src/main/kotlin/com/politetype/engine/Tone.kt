package com.politetype.engine

/** Professional and polite rewrites. Applied only after grammar, and only when that mode is on. */
object Tone {
    private val imperatives = setOf(
        "send", "share", "check", "review", "confirm", "update", "call", "email", "reply", "open",
        "close", "fix", "make", "take", "give", "show", "tell", "let", "put", "keep", "start", "stop",
        "move", "add", "remove", "delete", "change", "create", "finish", "complete", "submit",
        "approve", "pay", "book", "schedule", "cancel", "forward", "attach", "upload", "download",
        "print", "sign", "read", "write", "explain", "clarify", "verify", "provide", "prepare",
        "arrange", "inform", "notify", "remind", "accept", "reject", "correct", "revise", "help"
    )
    private val politeStarts = setOf(
        "could", "would", "please", "thank", "thanks", "hello", "sorry", "dear", "good", "may", "i"
    )
    private val slang = listOf(
        "yeah" to "yes",
        "yep" to "yes",
        "nope" to "no",
        "kinda" to "somewhat",
        "sorta" to "somewhat",
        "lemme" to "let me",
        "gimme" to "give me",
        "gotta" to "have to",
        "tryna" to "trying to",
        "rn" to "right now",
        "imo" to "in my opinion",
        "tbh" to "to be honest",
        "lol" to "",
        "omg" to ""
    )
    private val contractions = listOf(
        Regex("(?i)\\bI'm\\b") to "I am",
        Regex("(?i)\\bI've\\b") to "I have",
        Regex("(?i)\\bI'll\\b") to "I will",
        Regex("(?i)\\byou're\\b") to "you are",
        Regex("(?i)\\byou've\\b") to "you have",
        Regex("(?i)\\byou'll\\b") to "you will",
        Regex("(?i)\\bwe're\\b") to "we are",
        Regex("(?i)\\bwe've\\b") to "we have",
        Regex("(?i)\\bwe'll\\b") to "we will",
        Regex("(?i)\\bthey're\\b") to "they are",
        Regex("(?i)\\bthey've\\b") to "they have",
        Regex("(?i)\\bthey'll\\b") to "they will",
        Regex("(?i)\\bhe's\\b") to "he is",
        Regex("(?i)\\bshe's\\b") to "she is",
        Regex("(?i)\\bit's\\b") to "it is",
        Regex("(?i)\\bthat's\\b") to "that is",
        Regex("(?i)\\bthere's\\b") to "there is",
        Regex("(?i)\\bwhat's\\b") to "what is",
        Regex("(?i)\\bhere's\\b") to "here is",
        Regex("(?i)\\blet's\\b") to "let us",
        Regex("(?i)\\bdon't\\b") to "do not",
        Regex("(?i)\\bdoesn't\\b") to "does not",
        Regex("(?i)\\bdidn't\\b") to "did not",
        Regex("(?i)\\bcan't\\b") to "cannot",
        Regex("(?i)\\bwon't\\b") to "will not",
        Regex("(?i)\\bisn't\\b") to "is not",
        Regex("(?i)\\baren't\\b") to "are not",
        Regex("(?i)\\bwasn't\\b") to "was not",
        Regex("(?i)\\bweren't\\b") to "were not",
        Regex("(?i)\\bhaven't\\b") to "have not",
        Regex("(?i)\\bhasn't\\b") to "has not",
        Regex("(?i)\\bhadn't\\b") to "had not",
        Regex("(?i)\\bwouldn't\\b") to "would not",
        Regex("(?i)\\bcouldn't\\b") to "could not",
        Regex("(?i)\\bshouldn't\\b") to "should not",
        Regex("(?i)\\bmustn't\\b") to "must not"
    )

    fun apply(text: String, polite: Boolean, professional: Boolean): String {
        var result = text
        if (polite) result = polite(result)
        if (professional) result = professional(result)
        return result
    }

    fun polite(text: String): String {
        var result = text.trim()
        if (result.isEmpty()) return result
        result = result.replace(Regex("(?i)\\bcan't you\\b"), "could you")
        result = result.replace(Regex("(?i)\\bcannot you\\b"), "could you")
        result = result.replace(Regex("(?i)\\bcan you\\b"), "could you")
        result = result.replace(Regex("(?i)\\bwill you\\b"), "would you")
        result = result.replace(Regex("(?i)\\byou should\\b"), "you might")
        result = result.replace(Regex("(?i)\\byou must\\b"), "please")
        result = result.replace(Regex("(?i)^i want\\b"), "I would like")
        result = result.replace(Regex("(?i)^i need you to\\b"), "Could you please")
        result = result.replace(Regex("(?i)^(give me|tell me)\\b")) { match ->
            "Could you please ${match.value.lowercase()}"
        }
        if (!result.lowercase().contains("please")) {
            result = result.replace(Regex("(?i)\\bcould you\\b"), "could you please")
            result = result.replace(Regex("(?i)\\bwould you\\b"), "would you please")
        }
        result = result.replace(Regex("(?i)^hello could"), "Hello, could")
        result = result.replace(Regex("(?i)^hello would"), "Hello, would")

        val lower = result.lowercase()
        if (lower.startsWith("could you") || lower.startsWith("would you") ||
            lower.startsWith("hello, could") || lower.startsWith("hello, would")
        ) {
            result = result.trimEnd().trimEnd('.', ',', ';', ':', '!')
            if (!result.endsWith("?")) result += "?"
            return result.replaceFirstChar { if (it.isLowerCase()) it.uppercaseChar() else it }
        }
        if ((lower.contains("could you please") || lower.contains("would you please")) &&
            !lower.startsWith("could you") && !lower.startsWith("would you") &&
            !lower.startsWith("hello, could") && !lower.startsWith("hello, would")
        ) {
            result = result.trimEnd().trimEnd('.', ',', ';', ':')
            if (!result.endsWith("?")) result += "?"
            return Text.capitalizeFirst(result)
        }
        if (lower.startsWith("please ")) {
            result = result.replaceFirstChar { if (it.isLowerCase()) it.uppercaseChar() else it }
            return endWith(result, '.')
        }
        if (lower.startsWith("i would like") || lower.startsWith("could i please") ||
            lower.startsWith("could you please")
        ) {
            result = result.replaceFirstChar { if (it.isLowerCase()) it.uppercaseChar() else it }
            return if (result.lowercase().startsWith("could")) endWith(result.trimEnd('.'), '?') else endWith(result, '.')
        }

        val words = result.split(Regex("\\s+"))
        val first = words.first().trim { it in ".,!?;:" }.lowercase()
        if (words.size >= 2 && first in imperatives && first !in politeStarts) {
            val rest = words.toMutableList()
            rest[0] = rest[0].trim { it in ".,!?;:" }.replaceFirstChar { it.lowercaseChar() }
            val body = rest.joinToString(" ").trimEnd('.', '!', '?', ',', ';', ':')
            return "Could you please $body?"
        }
        return Text.capitalizeFirst(result)
    }

    fun professional(text: String): String {
        val tokens = Text.tokenize(text)
        if (tokens.isEmpty()) return text.trim()
        if (tokens.first().equals("hey", true) || tokens.first().equals("hi", true)) {
            tokens[0] = "Hello"
        }
        var index = 0
        while (index < tokens.size) {
            val lower = tokens[index].lowercase()
            val replacement = slang.firstOrNull { it.first == lower }?.second
            if (replacement == null) {
                index++
                continue
            }
            tokens.removeAt(index)
            if (replacement.isNotEmpty()) {
                val parts = replacement.split(' ')
                val cased = parts.mapIndexed { partIndex, part ->
                    if (partIndex == 0) Text.matchCase(lower, part) else part
                }
                tokens.addAll(index, cased)
                index += cased.size
            }
        }
        var sentence = Text.capitalizeFirst(Text.detokenize(tokens))
        for ((pattern, replacement) in contractions) {
            sentence = pattern.replace(sentence, replacement)
        }
        sentence = Text.capitalizeFirst(sentence)
        sentence = sentence.replace(Regex("(?i)^hello could"), "Hello, could")
        sentence = sentence.replace(Regex("(?i)^hello would"), "Hello, would")
        val words = sentence.split(Regex("\\s+")).count { it.any { char -> char.isLetter() } }
        if (words >= 4 && !endsWithTerminal(sentence)) sentence += "."
        return sentence
    }

    private fun endWith(text: String, mark: Char): String {
        val trimmed = text.trimEnd()
        if (endsWithTerminal(trimmed)) return trimmed
        return trimmed + mark
    }

    private fun endsWithTerminal(text: String): Boolean {
        val last = text.lastOrNull() ?: return false
        return last == '.' || last == '!' || last == '?'
    }
}
