package com.politetype.ime.ime

import android.annotation.SuppressLint
import android.content.ClipboardManager
import android.content.Intent
import android.inputmethodservice.InputMethodService
import android.inputmethodservice.Keyboard
import android.inputmethodservice.KeyboardView
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.TextUtils
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.politetype.engine.FieldKind
import com.politetype.engine.Misspellings
import com.politetype.engine.Sentences
import com.politetype.engine.Suggestion
import com.politetype.engine.Text
import com.politetype.ime.R
import com.politetype.ime.data.ClipHistory
import com.politetype.ime.data.LexiconLoader
import com.politetype.ime.data.Preferences
import com.politetype.ime.ui.SetupActivity
import java.util.Locale
import java.util.concurrent.Executors

@Suppress("DEPRECATION")
class PoliteTypeService : InputMethodService(), KeyboardView.OnKeyboardActionListener {

    private enum class Layer { LETTERS, SYMBOLS, SYMBOLS_MORE, NUMBERS, EMOJI }

    private data class Revert(val typed: String, val replacement: String)

    private lateinit var prefs: Preferences
    private lateinit var clips: ClipHistory
    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()
    private val suggestRunnable = Runnable { collectSuggestions() }

    private var keyboardView: PoliteKeyboardView? = null
    private var chipRow: LinearLayout? = null
    private var clipButton: ImageView? = null

    private var letters: Keyboard? = null
    private var symbols: Keyboard? = null
    private var symbolsMore: Keyboard? = null
    private var numbers: Keyboard? = null
    private var emoji: Keyboard? = null

    private var layer = Layer.LETTERS
    private var shifted = false
    private var capsLock = false
    private var manualShiftAt = 0L
    private var lastShiftTap = 0L
    private var builtWidth = 0
    private var field = FieldKind.TEXT
    private var editorAction = EditorInfo.IME_ACTION_NONE
    private var noEnterAction = false
    private var clipMode = false
    private var generation = 0
    private var revert: Revert? = null

    override fun onCreate() {
        super.onCreate()
        prefs = Preferences(this)
        clips = ClipHistory(this)
        LexiconLoader.ensure(applicationContext) { scheduleSuggestions() }
    }

