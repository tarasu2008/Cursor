package com.politetype.engine

/**
 * On-device English fixes for the current sentence.
 * Rules are intentionally narrow so a correct sentence is left unchanged.
 */
object Grammar {
    private val repeatWords = setOf(
        "the", "a", "an", "to", "of", "and", "in", "is", "it", "on", "for", "that",
        "this", "with", "at", "by", "from", "or", "if", "be", "as", "i"
    )
    private val modals = setOf(
        "will", "would", "can", "could", "shall", "should", "may", "might", "must", "did"
    )
    private val haveModals = setOf("could", "should", "would", "might", "must")
    private val adverbs = setOf(
        "really", "just", "also", "always", "never", "still", "already", "often", "usually", "only", "even"
    )
    private val singular = setOf("he", "she", "it")
    private val plural = setOf("we", "they", "you")
    private val demonstratives = setOf("this", "that")
    private val verbs = setOf(
        "go", "do", "have", "try", "want", "need", "like", "know", "think", "see", "come", "make", "take",
        "get", "say", "tell", "ask", "give", "find", "work", "call", "feel", "seem", "look", "use", "keep",
        "leave", "put", "mean", "become", "show", "hear", "play", "run", "move", "live", "believe", "hold",
        "bring", "happen", "write", "sit", "stand", "lose", "pay", "meet", "include", "continue", "learn",
        "change", "lead", "understand", "watch", "follow", "stop", "create", "speak", "read", "spend",
        "grow", "open", "walk", "win", "offer", "remember", "love", "consider", "appear", "buy", "wait",
        "serve", "send", "build", "stay", "fall", "reach", "remain", "suggest", "raise", "pass", "sell",
        "require", "report", "decide", "share", "check", "review", "confirm", "update", "reply", "fix",
        "start", "finish", "complete", "submit", "approve", "book", "cancel", "provide", "explain"
    )
    private val letsNext = setOf(
        "go", "do", "get", "try", "see", "make", "take", "talk", "start", "stop", "eat", "be", "not", "meet"
    )
    private val youreNext = setOf(
        "welcome", "going", "coming", "trying", "getting", "making", "doing", "looking", "being",
        "not", "so", "just", "still", "already", "always", "never", "really", "also", "here", "there",
        "done", "ready", "late", "sorry", "sure", "able", "about", "my", "a", "an", "the", "our", "their"
    )
    private val possessiveNouns = setOf(
        "house", "car", "name", "friend", "friends", "dog", "cat", "phone", "email", "team", "work",
        "job", "family", "mom", "dad", "boss", "account", "address", "number", "message", "order",
        "payment", "file", "report", "idea", "brother", "sister", "wife", "husband", "kids", "children",
        "manager", "password", "office", "room", "key", "keys", "bag", "book", "computer", "laptop"
    )
    private val gerunds = setOf(
        "going", "coming", "trying", "getting", "making", "doing", "looking", "being", "saying",
        "taking", "having", "waiting", "working", "leaving"
    )
    private val itsContractNext = setOf(
        "a", "an", "the", "been", "not", "just", "so", "time", "going", "getting", "really", "very",
        "only", "still", "already", "about", "like", "because", "ok", "okay"
    )
    private val itsPossessNext = setOf(
        "own", "color", "colour", "size", "shape", "price", "value", "meaning", "purpose", "result",
        "content", "contents", "title", "name"
    )
    private val anExceptions = setOf(
        "hour", "hours", "honest", "honestly", "honesty", "heir", "heirs", "honor", "honour",
        "honorable", "honourable", "herb", "herbs"
    )
    private val anAcronyms = setOf(
        "fbi", "fda", "fcc", "html", "hdmi", "led", "lcd", "nfl", "nba", "mvp", "faq", "hr", "sql",
        "api", "rss", "xml", "ssh", "ftp", "http", "url", "mph"
    )
    private val aExceptions = setOf(
        "university", "universities", "user", "users", "union", "unions", "unique", "unit", "units",
        "united", "uniform", "uniforms", "euro", "euros", "european", "one", "once", "useful",
        "useless", "usage", "usual", "usually", "usb", "ui"
    )

