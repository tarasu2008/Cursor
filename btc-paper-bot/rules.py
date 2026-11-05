"""Trading rules learned from the BTC analysis chat (Oct–Nov 2026)."""

from __future__ import annotations

NOTIONAL_USD = 1_000.0  # user request: $1000 for all paper trades (was 10000)

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

# Hard invalidation distances used when structure levels are missing.
DEFAULT_STOP_BUFFER_PCT = 0.008
DEFAULT_REWARD_R = 2.0

# Session names → run labels
SESSIONS = ("india", "uk", "us")

# Key structural references (updated by analyzer from live data; these are fallbacks)
FALLBACK = {
    "ema200_exit_zone": 76_450.0,
    "sept_swing_low": 74_892.0,
}
