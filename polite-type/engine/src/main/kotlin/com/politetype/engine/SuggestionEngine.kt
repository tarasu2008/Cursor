package com.politetype.engine

class SuggestionEngine(private val lexicon: Lexicon) {
    fun suggest(
        beforeCursor: String,
        afterCursor: String,
        polite: Boolean,
        professional: Boolean,
        field: FieldKind
    ): List<Suggestion> {
        if (field == FieldKind.PASSWORD || field == FieldKind.NUMBER) return emptyList()
        val results = ArrayList<Suggestion>(6)
        val prefix = Sentences.wordPrefix(beforeCursor)
        val suffix = Sentences.wordSuffix(afterCursor)
        val insideWord = prefix.isNotEmpty()
        val cursorSplitsWord = suffix.isNotEmpty() && afterCursor.firstOrNull()?.isLetter() == true

        if (field == FieldKind.TEXT && !cursorSplitsWord) {
            sentenceSuggestion(beforeCursor, polite, professional)?.let { results.add(it) }
        }
        if (insideWord) {
            results.addAll(wordSuggestions(prefix + suffix, prefix.length, suffix.length))
        } else if (field == FieldKind.TEXT) {
            results.addAll(nextWordSuggestions(beforeCursor))
        }
        if (field == FieldKind.EMAIL) {
            results.addAll(emailSuggestions(beforeCursor, prefix))
        }
        if (field == FieldKind.URI && beforeCursor.isBlank()) {
            results.add(Suggestion("https://", "https://", 0, 0, SuggestionKind.COMPLETION))
            results.add(Suggestion("www.", "www.", 0, 0, SuggestionKind.COMPLETION))
        }
        return results.distinctBy { it.text to it.replaceBefore }.take(6)
    }

    private fun sentenceSuggestion(before: String, polite: Boolean, professional: Boolean): Suggestion? {
        val start = Sentences.contentStart(before)
        val raw = before.substring(start)
        val core = raw.trim()
        if (core.isEmpty() || !lastWordReady(core)) return null
        val grammar = Grammar.correct(core) { lexicon.isWord(it) }
        val toned = Tone.apply(grammar, polite, professional)
        if (Text.normalize(toned) == Text.normalize(core)) return null
        if (onlyCapitalized(core, toned) && core.split(Regex("\\s+")).size < 2 &&
            !core.equals("i", true)
        ) {
            return null
        }
        val kind = when {
            polite && toned != grammar -> SuggestionKind.POLITE
            professional && toned != grammar -> SuggestionKind.PROFESSIONAL
            else -> SuggestionKind.GRAMMAR
        }
        val keepSpace = raw.lastOrNull()?.isWhitespace() == true && !toned.endsWith(" ")
        return Suggestion(
            label = toned,
            text = if (keepSpace) "$toned " else toned,
            replaceBefore = raw.length,
            replaceAfter = 0,
            kind = kind
        )
    }

    private fun lastWordReady(core: String): Boolean {
        val last = core.trim().substringAfterLast(' ').trim { it in ".,!?;:\"'" }
        if (last.isEmpty()) return true
        if (!last[0].isLetter()) return true
        val lower = last.lowercase()
        if (lower == "i" || lower == "a") return true
        if (Misspellings.fix(lower) != null) return true
        return lexicon.isWord(lower)
    }

    private fun onlyCapitalized(original: String, fixed: String): Boolean {
        return Text.normalize(original).equals(Text.normalize(fixed), ignoreCase = true)
    }

    private fun wordSuggestions(typed: String, replaceBefore: Int, replaceAfter: Int): List<Suggestion> {
        if (typed.length > 40) return emptyList()
        val lower = typed.lowercase()
        val options = LinkedHashSet<String>()
        Misspellings.fix(lower)?.let { options.add(it) }
        if (lexicon.isWord(lower)) {
            options.addAll(lexicon.completions(lower, 5))
        } else {
            options.addAll(lexicon.corrections(lower, 4))
            options.addAll(lexicon.completions(lower, 3))
        }
        return options
            .filterNot { it.equals(typed, ignoreCase = true) }
            .take(4)
            .map { option ->
                val cased = Text.matchCase(typed, option)
                Suggestion(cased, cased, replaceBefore, replaceAfter, SuggestionKind.SPELLING)
            }
    }

    private fun nextWordSuggestions(before: String): List<Suggestion> {
        val previous = Sentences.previousWord(before) ?: return emptyList()
        val cap = Sentences.shouldAutoCap(before)
        return Bigrams.next(previous).take(4).map { word ->
            val shown = if (cap) word.replaceFirstChar { it.uppercaseChar() } else word
            Suggestion(shown, "$shown ", 0, 0, SuggestionKind.NEXT_WORD)
        }
    }

    private fun emailSuggestions(before: String, prefix: String): List<Suggestion> {
        if ('@' in before.takeLast(60)) {
            if (before.endsWith("@")) {
                return listOf("gmail.com", "outlook.com", "yahoo.com").map {
                    Suggestion(it, it, 0, 0, SuggestionKind.COMPLETION)
                }
            }
            return emptyList()
        }
        if (prefix.isEmpty()) return emptyList()
        val local = prefix.lowercase()
        return listOf("$local@gmail.com", "$local@outlook.com").map {
            Suggestion(it, it, prefix.length, 0, SuggestionKind.COMPLETION)
        }
    }
}
