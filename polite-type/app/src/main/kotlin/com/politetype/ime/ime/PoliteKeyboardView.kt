package com.politetype.ime.ime

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.drawable.ColorDrawable
import android.inputmethodservice.Keyboard
import android.inputmethodservice.KeyboardView
import android.util.AttributeSet
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import com.politetype.ime.R

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
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private val iconPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val keyRect = RectF()
    private val iconPath = Path()

    init {
        isPreviewEnabled = true
        setProximityCorrectionEnabled(false)
        setBackgroundColor(color(R.color.keyboard_bg))
    }

    override fun onDraw(canvas: Canvas) {
        val board = keyboard
        if (board == null) {
            super.onDraw(canvas)
            return
        }
        canvas.drawColor(color(R.color.keyboard_bg))
        for (key in board.keys) drawKey(canvas, key, board.isShifted)
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

    private fun drawKey(canvas: Canvas, key: Keyboard.Key, shifted: Boolean) {
        val insetX = dp(3f)
        val insetY = dp(5f)
        keyRect.set(
            key.x + insetX,
            key.y + insetY,
            key.x + key.width - insetX,
            key.y + key.height - insetY
        )
        val code = key.codes?.firstOrNull() ?: 0
        val special = code < 0 || code == 32
        fill.color = when {
            key.pressed -> color(R.color.key_pressed)
            special -> color(R.color.key_special)
            else -> color(R.color.key_face)
        }
        canvas.drawRoundRect(keyRect, dp(6f), dp(6f), fill)
        val cx = keyRect.centerX()
        val cy = keyRect.centerY()
        when (code) {
            Keyboard.KEYCODE_SHIFT -> drawShift(canvas, cx, cy, key.on || shifted)
            Keyboard.KEYCODE_DELETE -> drawDelete(canvas, cx, cy)
            Keyboard.KEYCODE_DONE -> {
                val label = key.label?.toString().orEmpty()
                if (label.length > 1 && label != "↵") drawLabel(canvas, label, cx, cy, false) else drawReturn(canvas, cx, cy)
            }
            Keyboard.KEYCODE_ALT -> drawEmoji(canvas, cx, cy)
            32 -> drawLabel(canvas, "English", cx, cy, hint = true)
            else -> {
                val raw = key.label?.toString().orEmpty()
                val shown = if (shifted && raw.length == 1 && raw[0].isLowerCase()) raw.uppercase() else raw
                drawLabel(canvas, shown, cx, cy + dp(2f), false)
                digitFor(raw)?.let { digit ->
                    hintPaint.color = color(R.color.key_hint)
                    hintPaint.textSize = sp(10f)
                    canvas.drawText(digit.toString(), cx, keyRect.top + dp(12f), hintPaint)
                }
            }
        }
    }

    private fun drawLabel(canvas: Canvas, text: String, x: Float, y: Float, hint: Boolean) {
        val paint = if (hint) hintPaint else labelPaint
        paint.color = color(if (hint) R.color.key_hint else R.color.key_text)
        paint.textSize = sp(if (text.length > 1) 13f else 20f)
        val baseline = y - (paint.descent() + paint.ascent()) / 2f
        canvas.drawText(text, x, baseline, paint)
    }

    private fun drawShift(canvas: Canvas, cx: Float, cy: Float, filled: Boolean) {
        iconPath.reset()
        val w = dp(8f)
        val h = dp(9f)
        iconPath.moveTo(cx, cy - h)
        iconPath.lineTo(cx - w, cy - dp(1f))
        iconPath.lineTo(cx - dp(3.5f), cy - dp(1f))
        iconPath.lineTo(cx - dp(3.5f), cy + h)
        iconPath.lineTo(cx + dp(3.5f), cy + h)
        iconPath.lineTo(cx + dp(3.5f), cy - dp(1f))
        iconPath.lineTo(cx + w, cy - dp(1f))
        iconPath.close()
        iconPaint.style = if (filled) Paint.Style.FILL else Paint.Style.STROKE
        iconPaint.strokeWidth = dp(1.6f)
        iconPaint.color = color(R.color.key_text)
        canvas.drawPath(iconPath, iconPaint)
    }

    private fun drawDelete(canvas: Canvas, cx: Float, cy: Float) {
        iconPaint.style = Paint.Style.STROKE
        iconPaint.strokeWidth = dp(1.6f)
        iconPaint.color = color(R.color.key_text)
        iconPath.reset()
        val left = cx - dp(9f)
        val right = cx + dp(8f)
        val top = cy - dp(7f)
        val bottom = cy + dp(7f)
        iconPath.moveTo(left + dp(4f), top)
        iconPath.lineTo(right, top)
        iconPath.lineTo(right, bottom)
        iconPath.lineTo(left + dp(4f), bottom)
        iconPath.lineTo(left, cy)
        iconPath.close()
        canvas.drawPath(iconPath, iconPaint)
        canvas.drawLine(cx - dp(1f), cy - dp(3f), cx + dp(4f), cy + dp(3f), iconPaint)
        canvas.drawLine(cx + dp(4f), cy - dp(3f), cx - dp(1f), cy + dp(3f), iconPaint)
    }

    private fun drawReturn(canvas: Canvas, cx: Float, cy: Float) {
        iconPaint.style = Paint.Style.STROKE
        iconPaint.strokeWidth = dp(1.7f)
        iconPaint.color = color(R.color.key_text)
        val left = cx - dp(7f)
        val right = cx + dp(7f)
        val top = cy - dp(5f)
        canvas.drawLine(right, top, right, cy + dp(4f), iconPaint)
        canvas.drawLine(right, cy + dp(4f), left, cy + dp(4f), iconPaint)
        iconPath.reset()
        iconPath.moveTo(left + dp(4f), cy)
        iconPath.lineTo(left, cy + dp(4f))
        iconPath.lineTo(left + dp(4f), cy + dp(8f))
        canvas.drawPath(iconPath, iconPaint)
    }

    private fun drawEmoji(canvas: Canvas, cx: Float, cy: Float) {
        iconPaint.style = Paint.Style.STROKE
        iconPaint.strokeWidth = dp(1.6f)
        iconPaint.color = color(R.color.key_text)
        canvas.drawCircle(cx, cy, dp(8f), iconPaint)
        fill.color = color(R.color.key_text)
        canvas.drawCircle(cx - dp(3f), cy - dp(2f), dp(1.1f), fill)
        canvas.drawCircle(cx + dp(3f), cy - dp(2f), dp(1.1f), fill)
        iconPath.reset()
        iconPath.moveTo(cx - dp(4f), cy + dp(1.5f))
        iconPath.quadTo(cx, cy + dp(6f), cx + dp(4f), cy + dp(1.5f))
        canvas.drawPath(iconPath, iconPaint)
    }

    private fun digitFor(label: String): Char? {
        if (label.length != 1) return null
        return when (label[0].lowercaseChar()) {
            'q' -> '1'
            'w' -> '2'
            'e' -> '3'
            'r' -> '4'
            't' -> '5'
            'y' -> '6'
            'u' -> '7'
            'i' -> '8'
            'o' -> '9'
            'p' -> '0'
            else -> null
        }
    }

    @Suppress("DEPRECATION")
    private fun color(id: Int): Int = resources.getColor(id)

    private fun dp(value: Float): Float = value * resources.displayMetrics.density

    private fun sp(value: Float): Float = value * resources.displayMetrics.scaledDensity
}
