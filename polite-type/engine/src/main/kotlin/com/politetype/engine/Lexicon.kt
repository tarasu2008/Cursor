package com.politetype.engine

/**
 * Frequency-ordered word list. Earlier words are more common.
 * The delete index is a small SymSpell table so a mistyped word can be
 * corrected without scanning the whole list on every key.
 */
class Lexicon(wordsMostFrequentFirst: List<String>) {
    private val ordered: List<String>
    private val rank: Map<String, Int>
    private val alpha: List<String>
    private val prefix1: Map<String, List<String>>
    private val prefix2: Map<String, List<String>>
    private val deletes: Map<String, List<String>>

    init {
        val cleaned = LinkedHashSet<String>()
        for (raw in wordsMostFrequentFirst) {
            val word = raw.trim().lowercase()
            if (word.isEmpty() || Misspellings.fix(word) != null) continue
            if (word.any { it !in 'a'..'z' && it != '\'' }) continue
            cleaned.add(word)
        }
        ordered = cleaned.toList()
        rank = HashMap(ordered.size)
        ordered.forEachIndexed { index, word -> rank[word] = index }
        alpha = ordered.sorted()
        prefix1 = buckets(1, 16)
        prefix2 = buckets(2, 40)
        deletes = buildDeletes(ordered.take(12_000))
    }

    fun isWord(word: String): Boolean = rank.containsKey(word.lowercase())

    fun completions(prefix: String, limit: Int): List<String> {
        val needle = prefix.lowercase()
        if (needle.isEmpty() || limit <= 0) return emptyList()
        if (!needle.all { it in 'a'..'z' || it == '\'' }) return emptyList()
        val bucket = when {
            needle.length >= 2 -> prefix2[needle.substring(0, 2)]
            else -> prefix1[needle]
        }
        val fromBucket = bucket.orEmpty().filter { it.startsWith(needle) && it != needle }
        if (fromBucket.size >= limit || needle.length <= 2) return fromBucket.take(limit)
        val extra = scanPrefix(needle, limit)
        return (fromBucket + extra).distinct().take(limit)
    }

    fun corrections(typed: String, limit: Int): List<String> {
        val needle = typed.lowercase()
        if (needle.length !in 3..24 || limit <= 0) return emptyList()
        if (!needle.all { it in 'a'..'z' || it == '\'' }) return emptyList()
        val maxDistance = if (needle.length >= 5) 2 else 1
        val candidates = LinkedHashSet<String>()
        deletes[needle]?.let { candidates.addAll(it) }
        eachDelete(needle) { variant ->
            if (rank.containsKey(variant)) candidates.add(variant)
            deletes[variant]?.let { candidates.addAll(it) }
        }
        return candidates
            .asSequence()
            .map { word -> word to Text.damerau(needle, word) }
            .filter { (word, distance) ->
                word != needle && distance in 1..maxDistance &&
                    (distance == 1 || word.first() == needle.first())
            }
            .sortedWith(
                compareBy<Pair<String, Int>> { it.second }
                    .thenBy { if (it.first.first() == needle.first()) 0 else 1 }
                    .thenBy { rank[it.first] ?: Int.MAX_VALUE }
            )
            .map { it.first }
            .distinct()
            .take(limit)
            .toList()
    }

    private fun buckets(length: Int, cap: Int): Map<String, List<String>> {
        val map = HashMap<String, MutableList<String>>()
        for (word in ordered) {
            if (word.length < length) continue
            val key = word.substring(0, length)
            val list = map.getOrPut(key) { ArrayList(cap) }
            if (list.size < cap) list.add(word)
        }
        return map
    }

    private fun buildDeletes(words: List<String>): Map<String, List<String>> {
        val map = HashMap<String, MutableList<String>>()
        for (word in words) {
            if (word.length < 3 || word.length > 16) continue
            eachDelete(word) { variant ->
                if (variant.length < 2) return@eachDelete
                val list = map.getOrPut(variant) { ArrayList(4) }
                if (list.size < 5) list.add(word)
            }
        }
        return map
    }

    private fun scanPrefix(prefix: String, limit: Int): List<String> {
        var low = 0
        var high = alpha.size
        while (low < high) {
            val mid = (low + high) ushr 1
            if (alpha[mid] < prefix) low = mid + 1 else high = mid
        }
        val found = ArrayList<String>(limit)
        var index = low
        while (index < alpha.size && alpha[index].startsWith(prefix) && found.size < 80) {
            if (alpha[index] != prefix) found.add(alpha[index])
            index++
        }
        return found.sortedBy { rank[it] ?: Int.MAX_VALUE }.take(limit)
    }

    private inline fun eachDelete(word: String, block: (String) -> Unit) {
        for (index in word.indices) {
            val variant = word.substring(0, index) + word.substring(index + 1)
            block(variant)
        }
    }
}