    fun correct(text: String, isWord: (String) -> Boolean = { true }): String {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return trimmed
        val tokens = Text.tokenize(trimmed)
        if (tokens.isEmpty()) return trimmed
        val protected = tokens.last().takeIf { incomplete(it, isWord) }

        expandMisspellings(tokens, protected)
        fixLets(tokens, protected)
        fixModalOf(tokens, protected)
        fixArticles(tokens, protected)
        fixHomophones(tokens, protected)
        fixAgreement(tokens, protected)
        fixVerbs(tokens, protected, isWord)
        fixUsage(tokens, protected)
        fixRepeats(tokens)
        fixPronounI(tokens)
        return capitalizeSentences(Text.detokenize(tokens))
    }

    private fun incomplete(token: String, isWord: (String) -> Boolean): Boolean {
        val core = token.trim { it in ".,!?;:\"'()[]{}" }
        if (core.isEmpty() || !core[0].isLetter()) return false
        val lower = core.lowercase()
        if (lower == "i" || lower == "a") return false
        if (Misspellings.fix(lower) != null) return false
        if (Verbs.isRecognized(lower)) return false
        if (isWord(lower)) return false
        return true
    }

    private fun isProtected(tokens: List<String>, index: Int, protected: String?): Boolean {
        return protected != null && index == tokens.lastIndex && tokens[index] == protected
    }

    private fun expandMisspellings(tokens: MutableList<String>, protected: String?) {
        var index = 0
        while (index < tokens.size) {
            if (isProtected(tokens, index, protected)) {
                index++
                continue
            }
            val fix = Misspellings.fix(letterCore(tokens[index]).lowercase())
            if (fix == null) {
                index++
                continue
            }
            val parts = fix.split(' ')
            val cased = parts.mapIndexed { partIndex, part ->
                if (partIndex == 0) Text.matchCase(tokens[index], part) else part
            }
            tokens.removeAt(index)
            tokens.addAll(index, cased)
            index += cased.size
        }
    }

    private fun fixLets(tokens: MutableList<String>, protected: String?) {
        for (index in tokens.indices) {
            if (isProtected(tokens, index, protected)) continue
            if (letterCore(tokens[index]).lowercase() != "lets") continue
            val next = tokens.getOrNull(index + 1)?.let { letterCore(it).lowercase() } ?: continue
            if (next !in letsNext) continue
            val previous = tokens.getOrNull(index - 1)?.let { letterCore(it).lowercase() }
            if (previous in singular || previous in demonstratives) continue
            tokens[index] = Text.matchCase(tokens[index], "let's")
        }
    }

    private fun fixModalOf(tokens: MutableList<String>, protected: String?) {
        for (index in 1 until tokens.size) {
            if (isProtected(tokens, index, protected)) continue
            if (letterCore(tokens[index]).lowercase() != "of") continue
            val previous = letterCore(tokens[index - 1]).lowercase()
            if (previous !in haveModals) continue
            tokens[index] = Text.matchCase(tokens[index], "have")
        }
    }

    private fun fixArticles(tokens: MutableList<String>, protected: String?) {
        for (index in 0 until tokens.lastIndex) {
            if (isProtected(tokens, index + 1, protected)) continue
            val article = letterCore(tokens[index]).lowercase()
            if (article != "a" && article != "an") continue
            val next = letterCore(tokens[index + 1]).lowercase()
            if (next.isEmpty() || !next[0].isLetter()) continue
            val desired = desiredArticle(next)
            if (desired != article) {
                tokens[index] = Text.matchCase(tokens[index], desired)
            }
        }
    }

    private fun desiredArticle(next: String): String {
        if (next in anExceptions || next in anAcronyms) return "an"
        if (next in aExceptions) return "a"
        return if (next[0] in "aeiou") "an" else "a"
    }

    private fun fixHomophones(tokens: MutableList<String>, protected: String?) {
        for (index in tokens.indices) {
            if (isProtected(tokens, index, protected)) continue
            val word = letterCore(tokens[index]).lowercase()
            val next = tokens.getOrNull(index + 1)?.let { letterCore(it).lowercase() } ?: continue
            val replacement = when (word) {
                "your" -> if (next in youreNext) "you're" else null
                "you're" -> if (next in possessiveNouns) "your" else null
                "their" -> when {
                    next in setOf("is", "are", "was", "were") -> "there"
                    next in gerunds -> "they're"
                    else -> null
                }
                "there" -> when {
                    next in gerunds -> "they're"
                    next in possessiveNouns -> "their"
                    else -> null
                }
                "were" -> {
                    val previous = tokens.getOrNull(index - 1)?.let { letterCore(it).lowercase() }
                    val blocked = previous in setOf(
                        "i", "we", "they", "you", "he", "she", "it", "who", "there", "what", "where"
                    )
                    if (!blocked && next in gerunds) "we're" else null
                }
                "they're" -> when {
                    next == "is" || next == "was" -> "there"
                    next == "are" || next == "were" -> "they"
                    next in possessiveNouns -> "their"
                    else -> null
                }
                "its" -> if (next in itsContractNext) "it's" else null
                "it's" -> if (next in itsPossessNext) "its" else null
                else -> null
            }
            if (replacement != null) {
                tokens[index] = Text.matchCase(tokens[index], replacement)
            }
        }
    }