    override fun onCreateInputView(): View {
        val root = layoutInflater.inflate(R.layout.input, null)
        val board = root.findViewById<PoliteKeyboardView>(R.id.keyboard)
        keyboardView = board
        chipRow = root.findViewById(R.id.chips)
        clipButton = root.findViewById(R.id.clip)
        val globe = root.findViewById<ImageView>(R.id.globe)

        board.setOnKeyboardActionListener(this)
        board.isPreviewEnabled = true
        board.setProximityCorrectionEnabled(false)
        board.onPopupText = { text -> commit(text, honorShift = true) }
        board.onShiftLock = { lockShift() }
        board.onWidthChanged = { width -> rebuildKeyboards(width) }

        clipButton?.setOnClickListener {
            if (clipMode) {
                clipMode = false
                clipButton?.setImageResource(R.drawable.ic_clipboard)
                scheduleSuggestions()
            } else {
                showClipboard()
            }
        }
        globe.setOnClickListener { switchKeyboard() }
        globe.setOnLongClickListener {
            startActivity(Intent(this, SetupActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        }

        rebuildKeyboards(resources.displayMetrics.widthPixels)
        return root
    }

    override fun onEvaluateFullscreenMode(): Boolean = false

    override fun onStartInput(attribute: EditorInfo, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        field = fieldKind(attribute)
        editorAction = attribute.imeOptions and EditorInfo.IME_MASK_ACTION
        noEnterAction = attribute.imeOptions and EditorInfo.IME_FLAG_NO_ENTER_ACTION != 0
        revert = null
        capsLock = false
        manualShiftAt = 0L
    }

    override fun onStartInputView(attribute: EditorInfo, restarting: Boolean) {
        super.onStartInputView(attribute, restarting)
        clipMode = false
        clipButton?.setImageResource(R.drawable.ic_clipboard)
        val next = if (field == FieldKind.NUMBER) Layer.NUMBERS else Layer.LETTERS
        if (letters == null) rebuildKeyboards(resources.displayMetrics.widthPixels)
        showLayer(next)
        applyAutoShift(respectManual = false)
        LexiconLoader.ensure(this) { scheduleSuggestions() }
        scheduleSuggestions()
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        keyboardView?.closing()
        keyboardView?.dismissPopup()
        super.onFinishInputView(finishingInput)
    }

    override fun onUpdateSelection(
        oldSelStart: Int,
        oldSelEnd: Int,
        newSelStart: Int,
        newSelEnd: Int,
        candidatesStart: Int,
        candidatesEnd: Int
    ) {
        super.onUpdateSelection(
            oldSelStart,
            oldSelEnd,
            newSelStart,
            newSelEnd,
            candidatesStart,
            candidatesEnd
        )
        if (newSelStart != oldSelStart || newSelEnd != oldSelEnd) {
            applyAutoShift(respectManual = true)
            if (!clipMode) scheduleSuggestions()
        }
    }

    override fun onKey(primaryCode: Int, keyCodes: IntArray?) {
        keyboardView?.dismissPopup()
        when (primaryCode) {
            Keyboard.KEYCODE_SHIFT -> onShiftKey()
            Keyboard.KEYCODE_DELETE -> onDelete()
            Keyboard.KEYCODE_MODE_CHANGE -> onModeKey()
            Keyboard.KEYCODE_DONE, KeyEvent.KEYCODE_ENTER -> onEnter()
            Keyboard.KEYCODE_ALT -> showLayer(if (layer == Layer.EMOJI) Layer.LETTERS else Layer.EMOJI)
            KEYCODE_SPACE -> onSpace()
            else -> if (primaryCode > 0) commitCode(primaryCode)
        }
    }

    override fun onText(text: CharSequence?) {
        if (!text.isNullOrEmpty()) commit(text.toString(), honorShift = false)
    }

    override fun onPress(primaryCode: Int) {}

    override fun onRelease(primaryCode: Int) {}

    override fun swipeLeft() {}

    override fun swipeRight() {}

    override fun swipeDown() {}

    override fun swipeUp() {}

    override fun onDestroy() {
        executor.shutdownNow()
        keyboardView?.closing()
        super.onDestroy()
    }

    private fun rebuildKeyboards(width: Int) {
        if (width < 100 || (width == builtWidth && letters != null)) return
        builtWidth = width
        val height = resources.displayMetrics.heightPixels
        letters = Keyboard(this, R.xml.qwerty, 0, width, height)
        symbols = Keyboard(this, R.xml.symbols, 0, width, height)
        symbolsMore = Keyboard(this, R.xml.symbols_shift, 0, width, height)
        numbers = Keyboard(this, R.xml.numbers, 0, width, height)
        emoji = Keyboard(this, R.xml.emoji, 0, width, height)
        showLayer(layer)
    }

    private fun showLayer(next: Layer) {
        layer = next
        val board = when (next) {
            Layer.LETTERS -> letters
            Layer.SYMBOLS -> symbols
            Layer.SYMBOLS_MORE -> symbolsMore
            Layer.NUMBERS -> numbers
            Layer.EMOJI -> emoji
        } ?: return
        keyboardView?.keyboard = board
        updateEnterKey()
        applyShift()
    }

    private fun onModeKey() {
        showLayer(if (layer == Layer.LETTERS) Layer.SYMBOLS else Layer.LETTERS)
    }

    private fun onShiftKey() {
        if (layer == Layer.SYMBOLS) {
            showLayer(Layer.SYMBOLS_MORE)
            return
        }
        if (layer == Layer.SYMBOLS_MORE) {
            showLayer(Layer.SYMBOLS)
            return
        }
        if (layer != Layer.LETTERS) return
        val now = SystemClock.uptimeMillis()
        val quick = now - lastShiftTap < 400
        lastShiftTap = now
        manualShiftAt = now
        when {
            quick && !capsLock -> {
                capsLock = true
                shifted = true
            }
            capsLock -> {
                capsLock = false
                shifted = false
            }
            else -> shifted = !shifted
        }
        applyShift()
    }

    private fun lockShift() {
        if (layer != Layer.LETTERS) return
        capsLock = true
        shifted = true
        manualShiftAt = SystemClock.uptimeMillis()
        applyShift()
    }

    private fun applyAutoShift(respectManual: Boolean) {
        if (capsLock) {
            shifted = true
            applyShift()
            return
        }
        if (respectManual && SystemClock.uptimeMillis() - manualShiftAt < 800) {
            applyShift()
            return
        }
        val before = currentInputConnection?.getTextBeforeCursor(200, 0)?.toString().orEmpty()
        shifted = field == FieldKind.TEXT && Sentences.shouldAutoCap(before)
        applyShift()
    }

    private fun applyShift() {
        val board = keyboardView?.keyboard ?: return
        val on = layer == Layer.LETTERS && (shifted || capsLock)
        board.setShifted(on)
        if (layer == Layer.LETTERS) {
            for (key in board.keys) {
                if (key.codes?.firstOrNull() == Keyboard.KEYCODE_SHIFT) {
                    key.label = if (capsLock) "AA" else "Aa"
                }
            }
        }
        keyboardView?.invalidateAllKeys()
    }

    private fun updateEnterKey() {
        val label = enterLabel()
        for (board in listOfNotNull(letters, symbols, symbolsMore, numbers, emoji)) {
            for (key in board.keys) {
                val code = key.codes?.firstOrNull() ?: continue
                if (code == Keyboard.KEYCODE_DONE || code == KeyEvent.KEYCODE_ENTER) key.label = label
            }
        }
        keyboardView?.invalidateAllKeys()
    }

    private fun enterLabel(): String {
        if (noEnterAction) return "↵"
        return when (editorAction) {
            EditorInfo.IME_ACTION_GO -> "Go"
            EditorInfo.IME_ACTION_SEARCH -> "Search"
            EditorInfo.IME_ACTION_SEND -> "Send"
            EditorInfo.IME_ACTION_NEXT -> "Next"
            EditorInfo.IME_ACTION_DONE -> "Done"
            EditorInfo.IME_ACTION_PREVIOUS -> "Prev"
            else -> "↵"
        }
    }

    private fun commitCode(code: Int) {
        val chars = Character.toChars(code)
        var text = String(chars)
        if ((shifted || capsLock) && text.length == 1 && text[0].isLetter()) {
            text = text.uppercase(Locale.US)
        }
        commit(text, honorShift = false)
    }

    private fun commit(text: String, honorShift: Boolean) {
        val ic = currentInputConnection ?: return
        var out = text
        if (honorShift && (shifted || capsLock) && out.length == 1 && out[0].isLetter()) {
            out = out.uppercase(Locale.US)
        }
        revert = null
        clipMode = false
        ic.finishComposingText()
        ic.commitText(out, 1)
        haptic()
        if (honorShift && !capsLock) shifted = false
        applyAutoShift(respectManual = false)
        scheduleSuggestions()
    }

    private fun onSpace() {
        val ic = currentInputConnection ?: return
        clipMode = false
        val before = ic.getTextBeforeCursor(80, 0)?.toString().orEmpty()
        if (prefs.doubleSpacePeriod && before.length >= 2 && before.endsWith(" ") &&
            (before[before.length - 2].isLetterOrDigit())
        ) {
            ic.finishComposingText()
            ic.deleteSurroundingText(1, 0)
            ic.commitText(". ", 1)
            revert = null
            haptic()
            applyAutoShift(respectManual = false)
            scheduleSuggestions()
            return
        }
        maybeAutocorrect(ic, before)
        ic.finishComposingText()
        ic.commitText(" ", 1)
        haptic()
        applyAutoShift(respectManual = false)
        scheduleSuggestions()
    }

    private fun maybeAutocorrect(ic: InputConnection, before: String) {
        if (!prefs.autocorrect || field != FieldKind.TEXT) return
        val word = before.takeLastWhile { it.isLetter() || it == '\'' }
        if (word.isEmpty()) return
        val lettersOnly = word.filter { it.isLetter() }
        if (lettersOnly.isEmpty() || word.any { it.isDigit() }) return
        val capitals = lettersOnly.count { it.isUpperCase() }
        if (capitals > 1) return
        if (lettersOnly.length <= 5 && lettersOnly.all { it.isUpperCase() }) return
        val replacement = correctionFor(word) ?: return
        if (replacement == word) return
        ic.beginBatchEdit()
        ic.finishComposingText()
        ic.deleteSurroundingText(word.length, 0)
        ic.commitText(replacement, 1)
        ic.endBatchEdit()
        revert = Revert(word, replacement)
    }

    private fun correctionFor(word: String): String? {
        if (word == "i") return "I"
        if (word.length == 1) return null
        val lower = word.lowercase(Locale.US)
        Misspellings.auto(lower)?.let { return Text.matchCase(word, it) }
        val lexicon = LexiconLoader.lexicon ?: return null
        if (lexicon.isWord(lower)) return null
        val candidate = lexicon.corrections(lower, 1).firstOrNull() ?: return null
        if (candidate.first() != lower.first()) return null
        if (Text.damerau(lower, candidate) != 1) return null
        return Text.matchCase(word, candidate)
    }

    private fun onDelete() {
        val ic = currentInputConnection ?: return
        clipMode = false
        val selected = ic.getSelectedText(0)
        if (!selected.isNullOrEmpty()) {
            ic.commitText("", 1)
            revert = null
            haptic()
            scheduleSuggestions()
            return
        }
        val before = ic.getTextBeforeCursor(80, 0)?.toString().orEmpty()
        val pending = revert
        if (pending != null && before.endsWith(pending.replacement + " ")) {
            ic.beginBatchEdit()
            ic.deleteSurroundingText(pending.replacement.length + 1, 0)
            ic.commitText(pending.typed, 1)
            ic.endBatchEdit()
            revert = null
            haptic()
            scheduleSuggestions()
            return
        }
        revert = null
        if (before.isEmpty()) return
        val cut = if (
            before.length >= 2 &&
            Character.isSurrogatePair(before[before.length - 2], before.last())
        ) 2 else 1
        ic.deleteSurroundingText(cut, 0)
        haptic()
        applyAutoShift(respectManual = true)
        scheduleSuggestions()
    }

    private fun onEnter() {
        val ic = currentInputConnection ?: return
        clipMode = false
        val action = editorAction
        val perform = !noEnterAction &&
            action != EditorInfo.IME_ACTION_NONE &&
            action != EditorInfo.IME_ACTION_UNSPECIFIED
        ic.finishComposingText()
        if (perform) ic.performEditorAction(action) else ic.commitText("\n", 1)
        revert = null
        haptic()
        applyAutoShift(respectManual = false)
        scheduleSuggestions()
    }

    private fun applySuggestion(suggestion: Suggestion) {
        val ic = currentInputConnection ?: return
        clipMode = false
        ic.beginBatchEdit()
        ic.finishComposingText()
        if (suggestion.replaceBefore > 0 || suggestion.replaceAfter > 0) {
            ic.deleteSurroundingText(suggestion.replaceBefore, suggestion.replaceAfter)
        }
        ic.commitText(suggestion.text, 1)
        ic.endBatchEdit()
        revert = null
        haptic()
        applyAutoShift(respectManual = false)
        scheduleSuggestions()
    }

    private fun scheduleSuggestions() {
        if (clipMode) return
        handler.removeCallbacks(suggestRunnable)
        handler.postDelayed(suggestRunnable, 40)
    }

    private fun collectSuggestions() {
        val ic = currentInputConnection
        val before = ic?.getTextBeforeCursor(800, 0)?.toString().orEmpty()
        val after = ic?.getTextAfterCursor(200, 0)?.toString().orEmpty()
        val gen = ++generation
        val kind = field
        executor.execute {
            val list = LexiconLoader.engine?.suggest(before, after, kind).orEmpty()
            handler.post {
                if (gen == generation && !clipMode) renderSuggestions(list)
            }
        }
    }

    private fun renderSuggestions(suggestions: List<Suggestion>) {
        val row = chipRow ?: return
        row.removeAllViews()
        clipButton?.setImageResource(R.drawable.ic_clipboard)
        val weighted = suggestions.size in 1..3
        row.layoutParams = row.layoutParams.apply {
            width = if (weighted) LinearLayout.LayoutParams.MATCH_PARENT else LinearLayout.LayoutParams.WRAP_CONTENT
        }
        suggestions.forEachIndexed { index, suggestion ->
            if (index > 0) row.addView(divider())
            row.addView(chip(suggestion.label, weighted) { applySuggestion(suggestion) })
        }
    }

    private fun showClipboard() {
        clipMode = true
        handler.removeCallbacks(suggestRunnable)
        val manager = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
        val live = manager.primaryClip?.takeIf { it.itemCount > 0 }
            ?.getItemAt(0)
            ?.coerceToText(this)
            ?.toString()
            .orEmpty()
        if (live.isNotBlank()) clips.add(live)
        val row = chipRow ?: return
        row.removeAllViews()
        clipButton?.setImageResource(R.drawable.ic_back)
        row.layoutParams = row.layoutParams.apply {
            width = LinearLayout.LayoutParams.WRAP_CONTENT
        }
        val items = clips.recent()
        if (items.isEmpty()) {
            row.addView(chip(getString(R.string.clip_empty), clickable = false) {})
            return
        }
        for (item in items) {
            val shown = item.replace('\n', ' ')
            row.addView(chip(shown) {
                currentInputConnection?.finishComposingText()
                currentInputConnection?.commitText(item, 1)
                clipMode = false
                scheduleSuggestions()
            })
        }
    }

    private fun chip(label: String, weighted: Boolean = false, clickable: Boolean = true, click: () -> Unit): TextView {
        val view = TextView(this)
        view.text = label.replace('\n', ' ')
        view.setTextColor(colorOf(R.color.chip_text))
        view.textSize = 16f
        view.maxLines = 1
        view.ellipsize = TextUtils.TruncateAt.END
        view.gravity = android.view.Gravity.CENTER
        view.setPadding(dp(8), 0, dp(8), 0)
        view.isClickable = clickable
        if (clickable) view.setOnClickListener { click() }
        view.layoutParams = if (weighted) {
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
        } else {
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            ).apply { marginEnd = dp(8) }
        }
        return view
    }

    private fun divider(): View {
        return View(this).apply {
            setBackgroundColor(colorOf(R.color.divider))
            layoutParams = LinearLayout.LayoutParams(dp(1), dp(22)).apply {
                gravity = android.view.Gravity.CENTER_VERTICAL
            }
        }
    }

    private fun switchKeyboard() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        if (Build.VERSION.SDK_INT >= 28) {
            if (!switchToNextInputMethod(false)) imm.showInputMethodPicker()
            return
        }
        val token = window?.window?.attributes?.token
        val switched = token != null && imm.switchToNextInputMethod(token, false)
        if (!switched) imm.showInputMethodPicker()
    }

