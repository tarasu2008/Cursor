package com.politetype.engine

enum class FieldKind { TEXT, EMAIL, URI, PASSWORD, NUMBER }

enum class SuggestionKind { SPELLING, COMPLETION, NEXT_WORD, GRAMMAR, POLITE, PROFESSIONAL }

data class Suggestion(
    val label: String,
    val text: String,
    val replaceBefore: Int,
    val replaceAfter: Int,
    val kind: SuggestionKind
)
