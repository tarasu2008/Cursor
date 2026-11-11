"""Trading rules learned from the BTC analysis chat (Oct–Nov 2026)."""

from __future__ import annotations

NOTIONAL_USD = 1_000.0

# Do not sell/buy the middle of the day range.
MIDRANGE_NO_TRADE = True

# Prefer rejection shorts into supply; longs only on confirmed reclaim.
PREFER_SHORT_AT_SUPPLY = True

# Confirmation style that failed when skipped (29 Oct short into demand).
REQUIRE_BREAK_CLOSE_FOR_BREAKDOWN = True

# After a target is hit, do not re-enter the same trade.
NO_REENTRY_SAME_IDEA = True

# Check existing orders before ending them.
PROTECT_OPEN_ORDERS = True

# EVERY analysis must review the previous signal first, score it, and adjust.
REVIEW_PREVIOUS_SIGNAL = True

# --- Lessons from this chat (mistakes to never repeat) ---
# 1) 29 Oct: shorted mid-range into demand without daily break close → stopped.
# 2) 11 Nov US: bounce short entry correct but SL too tight (0.8%) under next
#    liquidity high → stopped before thesis played. Use ATR + structure stop.
# 3) Bot bug: breakdown tickets used stale FALLBACK TP above entry for shorts.
# 4) Stale proposed orders (81180/81261) were "protected" after structure broke.
# 5) Indicators alone (EMA/RSI) without swing/trendline confluence = weak tickets.

# Risk model (ATR_STOP_MULT can be raised at runtime after a stop-out review)
ATR_STOP_MULT = 1.0          # stop at least 1 ATR beyond structure
ATR_STOP_MULT_AFTER_STOPOUT = 1.25
MIN_RR = 1.5                 # reject tickets with reward/risk < this
MIN_CONFLUENCE = 3           # need at least 3 confirming factors
DEFAULT_STOP_BUFFER_PCT = 0.008
DEFAULT_REWARD_R = 2.0

SESSIONS = ("india", "uk", "us")

FALLBACK = {
    "deep_target": 71_000.0,  # extension below current swing shelf
}
