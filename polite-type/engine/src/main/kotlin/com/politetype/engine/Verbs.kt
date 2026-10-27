package com.politetype.engine

/**
 * Principal parts from Kittredge and Farley,
 * An Advanced English Grammar (Project Gutenberg eBook 45814, public domain).
 * Only the verb forms are kept, not the book text.
 */
internal object Verbs {
    private val forms: List<Triple<String, String, String>> = listOf(
        Triple("abide", "abode", "abode"),
        Triple("am", "was", "been"),
        Triple("arise", "arose", "arisen"),
        Triple("awake", "awoke", "awaked"),
        Triple("bear", "bore", "borne"),
        Triple("beat", "beat", "beaten"),
        Triple("beget", "begot", "begotten"),
        Triple("begin", "began", "begun"),
        Triple("behold", "beheld", "beheld"),
        Triple("bend", "bent", "bent"),
        Triple("bereave", "bereft", "bereft"),
        Triple("beseech", "besought", "besought"),
        Triple("bet", "bet", "bet"),
        Triple("bid", "bade", "bidden"),
        Triple("bind", "bound", "bound"),
        Triple("bite", "bit", "bitten"),
        Triple("bleed", "bled", "bled"),
        Triple("blow", "blew", "blown"),
        Triple("break", "broke", "broken"),
        Triple("breed", "bred", "bred"),
        Triple("bring", "brought", "brought"),
        Triple("build", "built", "built"),
        Triple("burst", "burst", "burst"),
        Triple("buy", "bought", "bought"),
        Triple("cast", "cast", "cast"),
        Triple("catch", "caught", "caught"),
        Triple("chide", "chid", "chidden"),
        Triple("choose", "chose", "chosen"),
        Triple("cleave", "cleft", "cleft"),
        Triple("cling", "clung", "clung"),
        Triple("come", "came", "come"),
        Triple("cost", "cost", "cost"),
        Triple("creep", "crept", "crept"),
        Triple("cut", "cut", "cut"),
        Triple("deal", "dealt", "dealt"),
        Triple("dig", "dug", "dug"),
        Triple("do", "did", "done"),
        Triple("draw", "drew", "drawn"),
        Triple("drink", "drank", "drunk"),
        Triple("drive", "drove", "driven"),
        Triple("dwell", "dwelt", "dwelt"),
        Triple("eat", "ate", "eaten"),
        Triple("fall", "fell", "fallen"),
        Triple("feed", "fed", "fed"),
        Triple("feel", "felt", "felt"),
        Triple("fight", "fought", "fought"),
        Triple("find", "found", "found"),
        Triple("flee", "fled", "fled"),
        Triple("fling", "flung", "flung"),
        Triple("fly", "flew", "flown"),
        Triple("forbear", "forbore", "forborne"),
        Triple("forget", "forgot", "forgotten"),
        Triple("forsake", "forsook", "forsaken"),
        Triple("freeze", "froze", "frozen"),
        Triple("get", "got", "got"),
        Triple("give", "gave", "given"),
        Triple("go", "went", "gone"),
        Triple("grind", "ground", "ground"),
        Triple("grow", "grew", "grown"),
        Triple("hang", "hung", "hanged"),
        Triple("have", "had", "had"),
        Triple("hear", "heard", "heard"),
        Triple("heave", "hove", "heaved"),
        Triple("hew", "hewed", "hewn"),
        Triple("hide", "hid", "hidden"),
        Triple("hit", "hit", "hit"),
        Triple("hold", "held", "held"),
        Triple("hurt", "hurt", "hurt"),
        Triple("keep", "kept", "kept"),
        Triple("know", "knew", "known"),
        Triple("lade", "laded", "laded"),
        Triple("lay", "laid", "laid"),
        Triple("lead", "led", "led"),
        Triple("leave", "left", "left"),
        Triple("lend", "lent", "lent"),
        Triple("let", "let", "let"),
        Triple("lie", "lay", "lain"),
        Triple("light", "lighted", "lighted"),
        Triple("lose", "lost", "lost"),
        Triple("make", "made", "made"),
        Triple("mean", "meant", "meant"),
        Triple("meet", "met", "met"),
        Triple("or", "lit", "or"),
        Triple("pay", "paid", "paid"),
        Triple("put", "put", "put"),
        Triple("read", "read", "read"),
        Triple("reave", "reft", "reaved"),
        Triple("reeve", "rove", "rove"),
        Triple("rend", "rent", "rent"),
        Triple("rid", "rid", "rid"),
        Triple("ride", "rode", "ridden"),
        Triple("ring", "rang", "rung"),
        Triple("rise", "rose", "risen"),
        Triple("rive", "rived", "riven"),
        Triple("run", "ran", "run"),
        Triple("say", "said", "said"),
        Triple("see", "saw", "seen"),
        Triple("seek", "sought", "sought"),
        Triple("seethe", "sod", "seethed"),
        Triple("sell", "sold", "sold"),
        Triple("send", "sent", "sent"),
        Triple("set", "set", "set"),
        Triple("shake", "shook", "shaken"),
        Triple("shave", "shaved", "shaved"),
        Triple("shed", "shed", "shed"),
        Triple("shine", "shone", "shone"),
        Triple("shoe", "shod", "shod"),
        Triple("shoot", "shot", "shot"),
        Triple("show", "showed", "shown"),
        Triple("shrink", "shrank", "shrunk"),
        Triple("shrive", "shrove", "shrived"),
        Triple("shut", "shut", "shut"),
        Triple("sing", "sang", "sung"),
        Triple("sink", "sank", "sunk"),
        Triple("sit", "sat", "sat"),
        Triple("slay", "slew", "slain"),
        Triple("sleep", "slept", "slept"),
        Triple("slide", "slid", "slid"),
        Triple("sling", "slung", "slung"),
        Triple("slink", "slunk", "slunk"),
        Triple("slit", "slit", "slit"),
        Triple("smite", "smote", "smitten"),
        Triple("sow", "sowed", "sowed"),
        Triple("speak", "spoke", "spoken"),
        Triple("spend", "spent", "spent"),
        Triple("spin", "spun", "spun"),
        Triple("spit", "spit", "spit"),
        Triple("split", "split", "split"),
        Triple("spread", "spread", "spread"),
        Triple("spring", "sprang", "sprung"),
        Triple("stand", "stood", "stood"),
        Triple("stave", "stove", "staved"),
        Triple("steal", "stole", "stolen"),
        Triple("stick", "stuck", "stuck"),
        Triple("sting", "stung", "stung"),
        Triple("stink", "stunk", "stunk"),
        Triple("strew", "strewed", "strewn"),
        Triple("stride", "strode", "stridden"),
        Triple("strike", "struck", "struck"),
        Triple("string", "strung", "strung"),
        Triple("strive", "strove", "striven"),
        Triple("swear", "swore", "sworn"),
        Triple("sweep", "swept", "swept"),
        Triple("swell", "swelled", "swelled"),
        Triple("swim", "swam", "swum"),
        Triple("swing", "swung", "swung"),
        Triple("take", "took", "taken"),
        Triple("teach", "taught", "taught"),
        Triple("tear", "tore", "torn"),
        Triple("tell", "told", "told"),
        Triple("think", "thought", "thought"),
        Triple("thrive", "throve", "thrived"),
        Triple("throw", "threw", "thrown"),
        Triple("thrust", "thrust", "thrust"),
        Triple("tread", "trod", "trodden"),
        Triple("wake", "woke", "waked"),
        Triple("wear", "wore", "worn"),
        Triple("weave", "wove", "woven"),
        Triple("weep", "wept", "wept"),
        Triple("wet", "wet", "wet"),
        Triple("win", "won", "won"),
        Triple("wind", "wound", "wound"),
        Triple("wring", "wrung", "wrung"),
        Triple("write", "wrote", "written"),
    )

