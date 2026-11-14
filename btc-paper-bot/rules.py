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
# Alerts + ledger also show Total Profit and Total Loss for week and month.
TRACK_WEEK_MONTH_TOTAL_PROFIT_LOSS = True
# After Pass or Fail → same run proposes the next LONG/SHORT.
IMMEDIATE_REANALYZE_ON_CLOSE = True
# Every closed trade runs deep review into lessons_brain.json before the next idea.
DEEP_LEARN_EVERY_TRADE = True
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
# After analysis produces a new LONG/SHORT → place it on Delta DEMO automatically.
AUTO_PLACE_DELTA_DEMO = True
DELTA_DEMO_BASE = "https://cdn-ind.testnet.deltaex.org"
# Session timers optional — user may disable; 30-min timer is the Pass/Fail watcher.
SESSIONS = ("india", "uk", "us")     # ~09:00 / 13:00 / 19:45 IST

# ---------------------------------------------------------------------------
# Strategy filters (lessons from this chat)
# ---------------------------------------------------------------------------
MIDRANGE_NO_TRADE = True
PREFER_SHORT_AT_SUPPLY = True
REQUIRE_BREAK_CLOSE_FOR_BREAKDOWN = True
# Do NOT place "near swing" breakdown tickets before a confirmed 1H close under the level.
# (Lesson Nov 13–14: pending breakdown shorts were stopped out repeatedly.)
ALLOW_PENDING_BREAKDOWN_TICKET = False
NO_REENTRY_SAME_IDEA = True
PROTECT_OPEN_ORDERS = True
# Grade only on bars AFTER signal time (not pre-signal lookback).
GRADE_FROM_ISSUED_ONLY = True
# If both SL and TP tagged, decide by which level traded first on the path.
GRADE_BOTH_BY_FIRST_TOUCH = True
# SHORT/LONG limit must not instantly market-fill into a 1% stop (entry on correct side of mark).
REQUIRE_LIMIT_RESTING = True
# Recalculate Delta demo SL/TP from average fill (keep 1%/2% from real fill, not stale limit).
DELTA_SL_TP_FROM_FILL = True
# Reject tickets whose 1% stop sits inside recent 3H range noise.
MIN_STOP_CLEAR_OF_RECENT_RANGE = True

# Risk model (ATR for structure confluence; ticket SL/TP use fixed % when enabled)
ATR_STOP_MULT = 1.0
ATR_STOP_MULT_AFTER_STOPOUT = 1.25
MIN_RR = TAKE_PROFIT_PCT / STOP_LOSS_PCT  # 2.0
MIN_CONFLUENCE = 4  # was 3 — require stronger agreement after Nov Fail streak
DEFAULT_STOP_BUFFER_PCT = STOP_LOSS_PCT
DEFAULT_REWARD_R = TAKE_PROFIT_PCT / STOP_LOSS_PCT
# Supply/limit entries must stay near market (avoid far stale bounce shorts).
MAX_ENTRY_DISTANCE_ATR = 0.75
MAX_ENTRY_DISTANCE_PCT = 0.015

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
#     multi-EMA suite, TrueMarket mean, UT Bot + SSL Channel — see indicators/*.pine.
# 15) Triple Confluence: trend + HTF/ADX filter; ATR stop reference + tiered TPs
#     (paper ticket still uses fixed 1%/2% until user widens risk).
# 16) Cycle: analyze → on new ticket bid Delta DEMO (API) with same Entry/SL/TP;
#     30-min watch → Pass/Fail alert → analyze next → bid again. Silent while Open.
# 17) Cursor alert shows Week/Month Total Profit and Total Loss (not only net PnL).
# 18) Mistakes Nov 13–14: pending breakdown without 1H close; limit shorts filled as market
#     with SL from lower limit (stop too tight); same Fail counted 3x; grading used bars
#     before signal; both-sides always Fail. Fixes: confirmed break only, resting limits,
#     SL/TP from fill, grade from issued, first-touch, stronger confluence, idea dedupe.
# 19) Enhance brain every trade: deep_review_closed_trade() → data/lessons_brain.json;
#     next analysis must read hard_rules / last findings (never forget prior mistakes).