    private fun fixAgreement(tokens: MutableList<String>, protected: String?) {
        for (index in tokens.indices) {
            val subject = letterCore(tokens[index]).lowercase()
            if (subject !in singular && subject !in plural && subject != "i" && subject !in demonstratives) {
                continue
            }
            var verbIndex = index + 1
            var sawModal = false
            var hops = 0
            while (verbIndex < tokens.size && hops < 2) {
                val gap = letterCore(tokens[verbIndex]).lowercase()
                if (gap in adverbs || gap in modals || gap == "to") {
                    if (gap in modals || gap == "to") sawModal = true
                    verbIndex++
                    hops++
                    continue
                }
                break
            }
            if (verbIndex >= tokens.size || isProtected(tokens, verbIndex, protected)) continue
            val verb = letterCore(tokens[verbIndex])
            if (verb.isEmpty() || !verb[0].isLetter()) continue
            val previous = tokens.getOrNull(index - 1)?.let { letterCore(it).lowercase() }
            val replacement = if (sawModal) {
                toBase(verb.lowercase())
            } else {
                agree(subject, verb.lowercase(), previous)
            }
            if (replacement != null && !replacement.equals(verb, ignoreCase = true)) {
                tokens[verbIndex] = Text.matchCase(verb, replacement)
            }
        }
    }

    private fun agree(subject: String, verb: String, previous: String?): String? {
        val subjunctive = previous in setOf("if", "wish", "as", "though")
        if (subject in demonstratives) {
            return when (verb) {
                "are", "am" -> "is"
                "were" -> if (subjunctive) null else "was"
                "have" -> "has"
                "do" -> "does"
                "don't" -> "doesn't"
                else -> null
            }
        }
        when (subject) {
            "i" -> when (verb) {
                "is", "are" -> return "am"
                "were" -> return if (subjunctive) null else "was"
                "has" -> return "have"
                "does" -> return "do"
                "doesn't" -> return "don't"
            }
            in singular -> when (verb) {
                "are", "am" -> return "is"
                "were" -> return if (subjunctive) null else "was"
                "have" -> return "has"
                "do" -> return "does"
                "don't" -> return "doesn't"
            }
            in plural -> when (verb) {
                "is", "am" -> return "are"
                "was" -> return "were"
                "has" -> return "have"
                "does" -> return "do"
                "doesn't" -> return "don't"
            }
        }
        if (verb in verbs && subject in singular) return sForm(verb)
        val base = toBase(verb)
        if (base != null && (subject == "i" || subject in plural)) return base
        return null
    }

    private fun sForm(verb: String): String = when (verb) {
        "have" -> "has"
        "do" -> "does"
        "go" -> "goes"
        else -> {
            if (verb.endsWith("y") && verb.length > 1 && verb[verb.length - 2] !in "aeiou") {
                verb.dropLast(1) + "ies"
            } else if (verb.endsWith("s") || verb.endsWith("sh") || verb.endsWith("ch") ||
                verb.endsWith("x") || verb.endsWith("z") || verb.endsWith("o")
            ) {
                verb + "es"
            } else {
                verb + "s"
            }
        }
    }

    private fun toBase(verb: String): String? = when (verb) {
        "goes" -> "go"
        "does" -> "do"
        "has" -> "have"
        "doesn't" -> "don't"
        "is", "are", "am", "was", "were" -> null
        else -> {
            val ies = if (verb.endsWith("ies") && verb.length > 4) verb.dropLast(3) + "y" else null
            when {
                ies != null && ies in verbs -> ies
                verb.endsWith("es") && verb.dropLast(2) in verbs -> verb.dropLast(2)
                verb.endsWith("s") && verb.dropLast(1) in verbs -> verb.dropLast(1)
                else -> null
            }
        }
    }

