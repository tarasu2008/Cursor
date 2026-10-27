package com.politetype.ime.ime

object KeyCodes {
    const val SHIFT = -1
    const val MODE = -2
    const val DONE = -4
    const val DELETE = -5
    const val EMOJI = -6
    const val SPACE = 32
}

class SoftKey(
    val code: Int,
    var label: String,
    val output: String?,
    val popup: String,
    val repeatable: Boolean,
    val special: Boolean,
    val weight: Float,
    var x: Int = 0,
    var y: Int = 0,
    var width: Int = 0,
    var height: Int = 0,
    var pressed: Boolean = false
) {
    fun contains(px: Int, py: Int): Boolean {
        return px >= x && px < x + width && py >= y && py < y + height
    }
}

class KeyRow(val keys: List<SoftKey>, val sideWeight: Float = 0f)

class KeyBoard(val rows: List<KeyRow>) {
    val keys: List<SoftKey> = rows.flatMap { it.keys }
    var shifted: Boolean = false
    var height: Int = 0
        private set

    fun layout(width: Int, keyHeight: Int) {
        if (width <= 0 || keyHeight <= 0) return
        var y = 0
        for (row in rows) {
            val keyWeight = row.keys.sumOf { it.weight.toDouble() }.toFloat().coerceAtLeast(0.01f)
            val total = keyWeight + row.sideWeight * 2f
            val side = ((width * row.sideWeight) / total).toInt()
            var x = side
            var used = side
            row.keys.forEachIndexed { index, key ->
                val span = ((width * key.weight) / total).toInt().coerceAtLeast(1)
                val w = if (index == row.keys.lastIndex) (width - side - used).coerceAtLeast(1) else span
                key.x = x
                key.y = y
                key.width = w
                key.height = keyHeight
                x += w
                used += w
            }
            y += keyHeight
        }
        height = y.coerceAtLeast(keyHeight)
    }
}

object KeyPages {
    fun letters(): KeyBoard = KeyBoard(
        listOf(
            row(
                ch("q", "1"), ch("w", "2"), ch("e", "3éèêëēę"), ch("r", "4řŕ"), ch("t", "5ťþ"),
                ch("y", "6ýÿ"), ch("u", "7úùûüū"), ch("i", "8íìîïī"), ch("o", "9óòôöõō"), ch("p", "0")
            ),
            inset(
                ch("a", "áàâãäåæ"), ch("s", "ßśš"), ch("d", "đď"), ch("f"), ch("g"),
                ch("h"), ch("j"), ch("k"), ch("l", "ł")
            ),
            row(
                special(KeyCodes.SHIFT, "Aa", 1.5f),
                ch("z", "źžż"), ch("x"), ch("c", "çćč"), ch("v"), ch("b"), ch("n", "ñń"), ch("m"),
                special(KeyCodes.DELETE, "Del", 1.5f, repeatable = true)
            ),
            row(
                special(KeyCodes.MODE, "?123", 1.5f),
                ch(",", "'\""),
                special(KeyCodes.EMOJI, "☺", 1f),
                special(KeyCodes.SPACE, "English", 4f, repeatable = true),
                ch(".", "…?!;:"),
                special(KeyCodes.DONE, "↵", 1.5f)
            )
        )
    )

    fun symbols(): KeyBoard = KeyBoard(
        listOf(
            row(ch("1"), ch("2"), ch("3"), ch("4"), ch("5"), ch("6"), ch("7"), ch("8"), ch("9"), ch("0")),
            row(ch("@"), ch("#"), ch("$"), ch("%"), ch("&"), ch("*"), ch("-"), ch("="), ch("("), ch(")")),
            row(
                special(KeyCodes.SHIFT, "More", 1.5f),
                ch("!"), ch("\""), ch("'"), ch(":"), ch(";"), ch("/"), ch("?"),
                special(KeyCodes.DELETE, "Del", 1.5f, repeatable = true)
            ),
            row(
                special(KeyCodes.MODE, "ABC", 1.5f),
                ch(","),
                special(KeyCodes.SPACE, "English", 5f, repeatable = true),
                ch("."),
                special(KeyCodes.DONE, "↵", 1.5f)
            )
        )
    )

    fun symbolsMore(): KeyBoard = KeyBoard(
        listOf(
            row(ch("~"), ch("±"), ch("×"), ch("÷"), ch("•"), ch("°"), ch("`"), ch("´"), ch("{"), ch("}")),
            row(ch("©"), ch("£"), ch("€"), ch("^"), ch("®"), ch("¥"), ch("_"), ch("+"), ch("["), ch("]")),
            row(
                special(KeyCodes.SHIFT, "123", 1.5f),
                ch("¡"), ch("<"), ch(">"), ch("¢"), ch("|"), ch("\\"), ch("¿"),
                special(KeyCodes.DELETE, "Del", 1.5f, repeatable = true)
            ),
            row(
                special(KeyCodes.MODE, "ABC", 1.5f),
                ch(","),
                special(KeyCodes.SPACE, "English", 5f, repeatable = true),
                ch("."),
                special(KeyCodes.DONE, "↵", 1.5f)
            )
        )
    )

    fun numbers(): KeyBoard = KeyBoard(
        listOf(
            row(ch("1"), ch("2"), ch("3"), ch("-", "#")),
            row(ch("4"), ch("5"), ch("6"), ch("+", "*")),
            row(ch("7"), ch("8"), ch("9"), special(KeyCodes.DELETE, "Del", 1f, repeatable = true)),
            row(special(KeyCodes.MODE, "ABC", 1f), ch("0", "+"), ch(".", ","), special(KeyCodes.DONE, "↵", 1f))
        )
    )

    fun emoji(): KeyBoard = KeyBoard(
        listOf(
            row(*faces("😀", "😂", "😊", "😍", "😘", "😎", "🤔", "😢")),
            row(*faces("👍", "🙏", "👏", "🔥", "🎉", "✅", "⭐", "💯")),
            row(*faces("😉", "🤣", "😭", "😅", "😇", "🥰", "😴", "🤗")),
            row(*faces("👋", "💪", "💡", "📌", "📝", "⏰", "❤", "✨")),
            row(
                special(KeyCodes.MODE, "ABC", 1.6f),
                special(KeyCodes.SPACE, "English", 3.6f, repeatable = true),
                special(KeyCodes.DELETE, "Del", 1.4f, repeatable = true),
                special(KeyCodes.DONE, "↵", 1.4f)
            )
        )
    )

    private fun faces(vararg symbols: String): Array<SoftKey> = symbols.map { symbol ->
        SoftKey(0, symbol, symbol, "", false, false, 1f)
    }.toTypedArray()

    private fun ch(label: String, popup: String = "", weight: Float = 1f): SoftKey {
        val code = label.firstOrNull()?.code ?: 0
        return SoftKey(code, label, null, popup, false, false, weight)
    }

    private fun special(
        code: Int,
        label: String,
        weight: Float,
        repeatable: Boolean = false
    ): SoftKey {
        return SoftKey(code, label, null, "", repeatable, true, weight)
    }

    private fun row(vararg keys: SoftKey): KeyRow = KeyRow(keys.toList())

    private fun inset(vararg keys: SoftKey): KeyRow = KeyRow(keys.toList(), 0.5f)
}
