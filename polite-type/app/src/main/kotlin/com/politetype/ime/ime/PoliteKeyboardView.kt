package com.politetype.ime.ime

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.inputmethodservice.Keyboard
import android.inputmethodservice.KeyboardView
import android.util.AttributeSet
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView

@SuppressLint("Deprecated")
@Suppress("DEPRECATION")
class PoliteKeyboardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : KeyboardView(context, attrs, defStyleAttr) {

    var onPopupText: ((String) -> Unit)? = null
    var onShiftLock: (() -> Unit)? = null
    var onWidthChanged: ((Int) -> Unit)? = null

    private var popup: PopupWindow? = null

    init {
        isPreviewEnabled = true
        setProximityCorrectionEnabled(false)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w > 0 && w != oldw) onWidthChanged?.invoke(w)
    }

    override fun onLongPress(key: Keyboard.Key): Boolean {
        val code = key.codes.firstOrNull() ?: 0
        if (code == Keyboard.KEYCODE_SHIFT) {
            onShiftLock?.invoke()
            return true
        }
        val chars = key.popupCharacters?.toString().orEmpty()
        if (chars.isEmpty()) return false
        showChoices(key, chars)
        return true
    }

    fun dismissPopup() {
        popup?.dismiss()
        popup = null
    }

    override fun onDetachedFromWindow() {
        dismissPopup()
        super.onDetachedFromWindow()
    }

    private fun showChoices(key: Keyboard.Key, chars: String) {
        dismissPopup()
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(0xFF2C333A.toInt())
            setPadding(6, 6, 6, 6)
        }
        chars.forEach { character ->
            val choice = TextView(context).apply {
                text = character.toString()
                setTextColor(Color.WHITE)
                textSize = 20f
                gravity = Gravity.CENTER
                val pad = (12 * resources.displayMetrics.density).toInt()
                setPadding(pad, pad / 2, pad, pad / 2)
                setOnClickListener {
                    onPopupText?.invoke(character.toString())
                    dismissPopup()
                }
            }
            row.addView(choice)
        }
        val window = PopupWindow(
            row,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            false
        )
        window.isOutsideTouchable = true
        window.isTouchable = true
        window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        window.inputMethodMode = PopupWindow.INPUT_METHOD_NOT_NEEDED
        val origin = IntArray(2)
        getLocationInWindow(origin)
        val x = origin[0] + key.x
        val y = (origin[1] + key.y - key.height).coerceAtLeast(0)
        window.showAtLocation(this, Gravity.NO_GRAVITY, x, y)
        popup = window
    }
}
