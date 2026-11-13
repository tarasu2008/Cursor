"""Trading rules learned from the BTC analysis chat (Oct–Nov 2026)."""

from __future__ import annotations

NOTIONAL_USD = 1_000.0

# Fixed risk for now (user 12 Nov): 1% loss / 2% profit. Widen later when analysis is solid.
USE_FIXED_PCT_RISK = True
STOP_LOSS_PCT = 0.01      # 1% loss
TAKE_PROFIT_PCT = 0.02    # 2% profit

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

# Output LONG/SHORT (not Buy/Sell wording) in simple tickets.
USE_LONG_SHORT_LABELS = True

# --- Lessons from this chat (mistakes to never repeat) ---
# 1) 29 Oct: shorted mid-range into demand without daily break close → stopped.
# 2) 11 Nov US: bounce short entry correct but SL too tight (0.8%) under next
#    liquidity high → stopped before thesis played. Use ATR + structure stop.
# 3) Bot bug: breakdown tickets used stale FALLBACK TP above entry for shorts.
# 4) Stale proposed orders (81180/81261) were "protected" after structure broke.
# 5) Indicators alone (EMA/RSI) without swing/trendline confluence = weak tickets.
# 6) Always review previous signal before a new one; remember chat rules.
# 7) User wants simple LONG/SHORT + entry + SL + TP; paper size $1000.
# 8) Grade previous analysis Pass or Fail only (no partial); save for week/month.
# 9) Track paper P&L daily/weekly/monthly as if $1000 real trades were taken.
# 10) Allow 1H timeframe trades; hourly recheck optional.
# 11) Cursor alert title only — no BTC alert wording.
# 12) Every Cursor alert must include Time + Date (IST) when triggered.
# 13) Alert ONLY when previous analysis is Pass or Fail. If Open → leave it (no alert).
# 14) Hourly: silent check only; if still Open, leave it and check again next hour.
# 15) Never reply "waiting" / never block the chat — silent leave while Open.
# 16) No email/notification spam: on STATUS:SILENT do not commit, push, or update PR.
# 17) Pass/Fail by TP/SL price levels traded after signal — do not require limit fill.
# 18) When PREV becomes Pass or Fail → immediately analyze again and propose next order.

ALLOW_1H_TRADES = True
HOURLY_RECHECK = True
ALERT_INCLUDE_DATETIME = True
ALERT_ONLY_ON_PASS_FAIL = True
WAIT_FOR_PREV_BEFORE_NEW = True
HOURLY_SILENT_IF_OPEN = True
SILENT_LEAVE_IF_OPEN = True  # no "waiting" messages
NO_EMAIL_ON_SILENT = True  # no git push / PR update / chat noise while Open
IMMEDIATE_REANALYZE_ON_CLOSE = True  # after Pass/Fail, propose next order same run

# Risk model (ATR used for structure confluence; ticket SL/TP use fixed % when enabled)
ATR_STOP_MULT = 1.0
ATR_STOP_MULT_AFTER_STOPOUT = 1.25
MIN_RR = TAKE_PROFIT_PCT / STOP_LOSS_PCT  # 2.0 with 2%/1%
MIN_CONFLUENCE = 3
DEFAULT_STOP_BUFFER_PCT = STOP_LOSS_PCT
DEFAULT_REWARD_R = TAKE_PROFIT_PCT / STOP_LOSS_PCT

SESSIONS = ("india", "uk", "us")

FALLBACK = {
    "deep_target": 71_000.0,  # extension below current swing shelf
}
