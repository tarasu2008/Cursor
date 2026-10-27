package com.politetype.engine

class SuggestionEngine(private val lexicon: Lexicon) {
    fun suggest(
        beforeCursor: String,
        afterCursor: String,
        field: FieldKind
    ): List<Suggestion> {
        if (field == FieldKind.PASSWORD || field == FieldKind.NUMBER) return emptyList()
        val results = ArrayList<Suggestion>(6)
        val prefix = Sentences.wordPrefix(beforeCursor)
        val suffix = Sentences.wordSuffix(afterCursor)
        val insideWord = prefix.isNotEmpty()
        val cursorSplitsWord = suffix.isNotEmpty() && afterCursor.firstOrNull()?.isLetter() == true
        val current = (prefix + suffix).lowercase()
        val currentComplete = insideWord && !cursorSplitsWord && (
            lexicon.isWord(current) || Misspellings.fix(current) != null || Verbs.isRecognized(current)
        )

        if (insideWord && !currentComplete) {
            results.addAll(wordSuggestions(prefix + suffix, prefix.length, suffix.length))
        } else if (field == FieldKind.TEXT && !cursorSplitsWord) {
            results.addAll(rewriteSuggestions(beforeCursor, afterCursor))
            if (results.isEmpty() && !insideWord) results.addAll(nextWordSuggestions(beforeCursor))
        }
        if (field == FieldKind.EMAIL) {
            results.addAll(emailSuggestions(beforeCursor, prefix))
        }
        if (field == FieldKind.URI && beforeCursor.isBlank()) {
            results.add(Suggestion("https://", "https://", 0, 0, SuggestionKind.COMPLETION))
            results.add(Suggestion("www.", "www.", 0, 0, SuggestionKind.COMPLETION))
        }
        return results.distinctBy { it.text to it.replaceBefore }.take(3)
    }

    /** Improved versions of the draft. No mode switch: every real improvement is offered. */
    private fun rewriteSuggestions(before: String, after: String): List<Suggestion> {
        val atEnd = after.isBlank()
        val sentenceBreaks = before.count { it == '.' || it == '!' || it == '?' || it == '\n' }
        val wholeDraft = atEnd && (before.length >= 48 || sentenceBreaks >= 2)
        val start = if (wholeDraft) {
            before.indexOfFirst { !it.isWhitespace() }.let { if (it < 0) return emptyList() else it }
        } else {
            Sentences.contentStart(before)
        }
        val raw = before.substring(start)
        val core = raw.trim()
        if (core.isEmpty() || core.length > 700 || !lastWordReady(core)) return emptyList()
        val grammar = Grammar.correct(core) { lexicon.isWord(it) }
        val polite = Tone.polite(grammar)
        val professional = Tone.professional(grammar)
        val both = Tone.professional(polite)
        val ranked = listOf(
            grammar to SuggestionKind.GRAMMAR,
            polite to SuggestionKind.POLITE,
            professional to SuggestionKind.PROFESSIONAL,
            both to SuggestionKind.POLITE
        )
        val meaningful = ranked.filter { (text, _) ->
            Text.normalize(text) != Text.normalize(core) && !onlyCapitalized(core, text)
        }
        val chosen = if (meaningful.isNotEmpty()) {
            meaningful
        } else {
            ranked.filter { (text, _) ->
                Text.normalize(text) != Text.normalize(core) && !onlyTrivial(core, text)
            }
        }
        val keepSpace = raw.lastOrNull()?.isWhitespace() == true
        val seen = LinkedHashSet<String>()
        val out = ArrayList<Suggestion>(3)
        for ((text, kind) in chosen) {
            val normalized = Text.normalize(text)
            if (!seen.add(normalized)) continue
            val shown = if (keepSpace && !text.endsWith(" ")) "$text " else text
            out.add(
                Suggestion(
                    label = shown.trim(),
                    text = shown,
                    replaceBefore = raw.length,
                    replaceAfter = 0,
                    kind = if (text == grammar) SuggestionKind.GRAMMAR else kind
                )
            )
            if (out.size == 3) break
        }
        return out
    }

    private fun onlyTrivial(original: String, fixed: String): Boolean {
        return onlyCapitalized(original, fixed) &&
            original.split(Regex("\\s+")).size < 2 &&
            !original.equals("i", true)
    }

    private fun lastWordReady(core: String): Boolean {
        val last = core.trim().substringAfterLast(' ').trim { it in ".,!?;:\"'" }
        if (last.isEmpty()) return true
        if (!last[0].isLetter()) return true
        val lower = last.lowercase()
        if (lower == "i" || lower == "a") return true
        if (Misspellings.fix(lower) != null) return true
        if (Verbs.isRecognized(lower)) return true
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
