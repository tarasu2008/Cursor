package com.politetype.ime.ime

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.drawable.ColorDrawable
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import com.politetype.ime.R
import com.politetype.ime.data.CrashLog

/**
 * Draws the keys itself. It does not use Android's Keyboard or KeyboardView,
 * which close the app on some Samsung phones.
 */
class PoliteKeyboardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    var onKey: ((Int) -> Unit)? = null
    var onText: ((CharSequence) -> Unit)? = null
    var onPopupText: ((String) -> Unit)? = null
    var onShiftLock: (() -> Unit)? = null

    var board: KeyBoard? = null
        set(value) {
            field = value
            requestLayout()
            invalidate()
        }

    private val handler = Handler(Looper.getMainLooper())
    private var popup: PopupWindow? = null
    private var active: SoftKey? = null
    private var repeated = false
    private var longFired = false
    private var drawLogged = false
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

    private val longPress: Runnable = Runnable {
        val key = active ?: return@Runnable
        longFired = true
        try {
            if (key.code == KeyCodes.SHIFT) {
                onShiftLock?.invoke()
                return@Runnable
            }
            if (key.popup.isNotEmpty()) showChoices(key)
        } catch (error: Throwable) {
            CrashLog.record(context, "long press", error)
        }
    }

    private val repeatKey: Runnable = Runnable {
        val key = active ?: return@Runnable
        send(key)
        repeated = true
        handler.postDelayed(repeatKey, 50)
    }

    init {
        isClickable = true
        setBackgroundColor(color(R.color.keyboard_bg))
    }

    fun invalidateKeys() {
        invalidate()
    }

    fun dismissPopup() {
        try {
            popup?.dismiss()
        } catch (_: Throwable) {
            // The window may already be gone.
        }
        popup = null
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec).coerceAtLeast(1)
        val keyHeight = dp(52f).toInt().coerceAtLeast(1)
        val page = board
        val height = try {
            page?.layout(width, keyHeight)
            page?.height?.takeIf { it > 0 } ?: keyHeight * 4
        } catch (error: Throwable) {
            CrashLog.record(context, "measure keys", error)
            keyHeight * 4
        }
        setMeasuredDimension(width, height + paddingTop + paddingBottom)
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawColor(color(R.color.keyboard_bg))
        val page = board ?: return
        val shifted = page.shifted
        for (key in page.keys) {
            try {
                drawKey(canvas, key, shifted)
            } catch (error: Throwable) {
                if (!drawLogged) {
                    drawLogged = true
                    CrashLog.record(context, "draw key", error)
                }
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        try {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> press(event.x, event.y)
                MotionEvent.ACTION_MOVE -> move(event.x, event.y)
                MotionEvent.ACTION_UP -> release(event.x, event.y, send = true)
                MotionEvent.ACTION_CANCEL -> release(event.x, event.y, send = false)
            }
        } catch (error: Throwable) {
            CrashLog.record(context, "touch", error)
            clearPress()
        }
        return true
    }

    override fun onDetachedFromWindow() {
        clearPress()
        dismissPopup()
        super.onDetachedFromWindow()
    }

    private fun press(x: Float, y: Float) {
        clearPress()
        val key = keyAt(x, y) ?: return
        active = key
        repeated = false
        longFired = false
        key.pressed = true
        invalidate()
        if (key.repeatable) {
            send(key)
            repeated = true
            handler.postDelayed(repeatKey, 400)
        } else {
            handler.postDelayed(longPress, 350)
        }
    }

    private fun move(x: Float, y: Float) {
        val key = keyAt(x, y)
        if (key === active) return
        handler.removeCallbacks(longPress)
        handler.removeCallbacks(repeatKey)
        active?.pressed = false
        active = key
        longFired = false
        repeated = false
        key?.pressed = true
        if (key != null && !key.repeatable) handler.postDelayed(longPress, 350)
        invalidate()
    }

    private fun release(x: Float, y: Float, send: Boolean) {
        handler.removeCallbacks(longPress)
        handler.removeCallbacks(repeatKey)
        val key = active
        active?.pressed = false
        active = null
        if (send && key != null && !longFired && !repeated && keyAt(x, y) === key) {
            send(key)
        }
        invalidate()
    }

    private fun clearPress() {
        handler.removeCallbacks(longPress)
        handler.removeCallbacks(repeatKey)
        active?.pressed = false
        active = null
    }

    private fun send(key: SoftKey) {
        val output = key.output
        if (!output.isNullOrEmpty()) {
            onText?.invoke(output)
            return
        }
        if (key.code != 0) onKey?.invoke(key.code)
    }

    private fun keyAt(x: Float, y: Float): SoftKey? {
        val keys = board?.keys ?: return null
        return keys.lastOrNull { it.contains(x.toInt(), y.toInt()) }
    }

    private fun showChoices(key: SoftKey) {
        dismissPopup()
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(0xFF2C333A.toInt())
            setPadding(6, 6, 6, 6)
        }
        key.popup.forEach { character ->
            val choice = TextView(context).apply {
                text = character.toString()
                setTextColor(Color.WHITE)
                textSize = 20f
                gravity = Gravity.CENTER
                val pad = dp(12f).toInt()
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
        val popupX = origin[0] + key.x
        val popupY = (origin[1] + key.y - key.height).coerceAtLeast(0)
        window.showAtLocation(this, Gravity.NO_GRAVITY, popupX, popupY)
        popup = window
    }

    private fun drawKey(canvas: Canvas, key: SoftKey, shifted: Boolean) {
        val insetX = dp(3f)
        val insetY = dp(5f)
        keyRect.set(
            key.x + insetX,
            key.y + insetY,
            key.x + key.width - insetX,
            key.y + key.height - insetY
        )
        val code = key.code
        fill.color = when {
            key.pressed -> color(R.color.key_pressed)
            key.special || code == KeyCodes.SPACE -> color(R.color.key_special)
            else -> color(R.color.key_face)
        }
        canvas.drawRoundRect(keyRect, dp(6f), dp(6f), fill)
        val cx = keyRect.centerX()
        val cy = keyRect.centerY()
        when (code) {
            KeyCodes.SHIFT -> drawShift(canvas, cx, cy, shifted)
            KeyCodes.DELETE -> drawDelete(canvas, cx, cy)
            KeyCodes.DONE -> {
                val label = key.label
                if (label.length > 1 && label != "↵") drawLabel(canvas, label, cx, cy, false) else drawReturn(canvas, cx, cy)
            }
            KeyCodes.EMOJI -> drawEmoji(canvas, cx, cy)
            KeyCodes.SPACE -> drawLabel(canvas, "English", cx, cy, hint = true)
            else -> {
                val raw = key.output ?: key.label
                val shown = if (shifted && raw.length == 1 && raw[0].isLowerCase()) raw.uppercase() else raw
                drawLabel(canvas, shown, cx, cy + dp(2f), false)
                digitFor(key.label)?.let { digit ->
                    hintPaint.color = color(R.color.key_hint)
                    hintPaint.textSize = sp(10f)
                    canvas.drawText(digit.toString(), cx, keyRect.top + dp(12f), hintPaint)
                }
            }
        }
    }

    private fun drawLabel(canvas: Canvas, text: String, x: Float, y: Float, hint: Boolean) {
        if (text.isEmpty()) return
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

    private fun sp(value: Float): Float {
        return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, value, resources.displayMetrics)
    }
}