    private val byPresent: Map<String, Pair<String, String>>
    private val fakePast: Map<String, String>
    private val pastToParticiple: Map<String, String>
    private val participleToPast: Map<String, String>
    private val recognized: Set<String>

    init {
        val presentMap = LinkedHashMap<String, Pair<String, String>>()
        val fakes = LinkedHashMap<String, String>()
        val toPart = LinkedHashMap<String, String>()
        val toPast = LinkedHashMap<String, String>()
        val known = HashSet<String>()
        for ((present, past, participle) in forms) {
            presentMap[present] = past to participle
            known.add(present)
            known.add(past)
            known.add(participle)
            val fake = regularEd(present)
            if (fake != present && fake != past && fake != participle) fakes[fake] = past
            if (past != participle) {
                toPart.putIfAbsent(past, participle)
                toPast.putIfAbsent(participle, past)
            }
        }
        byPresent = presentMap
        fakePast = fakes
        pastToParticiple = toPart
        participleToPast = toPast
        recognized = known + fakes.keys
    }

    fun isRecognized(word: String): Boolean = recognized.contains(word.lowercase())

    fun fix(word: String, previous: String?, isWord: (String) -> Boolean): String? {
        val lower = word.lowercase()
        fakePast[lower]?.let { replacement ->
            if (!isWord(lower)) return replacement
        }
        val prev = previous?.lowercase()
        if (prev in HAVE) pastToParticiple[lower]?.let { return it }
        if (lower == "been" && prev in SUBJECTS) {
            return if (prev == "i" || prev == "he" || prev == "she" || prev == "it") "was" else "were"
        }
        if (prev in SUBJECTS && lower != "been") participleToPast[lower]?.let { return it }
        return null
    }

    private fun regularEd(present: String): String {
        if (present.endsWith("e")) return present + "d"
        if (present.length > 1 && present.endsWith("y") && present[present.length - 2] !in "aeiou") {
            return present.dropLast(1) + "ied"
        }
        return present + "ed"
    }

    private val HAVE = setOf("have", "has", "had")
    private val SUBJECTS = setOf("i", "you", "we", "they", "he", "she", "it")
}

