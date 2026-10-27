package com.politetype.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GrammarTest {
    private val words = setOf(
        "he", "she", "it", "they", "we", "you", "i", "am", "is", "are", "was", "were", "go", "goes",
        "have", "has", "do", "does", "the", "a", "an", "apple", "hour", "university", "banana", "house",
        "welcome", "going", "color", "own", "name", "cat", "happy", "to", "school", "store", "problem",
        "been", "of", "could", "should", "would", "not", "know", "this", "that", "there", "their", "car",
        "file", "send", "please", "me", "want", "report", "good", "normal", "sentence", "fine", "hello",
        "book", "time", "really", "can", "late", "rich", "if", "test", "people", "lot", "well", "home",
        "check", "this", "help", "for", "thanks", "message", "today", "team", "friend", "lets", "him"
    )

    private fun fix(text: String) = Grammar.correct(text) { it.lowercase() in words }

    @Test
    fun leavesCorrectSentencesAlone() {
        listOf(
            "Hello, this is a normal sentence.",
            "He goes to school.",
            "An apple",
            "A banana",
            "An hour",
            "A university",
            "You're welcome",
            "There is a problem",
            "They're going home",
            "It's a test",
            "Its color",
            "Its own",
            "He can go",
            "If I were rich",
            "They were late.",
            "She lets him",
            "I am happy.",
            "This is fine"
        ).forEach { sentence ->
            assertEquals(sentence, fix(sentence))
        }
    }

    @Test
    fun fixesGrammar() {
        assertEquals("An apple", fix("a apple"))
        assertEquals("A banana", fix("an banana"))
        assertEquals("An hour", fix("a hour"))
        assertEquals("A university", fix("an university"))
        assertEquals("I am happy", fix("i am happy"))
        assertEquals("He goes to school", fix("he go to school"))
        assertEquals("She has a car", fix("she have a car"))
        assertEquals("They were late", fix("they was late"))
        assertEquals("He doesn't know", fix("he don't know"))
        assertEquals("He can go", fix("he can goes"))
        assertEquals("I was happy", fix("I were happy"))
        assertEquals("Could have been", fix("could of been"))
        assertEquals("A lot of time", fix("alot of time"))
        assertEquals("You're welcome", fix("your welcome"))
        assertEquals("You're going", fix("your going"))
        assertEquals("Your house", fix("you're house"))
        assertEquals("There is a problem", fix("their is a problem"))
        assertEquals("They're going home", fix("there going home"))
        assertEquals("It's a test", fix("its a test"))
        assertEquals("Its own", fix("it's own"))
        assertEquals("The cat", fix("the the cat"))
        assertEquals("Don't", fix("dont"))
        assertEquals("Let's go", fix("lets go"))
        assertEquals("We're going home", fix("were going home"))
        assertEquals("Going to send it", fix("gonna send it"))
        assertEquals("He went", fix("he goed"))
        assertEquals("I saw it", fix("I seen it"))
        assertEquals("She has gone", fix("she have went"))
        assertEquals("Better than that", fix("better then that"))
        assertEquals("I used to go", fix("I use to go"))
        assertEquals("He doesn't know. She has a car", fix("he don't know. she have a car"))
        assertEquals("I didn't use to go", fix("I didn't use to go"))
    }

    @Test
    fun isIdempotent() {
        listOf(
            "he go to school",
            "your welcome",
            "a apple",
            "could of been",
            "Hello, this is a normal sentence.",
            "They were late."
        ).forEach { sentence ->
            val once = fix(sentence)
            assertEquals(once, fix(once))
        }
    }

    @Test
    fun doesNotRewritePartialWord() {
        assertEquals("He goes to sch", fix("he go to sch"))
    }
}

class ToneTest {
    @Test
    fun politeRequests() {
        assertEquals("Could you please send the file?", Tone.polite("Send the file"))
        assertEquals("Could you please send the file?", Tone.polite("Could you please send the file?"))
        assertEquals("I would like the report.", Tone.polite("i want the report"))
        assertEquals("Could you please check this?", Tone.polite("can you check this"))
        assertEquals("Thanks for the help", Tone.polite("Thanks for the help"))
    }

    @Test
    fun professionalExpandsAndFormats() {
        assertEquals("I am gonna send it.", Tone.professional("I'm gonna send it"))
        assertEquals("Hello, could you please send the file?", Tone.professional("Hello, could you please send the file?"))
        assertEquals("Yes", Tone.professional("yeah"))
        assertEquals("He was well.", Tone.professional("He was well."))
    }

    @Test
    fun politeThenProfessional() {
        val toned = Tone.apply("hey can you check this", polite = true, professional = true)
        assertEquals("Hello, could you please check this?", toned)
        assertEquals(toned, Tone.apply(toned, polite = true, professional = true))
    }
}

class LexiconTest {
    private val lexicon = Lexicon(
        listOf(
            "the", "they", "them", "then", "there", "their", "hello", "help", "held", "goes", "go",
            "to", "school", "he", "she", "send", "file", "please", "you", "could", "because", "receive"
        )
    )

    @Test
    fun completionsPreferFrequentWords() {
        assertEquals("the", lexicon.completions("th", 3).first())
        assertTrue(lexicon.completions("hel", 5).contains("hello"))
    }

    @Test
    fun correctsASingleEdit() {
        assertEquals("hello", lexicon.corrections("helo", 3).first())
        assertEquals("the", lexicon.corrections("teh", 3).first())
        assertTrue(lexicon.isWord("because"))
        assertFalse(lexicon.isWord("helo"))
    }
}

class SuggestionEngineTest {
    private val engine = SuggestionEngine(
        Lexicon(
            listOf(
                "the", "they", "them", "then", "there", "their", "hello", "help", "held", "goes", "go",
                "to", "school", "he", "she", "send", "file", "please", "you", "could", "i", "am", "want",
                "report", "check", "this", "can", "happy", "know", "dont"
            )
        )
    )

    @Test
    fun offersGrammarChipAndWordFixes() {
        val suggestions = engine.suggest("he go", "", field = FieldKind.TEXT)
        assertEquals("He goes", suggestions.first { it.kind == SuggestionKind.GRAMMAR }.text)
        val hello = engine.suggest("helo", "", field = FieldKind.TEXT)
        assertTrue(hello.any { it.text.equals("hello", true) })
    }

    @Test
    fun politeChipRewritesTheSentence() {
        val suggestions = engine.suggest("send the file", "", field = FieldKind.TEXT)
        val polite = suggestions.first { it.kind == SuggestionKind.POLITE }
        assertEquals("Could you please send the file?", polite.text)
        assertEquals("send the file".length, polite.replaceBefore)
    }

    @Test
    fun hidesSuggestionsInPasswordFields() {
        assertTrue(
            engine.suggest("helo", "", FieldKind.PASSWORD).isEmpty()
        )
    }

    @Test
    fun predictsTheNextWordAfterASpace() {
        val suggestions = engine.suggest("thank ", "", FieldKind.TEXT)
        assertTrue(suggestions.any { it.kind == SuggestionKind.NEXT_WORD && it.label == "you" })
    }

    @Test
    fun keepsTheTrailingSpaceWhenReplacing() {
        val suggestions = engine.suggest("he go ", "", FieldKind.TEXT)
        val grammar = suggestions.first { it.kind == SuggestionKind.GRAMMAR }
        assertEquals("He goes ", grammar.text)
        assertEquals("he go ".length, grammar.replaceBefore)
    }
}