    private fun fixRepeats(tokens: MutableList<String>) {
        var index = 1
        while (index < tokens.size) {
            val current = letterCore(tokens[index]).lowercase()
            val previous = letterCore(tokens[index - 1]).lowercase()
            if (current.isNotEmpty() && current == previous && current in repeatWords) {
                tokens.removeAt(index)
            } else {
                index++
            }
        }
    }

    private fun fixVerbs(tokens: MutableList<String>, protected: String?, isWord: (String) -> Boolean) {
        for (index in tokens.indices) {
            if (isProtected(tokens, index, protected)) continue
            val core = letterCore(tokens[index])
            if (core.isEmpty() || !core[0].isLetter()) continue
            val previous = tokens.getOrNull(index - 1)?.let { letterCore(it) }
            val replacement = Verbs.fix(core, previous, isWord) ?: continue
            if (!replacement.equals(core, ignoreCase = true)) {
                tokens[index] = Text.matchCase(core, replacement)
            }
        }
    }

    private val comparatives = setOf(
        "better", "worse", "more", "less", "rather", "other", "later", "earlier", "bigger",
        "smaller", "higher", "lower", "faster", "slower", "easier", "harder", "stronger",
        "weaker", "older", "younger", "greater", "fewer", "closer", "farther", "further",
        "nicer", "larger", "smaller", "sooner", "longer", "shorter"
    )
    private val didNot = setOf("did", "didn't", "do", "don't", "does", "doesn't", "to", "will", "would")
    private val abbreviations = setOf(
        "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "ie", "eg", "vs", "am", "pm",
        "etc", "vol", "fig", "no", "pp", "ave"
    )

    private fun fixUsage(tokens: MutableList<String>, protected: String?) {
        for (index in tokens.indices) {
            if (isProtected(tokens, index, protected)) continue
            val core = letterCore(tokens[index]).lowercase()
            val previous = tokens.getOrNull(index - 1)?.let { letterCore(it).lowercase() }
            val next = tokens.getOrNull(index + 1)?.let { letterCore(it).lowercase() }
            if (core == "then" && previous in comparatives) {
                tokens[index] = Text.matchCase(letterCore(tokens[index]), "than")
            }
            if ((core == "suppose" || core == "use") && next == "to" && previous !in didNot) {
                val replacement = if (core == "suppose") "supposed" else "used"
                tokens[index] = Text.matchCase(letterCore(tokens[index]), replacement)
            }
            if (core == "i" && previous == "and" &&
                index >= 3 && letterCore(tokens[index - 2]).equals("you", true) &&
                letterCore(tokens[index - 3]).equals("between", true)
            ) {
                tokens[index] = "me"
            }
        }
    }

    private fun capitalizeSentences(text: String): String {
        val chars = text.toCharArray()
        var capitalize = true
        var index = 0
        while (index < chars.size) {
            val char = chars[index]
            if (char.isWhitespace()) {
                index++
                continue
            }
            if (capitalize && char.isLetter()) {
                val next = chars.getOrNull(index + 1)
                if (char.isLowerCase() && (next == null || !next.isLetter() || next.isLowerCase())) {
                    chars[index] = char.uppercaseChar()
                }
                capitalize = false
            } else if (!char.isLetter() && char != '\'') {
                capitalize = false
            }
            if (char == '.' || char == '!' || char == '?') {
                val prev = chars.getOrNull(index - 1)
                val next = chars.getOrNull(index + 1)
                val decimal = char == '.' && prev?.isDigit() == true && next?.isDigit() == true
                val boundary = next == null || next.isWhitespace()
                if (!decimal && boundary && !abbreviationBefore(chars, index)) capitalize = true
            }
            index++
        }
        return String(chars)
    }

    private fun abbreviationBefore(chars: CharArray, period: Int): Boolean {
        var end = period
        var start = period - 1
        while (start >= 0 && chars[start].isLetter()) start--
        start++
        if (start >= end) return false
        return chars.concatToString(start, end).lowercase() in abbreviations
    }

    private fun fixPronounI(tokens: MutableList<String>) {
        for (index in tokens.indices) {
            if (letterCore(tokens[index]).equals("i", ignoreCase = true) && letterCore(tokens[index]).length == 1) {
                tokens[index] = "I"
            }
        }
    }

    private fun letterCore(token: String): String = token.trim { it in ".,!?;:\"'()[]{}" }
}
