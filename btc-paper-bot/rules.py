"""Trading rules remembered from the BTC analysis chat (Oct–Nov 2026).

This file is the source of truth. Do not drop these without an explicit user change.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Size & risk (locked until user says analysis is solid)
# ---------------------------------------------------------------------------
NOTIONAL_USD = 1_000.0
USE_FIXED_PCT_RISK = True
STOP_LOSS_PCT = 0.01      # 1% loss
TAKE_PROFIT_PCT = 0.02    # 2% profit

# ---------------------------------------------------------------------------
# Labels & alert format
# ---------------------------------------------------------------------------
USE_LONG_SHORT_LABELS = True          # LONG / SHORT only (never Buy/Sell wording)
ALERT_TITLE = "Cursor alert"         # never "BTC alert"
ALERT_INCLUDE_DATETIME = True        # Time: dd Mon YYYY, hh:mm AM/PM IST
ALERT_ONLY_ON_PASS_FAIL = True       # no spam while PREV is Open
SILENT_LEAVE_IF_OPEN = True          # never reply "waiting"
NO_EMAIL_ON_SILENT = True            # no git commit/push/PR on STATUS:SILENT

# ---------------------------------------------------------------------------
# Review / Pass-Fail / ledger
# ---------------------------------------------------------------------------
REVIEW_PREVIOUS_SIGNAL = True
# Pass/Fail by whether TP/SL *price levels* traded after signal — fill NOT required.
GRADE_BY_LEVELS_NOT_FILL = True
# Pass or Fail only — no partial / mixed / open_in_profit grades in user alerts.
PASS_FAIL_ONLY = True
# Persist paper PnL as if $1000 real trades: Pass≈+$20, Fail≈−$10.
TRACK_DAILY_WEEKLY_MONTHLY_PNL = True
# After Pass or Fail → same run proposes the next LONG/SHORT.
IMMEDIATE_REANALYZE_ON_CLOSE = True
# While Open: do not stack a second idea.
WAIT_FOR_PREV_BEFORE_NEW = True

# ---------------------------------------------------------------------------
# Schedule behaviour
# ---------------------------------------------------------------------------
ALLOW_1H_TRADES = True
HOURLY_RECHECK = True                # legacy name; actual cadence is every 30 min
RECHECK_EVERY_MINUTES = 30           # check BTC + PREV Pass/Fail every 30 min
HOURLY_SILENT_IF_OPEN = True         # while Open: STATUS:SILENT, empty chat reply
# One active ticket only (never SHORT+LONG together) so Pass/Fail is unambiguous.
ONE_ACTIVE_TICKET = True
# Session timers optional — user may disable; 30-min timer is the Pass/Fail watcher.
SESSIONS = ("india", "uk", "us")     # ~09:00 / 13:00 / 19:45 IST

# ---------------------------------------------------------------------------
# Strategy filters (lessons from this chat)
# ---------------------------------------------------------------------------
MIDRANGE_NO_TRADE = True
PREFER_SHORT_AT_SUPPLY = True
REQUIRE_BREAK_CLOSE_FOR_BREAKDOWN = True
NO_REENTRY_SAME_IDEA = True
PROTECT_OPEN_ORDERS = True

# Risk model (ATR for structure confluence; ticket SL/TP use fixed % when enabled)
ATR_STOP_MULT = 1.0
ATR_STOP_MULT_AFTER_STOPOUT = 1.25
MIN_RR = TAKE_PROFIT_PCT / STOP_LOSS_PCT  # 2.0
MIN_CONFLUENCE = 3
DEFAULT_STOP_BUFFER_PCT = STOP_LOSS_PCT
DEFAULT_REWARD_R = TAKE_PROFIT_PCT / STOP_LOSS_PCT
# Supply/limit entries must stay near market (avoid far stale bounce shorts).
MAX_ENTRY_DISTANCE_ATR = 1.0
MAX_ENTRY_DISTANCE_PCT = 0.02

# Furry A & Furry B (pine: indicators/furry_ab.pine) — use in confluence when useful.
USE_FURRY_AB = True
FURRY_A_LEN = 9
FURRY_B_LEN = 21
FURRY_MA_TYPE = "EMA"  # EMA | SMA | RMA | WMA

# Extra BTC frameworks (pine in indicators/ + Python in extra_indicators.py)
USE_EXTRA_INDICATORS = True
MIN_ADX = 18.0           # Triple Confluence ADX filter
MIN_Q_FOR_TRADE = 0.45   # Q Trend Quality: skip ultra-choppy if below
BLOCK_CHOPPY_Q = True    # if Q choppy and ADX weak → prefer FLAT

FALLBACK = {
    "deep_target": 65_000.0,
}

# ---------------------------------------------------------------------------
# Lessons — never repeat
# ---------------------------------------------------------------------------
# 1) 29 Oct: shorted mid-range into demand without daily break close → stopped.
# 2) 11 Nov US: bounce short OK but SL too tight under liquidity → stopped.
# 3) Bot bug: breakdown TP used stale FALLBACK above entry for shorts.
# 4) Stale proposed orders stayed "protected" after structure broke.
# 5) EMA/RSI alone without swing/trendline confluence = weak tickets.
# 6) Always review previous signal before a new one.
# 7) Simple ticket: LONG/SHORT + Entry + SL + TP; $1000 paper size.
# 8) Grade Pass/Fail only; save daily/weekly/monthly counts + $ PnL.
# 9) Cursor alert + IST Time; never BTC alert / notification chatter.
# 10) Every 30 min: check BTC + PREV status; silent while Open; alert on Pass/Fail then next order.
# 11) Do not require limit fill to grade TP/SL (12 Nov morning SHORT = Pass).
# 12) No email spam: silent checks must not commit/push/update PR.
# 13) Furry A (9) / Furry B (21) EMA cloud + cross — confluence for LONG/SHORT.
# 14) Extra frameworks: Supertrend, ADX, Q quality, MACD+SMA200, CDC Action Zone,
#     multi-EMA suite, TrueMarket mean proxy — see indicators/*.pine.