    @SuppressLint("MissingPermission")
    private fun haptic() {
        if (!prefs.haptic) return
        val vibrator = getSystemService(VIBRATOR_SERVICE) as android.os.Vibrator
        if (!vibrator.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= 26) {
            vibrator.vibrate(
                android.os.VibrationEffect.createOneShot(12, android.os.VibrationEffect.DEFAULT_AMPLITUDE)
            )
        } else {
            vibrator.vibrate(12)
        }
    }

    private fun fieldKind(info: EditorInfo): FieldKind {
        val cls = info.inputType and EditorInfo.TYPE_MASK_CLASS
        val variation = info.inputType and EditorInfo.TYPE_MASK_VARIATION
        if (cls == EditorInfo.TYPE_CLASS_NUMBER ||
            cls == EditorInfo.TYPE_CLASS_PHONE ||
            cls == EditorInfo.TYPE_CLASS_DATETIME
        ) {
            return FieldKind.NUMBER
        }
        if (cls != EditorInfo.TYPE_CLASS_TEXT) return FieldKind.TEXT
        return when (variation) {
            EditorInfo.TYPE_TEXT_VARIATION_PASSWORD,
            EditorInfo.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
            EditorInfo.TYPE_TEXT_VARIATION_WEB_PASSWORD -> FieldKind.PASSWORD
            EditorInfo.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
            EditorInfo.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS -> FieldKind.EMAIL
            EditorInfo.TYPE_TEXT_VARIATION_URI -> FieldKind.URI
            else -> FieldKind.TEXT
        }
    }

    @Suppress("DEPRECATION")
    private fun colorOf(id: Int): Int = resources.getColor(id)

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val KEYCODE_SPACE = 32
    }
}
