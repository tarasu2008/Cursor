#!/usr/bin/env python3
"""BTC multi-timeframe analysis + paper-order proposals for TradingView."""

from __future__ import annotations

import argparse
import json
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from rules import (
    ATR_STOP_MULT,
    ATR_STOP_MULT_AFTER_STOPOUT,
    FALLBACK,
    MIDRANGE_NO_TRADE,
    MIN_CONFLUENCE,
    MIN_RR,
    NOTIONAL_USD,
    PREFER_SHORT_AT_SUPPLY,
    PROTECT_OPEN_ORDERS,
    REQUIRE_BREAK_CLOSE_FOR_BREAKDOWN,
    REVIEW_PREVIOUS_SIGNAL,
    STOP_LOSS_PCT,
    TAKE_PROFIT_PCT,
    USE_FIXED_PCT_RISK,
    ALERT_ONLY_ON_PASS_FAIL,
    WAIT_FOR_PREV_BEFORE_NEW,
    HOURLY_SILENT_IF_OPEN,
    IMMEDIATE_REANALYZE_ON_CLOSE,
    MAX_ENTRY_DISTANCE_ATR,
    MAX_ENTRY_DISTANCE_PCT,
    ALERT_TITLE,
)

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "data" / "orders_state.json"
LATEST_SIGNAL_PATH = ROOT / "data" / "latest_signal.json"
ACTIVE_TRADE_PATH = ROOT / "data" / "active_trade.json"
HISTORY_PATH = ROOT / "data" / "signal_history.json"
LOG_DIR = ROOT / "logs"

# Runtime risk mult — raised if last signal was a stop-out (too-tight stop lesson).
_active_atr_stop_mult = ATR_STOP_MULT
IST = timezone(timedelta(hours=5, minutes=30))
KRAKEN_OHLC = "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval={interval}"
KRAKEN_TICKER = "https://api.kraken.com/0/public/Ticker?pair=XBTUSD"


@dataclass
class OrderProposal:
    idea_id: str
    side: str
    order_type: str
    entry: float
    stop: float
    take_profit: float
    qty: float
    notional_usd: float
    reason: str
    session: str
    confluence: int = 0
    factors: list[str] = field(default_factory=list)
    rr: float = 0.0
    status: str = "proposed"


def ist_now() -> datetime:
    return datetime.now(tz=IST)


def fetch_json(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode())


def load_ohlc(interval: int) -> list[dict[str, Any]]:
    data = fetch_json(KRAKEN_OHLC.format(interval=interval))
    if data.get("error"):
        raise RuntimeError(data["error"])
    key = next(k for k in data["result"] if k != "last")
    rows = []
    for r in data["result"][key]:
        rows.append(
            {
                "dt": datetime.fromtimestamp(int(r[0]), tz=timezone.utc).astimezone(IST),
                "o": float(r[1]),
                "h": float(r[2]),
                "l": float(r[3]),
                "c": float(r[4]),
                "v": float(r[6]),
            }
        )
    return rows


def ticker_price() -> float:
    data = fetch_json(KRAKEN_TICKER)
    return float(data["result"]["XXBTZUSD"]["c"][0])


def ema(vals: list[float], n: int) -> list[float]:
    k = 2 / (n + 1)
    out: list[float] = []
    e = vals[0]
    for i, v in enumerate(vals):
        e = v if i == 0 else v * k + e * (1 - k)
        out.append(e)
    return out


def rsi(vals: list[float], n: int = 14) -> float:
    gains: list[float] = []
    losses: list[float] = []
    ag = al = None
    last = 50.0
    for i in range(1, len(vals)):
        ch = vals[i] - vals[i - 1]
        gains.append(max(ch, 0.0))
        losses.append(max(-ch, 0.0))
        if i == n:
            ag = sum(gains) / n
            al = sum(losses) / n
        elif i > n and ag is not None and al is not None:
            ag = (ag * (n - 1) + gains[-1]) / n
            al = (al * (n - 1) + losses[-1]) / n
        if i >= n and ag is not None and al is not None:
            rs = ag / al if al else 999.0
            last = 100 - 100 / (1 + rs)
    return last


def atr(rows: list[dict], n: int = 14) -> float:
    trs = []
    for i in range(1, len(rows)):
        tr = max(
            rows[i]["h"] - rows[i]["l"],
            abs(rows[i]["h"] - rows[i - 1]["c"]),
            abs(rows[i]["l"] - rows[i - 1]["c"]),
        )
        trs.append(tr)
    return sum(trs[-n:]) / n if trs else 0.0


def macd_hist(vals: list[float]) -> float:
    if len(vals) < 35:
        return 0.0
    e12 = ema(vals, 12)
    e26 = ema(vals, 26)
    macd_line = [a - b for a, b in zip(e12, e26)]
    signal = ema(macd_line, 9)
    return macd_line[-1] - signal[-1]


def pivots(rows: list[dict], left: int = 2, right: int = 2) -> tuple[list[dict], list[dict]]:
    ph, pl = [], []
    for i in range(left, len(rows) - right):
        h = rows[i]["h"]
        l = rows[i]["l"]
        if all(h >= rows[i - k]["h"] and h >= rows[i + k]["h"] for k in range(1, left + 1)):
            if all(h >= rows[i + k]["h"] for k in range(1, right + 1)):
                ph.append({"i": i, "dt": rows[i]["dt"], "price": h})
        if all(l <= rows[i - k]["l"] and l <= rows[i + k]["l"] for k in range(1, left + 1)):
            if all(l <= rows[i + k]["l"] for k in range(1, right + 1)):
                pl.append({"i": i, "dt": rows[i]["dt"], "price": l})
    return ph, pl


def trendline_value(p1: dict, p2: dict, at_index: int) -> float:
    """Linear extrapolation between two pivot points to bar index at_index."""
    x1, y1 = p1["i"], p1["price"]
    x2, y2 = p2["i"], p2["price"]
    if x2 == x1:
        return y2
    slope = (y2 - y1) / (x2 - x1)
    return y1 + slope * (at_index - x1)


def qty_for(entry: float) -> float:
    return round(NOTIONAL_USD / entry, 3)


def risk_reward(side: str, entry: float, stop: float, tp: float) -> float:
    if side == "sell":
        risk = stop - entry
        reward = entry - tp
    else:
        risk = entry - stop
        reward = tp - entry
    if risk <= 0 or reward <= 0:
        return 0.0
    return reward / risk


def structure_stop(side: str, entry: float, structure: float, atr14: float) -> float:
    """Stop beyond structure by at least N ATR (lesson: 11 Nov stop too tight)."""
    pad = max(atr14 * _active_atr_stop_mult, entry * 0.004)
    if side == "sell":
        return round(max(structure, entry) + pad, 0)
    return round(min(structure, entry) - pad, 0)


def pct_stop_tp(side: str, entry: float) -> tuple[float, float]:
    """Fixed % risk: 1% SL / 2% TP (user request 12 Nov)."""
    if side == "sell":
        stop = round(entry * (1 + STOP_LOSS_PCT), 0)
        tp = round(entry * (1 - TAKE_PROFIT_PCT), 0)
    else:
        stop = round(entry * (1 - STOP_LOSS_PCT), 0)
        tp = round(entry * (1 + TAKE_PROFIT_PCT), 0)
    return stop, tp


def apply_ticket_risk(side: str, entry: float, stop: float, tp: float) -> tuple[float, float]:
    if USE_FIXED_PCT_RISK:
        return pct_stop_tp(side, entry)
    return stop, tp


def side_label(side: str) -> str:
    s = side.lower()
    if s in {"sell", "short"}:
        return "SHORT"
    if s in {"buy", "long"}:
        return "LONG"
    return side.upper()


def review_previous_signal(h1: list[dict], px: float, session: str = "ad_hoc") -> dict[str, Any]:
    """Score last signal as Pass or Fail only (no partial). Record paper P&L."""
    global _active_atr_stop_mult
    from performance import record_closed_trade, write_summary

    _active_atr_stop_mult = ATR_STOP_MULT
    empty = {
        "had_previous": False,
        "grade": "—",
        "result": "none",
        "mistake": None,
        "lesson": None,
        "adjustment": None,
        "pnl_usd": 0.0,
        "detail": "No previous signal.",
        "performance": write_summary(),
    }
    # Prefer active open trade file so hourly runs do not reset the clock.
    prev_path = ACTIVE_TRADE_PATH if ACTIVE_TRADE_PATH.exists() else LATEST_SIGNAL_PATH
    if not REVIEW_PREVIOUS_SIGNAL or not prev_path.exists():
        return empty

    prev = json.loads(prev_path.read_text())
    signals = prev.get("signals") or []
    if not signals:
        return {**empty, "detail": "Previous was FLAT.", "grade": "—"}

    # Avoid double-grading the same open signal every hour until it closes.
    if prev.get("graded_outcome") in {"Pass", "Fail"}:
        return {
            "had_previous": True,
            "grade": prev["graded_outcome"],
            "result": prev["graded_outcome"],
            "mistake": prev.get("graded_mistake"),
            "lesson": prev.get("graded_lesson"),
            "adjustment": None,
            "pnl_usd": prev.get("graded_pnl_usd", 0.0),
            "detail": f"Already graded {prev['graded_outcome']}",
            "previous_timestamp_ist": prev.get("timestamp_ist"),
            "performance": write_summary(),
        }

    ts = prev.get("timestamp_ist")
    try:
        issued = datetime.fromisoformat(ts)
        if issued.tzinfo is None:
            issued = issued.replace(tzinfo=IST)
    except Exception:
        issued = ist_now() - timedelta(hours=6)

    bars = [b for b in h1 if b["dt"] >= issued - timedelta(minutes=30)]
    if not bars:
        bars = h1[-12:]
    hi = max(b["h"] for b in bars)
    lo = min(b["l"] for b in bars)

    # Age: if still open after 24h without SL/TP, count as Fail (expired) — user asked Pass/Fail only.
    age_h = (ist_now() - issued).total_seconds() / 3600

    reviews = []
    grade = "—"
    mistake = None
    lesson = None
    adjustment = None
    pnl_usd = 0.0

    for sig in signals:
        side = sig["side"].lower()
        entry = float(sig["entry"])
        stop = float(sig["stop_loss"])
        tp = float(sig["take_profit"])
        qty = float(sig.get("qty") or round(NOTIONAL_USD / entry, 3))
        is_short = side in {"sell", "short"}
        label = side_label(side)

        # Analysis grade: did price trade the TP/SL levels after the signal?
        # Do NOT require limit fill — if TP level was reached, it is Pass (user 12 Nov).
        filled = hi >= entry if is_short else lo <= entry
        hit_sl = hi >= stop if is_short else lo <= stop
        hit_tp = lo <= tp if is_short else hi >= tp

        # Pass/Fail only — no partial.
        if hit_tp and hit_sl:
            # Both levels traded: Fail (conservative — no partial credit)
            outcome = "Fail"
            mistake = "both_sides_tagged"
            lesson = "Price tagged both SL and TP — counted Fail only."
        elif hit_tp:
            outcome = "Pass"
            lesson = "Take profit level reached — Pass."
        elif hit_sl:
            outcome = "Fail"
            mistake = "stop_hit"
            lesson = "Stop level reached — Fail."
            if abs(stop - entry) / entry < 0.012:
                _active_atr_stop_mult = ATR_STOP_MULT_AFTER_STOPOUT
                adjustment = f"ATR_STOP_MULT -> {ATR_STOP_MULT_AFTER_STOPOUT}"
        elif age_h >= 24:
            outcome = "Fail"
            mistake = "expired"
            lesson = "Neither SL nor TP in 24h — counted Fail."
        else:
            outcome = "Open"
            mistake = None
            lesson = None

        if outcome in {"Pass", "Fail"}:
            row = record_closed_trade(
                side=label,
                entry=entry,
                stop_loss=stop,
                take_profit=tp,
                qty=qty,
                outcome=outcome,
                issued_ist=ts,
                session=session,
            )
            pnl_usd = row["pnl_usd"] if row else 0.0
            grade = outcome
            prev["graded_outcome"] = outcome
            prev["graded_mistake"] = mistake
            prev["graded_lesson"] = lesson
            prev["graded_pnl_usd"] = pnl_usd
            prev_path.write_text(json.dumps(prev, indent=2))
            # Clear active trade once closed
            if ACTIVE_TRADE_PATH.exists() and outcome in {"Pass", "Fail"}:
                ACTIVE_TRADE_PATH.unlink(missing_ok=True)

        reviews.append(
            {
                "side": label,
                "entry": entry,
                "stop_loss": stop,
                "take_profit": tp,
                "qty": qty,
                "filled": filled,
                "hit_sl": hit_sl,
                "hit_tp": hit_tp,
                "grade": outcome if outcome in {"Pass", "Fail"} else "Open",
                "mistake": mistake,
                "pnl_usd": pnl_usd if outcome in {"Pass", "Fail"} else 0.0,
                "path_high": round(hi, 1),
                "path_low": round(lo, 1),
            }
        )

    if grade in {"Pass", "Fail"}:
        detail = f"{reviews[0]['side']} → {grade}"
    elif reviews:
        detail = f"{reviews[0]['side']} → Open"
        grade = "Open"
    else:
        detail = "No review"

    out = {
        "had_previous": True,
        "grade": grade,
        "previous_timestamp_ist": ts,
        "previous_price": prev.get("price"),
        "result": grade,
        "mistake": mistake,
        "lesson": lesson,
        "adjustment": adjustment,
        "pnl_usd": pnl_usd,
        "atr_stop_mult_now": _active_atr_stop_mult,
        "reviews": reviews,
        "detail": detail,
        "performance": write_summary(),
    }

    history = []
    if HISTORY_PATH.exists():
        try:
            history = json.loads(HISTORY_PATH.read_text())
        except Exception:
            history = []
    history.append({"reviewed_at_ist": ist_now().isoformat(), "current_price": px, **out})
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_PATH.write_text(json.dumps(history[-100:], indent=2))
    return out


def valid_ticket(side: str, entry: float, stop: float, tp: float) -> bool:
    rr = risk_reward(side, entry, stop, tp)
    if rr < MIN_RR:
        return False
    if side == "sell" and not (stop > entry > tp):
        return False
    if side == "buy" and not (stop < entry < tp):
        return False
    return True


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {"orders": [], "history": []}
    return json.loads(STATE_PATH.read_text())


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, default=str))


def working_orders(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [o for o in state.get("orders", []) if o.get("status") in {"proposed", "working", "filled"}]


def invalidate_stale(state: dict[str, Any], px: float, atr14: float) -> list[str]:
    """Cancel proposed ideas that price has structurally left behind."""
    notes = []
    for o in state.get("orders", []):
        if o.get("status") not in {"proposed", "working"}:
            continue
        entry = float(o["entry"])
        side = o["side"]
        # If a pending sell limit is > 2 ATR above market and aging, mark broken.
        if side == "sell" and entry - px > 2.5 * atr14:
            o["status"] = "cancelled"
            o["cancel_reason"] = "stale_above_market"
            o["cancelled_at"] = ist_now().isoformat()
            notes.append(f"Invalidated stale sell {entry} (>{2.5}*ATR above price)")
        if side == "buy" and px - entry > 2.5 * atr14:
            o["status"] = "cancelled"
            o["cancel_reason"] = "stale_below_market"
            o["cancelled_at"] = ist_now().isoformat()
            notes.append(f"Invalidated stale buy {entry} (>{2.5}*ATR below price)")
    if notes:
        save_state(state)
    return notes


def analyze(session: str) -> dict[str, Any]:
    daily = load_ohlc(1440)
    h1 = load_ohlc(60)
    h4 = load_ohlc(240)
    px = ticker_price()

    # Step 0 (required): review previous analysis before making a new one.
    review = review_previous_signal(h1, px, session=session)

    d_closes = [r["c"] for r in daily]
    h1_closes = [r["c"] for r in h1]
    e20, e50, e200 = ema(d_closes, 20)[-1], ema(d_closes, 50)[-1], ema(d_closes, 200)[-1]
    h1_e20 = ema(h1_closes, 20)[-1]
    daily_rsi = rsi(d_closes)
    h1_rsi = rsi(h1_closes)
    daily_atr = atr(daily)
    h1_atr = atr(h1)
    macd_d = macd_hist(d_closes)
    macd_h1 = macd_hist(h1_closes)

    today = daily[-1]
    yday = daily[-2]
    day_high, day_low = today["h"], today["l"]
    mid = (day_high + day_low) / 2
    swing_low_30 = min(r["l"] for r in daily[-30:])
    swing_high_30 = max(r["h"] for r in daily[-30:])
    last_h1 = h1[-1]

    # Volume: compare last completed daily volume to 20-day avg
    vols = [r["v"] for r in daily[:-1]]
    vol_avg = sum(vols[-20:]) / 20 if len(vols) >= 20 else sum(vols) / max(len(vols), 1)
    vol_spike = today["v"] > vol_avg * 1.4 if vol_avg else False

    # Swing pivots + descending resistance / rising support trendlines
    ph, pl = pivots(daily[-60:], 2, 2)
    # Re-index pivots relative to full daily for trendline math on last bar
    # Use last-60 window indices; map to local
    desc_line = None
    rise_line = None
    if len(ph) >= 2:
        p1, p2 = ph[-2], ph[-1]
        if p2["price"] < p1["price"]:
            desc_line = trendline_value(p1, p2, len(daily[-60:]) - 1)
    if len(pl) >= 2:
        p1, p2 = pl[-2], pl[-1]
        if p2["price"] > p1["price"]:
            rise_line = trendline_value(p1, p2, len(daily[-60:]) - 1)

    # Lower-high / lower-low structure
    recent_ph = [p["price"] for p in ph[-3:]]
    recent_pl = [p["price"] for p in pl[-3:]]
    lower_highs = len(recent_ph) >= 2 and recent_ph[-1] < recent_ph[-2]
    lower_lows = len(recent_pl) >= 2 and recent_pl[-1] < recent_pl[-2]

    bias = "range"
    if px < e20 and px < e50 and (daily_rsi < 45 or lower_highs):
        bias = "bearish"
    elif px > e20 and px > e50 and (daily_rsi > 55 or not lower_lows):
        bias = "bullish"

    in_mid = MIDRANGE_NO_TRADE and (day_low + 0.25 * (day_high - day_low)) < px < (
        day_low + 0.75 * (day_high - day_low)
    )
    if day_high - day_low < daily_atr * 0.3:
        in_mid = False

    notes: list[str] = []
    proposals: list[OrderProposal] = []

    # --- Strategy A: supply rejection short (confluence scored) ---
    if PREFER_SHORT_AT_SUPPLY and bias in {"bearish", "range"}:
        supply_levels = [day_high, e20, e50]
        if desc_line:
            supply_levels.append(desc_line)
        entry = round(min(lvl for lvl in supply_levels if lvl > px), 0) if any(
            lvl > px for lvl in supply_levels
        ) else round(day_high, 0)
        if entry <= px:
            entry = round(max(day_high, e20, px + h1_atr * 0.5), 0)

        factors = []
        if bias == "bearish":
            factors.append("daily_bearish")
        if lower_highs:
            factors.append("lower_highs")
        if px < e20:
            factors.append("below_ema20")
        if px < e50:
            factors.append("below_ema50")
        if macd_d < 0:
            factors.append("macd_daily_neg")
        if desc_line and entry <= desc_line * 1.01:
            factors.append("desc_trendline")
        if h1_rsi > 50:
            factors.append("h1_rsi_bounce")
        if vol_spike and today["c"] < today["o"]:
            factors.append("vol_sell_day")

        stop = structure_stop("sell", entry, max(day_high, entry), daily_atr)
        swing_tp = min(day_low, swing_low_30)
        r_dist = max(stop - entry, 1)
        tp = round(min(swing_tp, entry - MIN_RR * r_dist), 0)
        if tp >= entry:
            tp = round(entry - MIN_RR * r_dist, 0)
        stop, tp = apply_ticket_risk("sell", entry, stop, tp)

        rr = risk_reward("sell", entry, stop, tp)
        if (
            len(factors) >= MIN_CONFLUENCE
            and valid_ticket("sell", entry, stop, tp)
            and entry > px
            # Entry near market — avoid stale far EMA limits (rules: MAX_ENTRY_*).
            and (entry - px) < min(daily_atr * MAX_ENTRY_DISTANCE_ATR, entry * MAX_ENTRY_DISTANCE_PCT)
        ):
            proposals.append(
                OrderProposal(
                    idea_id=f"short-supply-{session}-{ist_now().strftime('%Y%m%d')}",
                    side="sell",
                    order_type="limit",
                    entry=entry,
                    stop=stop,
                    take_profit=tp,
                    qty=qty_for(entry),
                    notional_usd=NOTIONAL_USD,
                    reason="Supply rejection short with ATR structure stop + confluence filter.",
                    session=session,
                    confluence=len(factors),
                    factors=factors,
                    rr=round(rr, 2),
                )
            )
            notes.append(
                f"Short {entry} SL {stop} TP {tp} RR {rr:.2f} conf {len(factors)} {factors}"
            )
        else:
            notes.append(
                f"Skipped supply short (conf={len(factors)}/{MIN_CONFLUENCE}, rr={rr:.2f}, valid={valid_ticket('sell', entry, stop, tp)})"
            )

    # --- Strategy B: breakdown short (only after 1H close under swing) ---
    break_level = swing_low_30
    if REQUIRE_BREAK_CLOSE_FOR_BREAKDOWN and last_h1["c"] < break_level:
        entry = round(break_level * 0.999, 0)
        stop = structure_stop("sell", entry, max(day_high, last_h1["h"]), daily_atr)
        tp = round(min(FALLBACK["deep_target"], entry - MIN_RR * max(stop - entry, 1)), 0)
        stop, tp = apply_ticket_risk("sell", entry, stop, tp)
        factors = ["break_close_1h", "below_swing_low"]
        if bias == "bearish":
            factors.append("daily_bearish")
        if macd_h1 < 0:
            factors.append("macd_h1_neg")
        if vol_spike:
            factors.append("vol_spike")
        rr = risk_reward("sell", entry, stop, tp)
        if len(factors) >= MIN_CONFLUENCE and valid_ticket("sell", entry, stop, tp):
            proposals.append(
                OrderProposal(
                    idea_id=f"short-break-{session}-{ist_now().strftime('%Y%m%d')}",
                    side="sell",
                    order_type="limit",
                    entry=entry,
                    stop=stop,
                    take_profit=tp,
                    qty=qty_for(entry),
                    notional_usd=NOTIONAL_USD,
                    reason="Confirmed breakdown: 1H close under swing low.",
                    session=session,
                    confluence=len(factors),
                    factors=factors,
                    rr=round(rr, 2),
                )
            )
            notes.append(f"Breakdown short {entry} SL {stop} TP {tp} RR {rr:.2f}")
    elif bias == "bearish":
        entry = round(break_level * 0.999, 0)
        stop = structure_stop("sell", entry, day_high, daily_atr)
        tp = round(min(FALLBACK["deep_target"], entry - MIN_RR * max(stop - entry, 1)), 0)
        stop, tp = apply_ticket_risk("sell", entry, stop, tp)
        # If price is pressing the swing, place next SHORT now (esp. after Pass/Fail close).
        near_break = (px - break_level) <= max(daily_atr * 0.5, px * 0.01)
        if near_break and IMMEDIATE_REANALYZE_ON_CLOSE:
            factors = ["near_swing_low", "daily_bearish"]
            if lower_lows:
                factors.append("lower_lows")
            if macd_h1 < 0:
                factors.append("macd_h1_neg")
            if macd_d < 0:
                factors.append("macd_daily_neg")
            rr = risk_reward("sell", entry, stop, tp)
            if len(factors) >= MIN_CONFLUENCE and valid_ticket("sell", entry, stop, tp):
                proposals.append(
                    OrderProposal(
                        idea_id=f"short-break-pending-{session}-{ist_now().strftime('%Y%m%d')}",
                        side="sell",
                        order_type="limit",
                        entry=entry,
                        stop=stop,
                        take_profit=tp,
                        qty=qty_for(entry),
                        notional_usd=NOTIONAL_USD,
                        reason="Next order: breakdown limit at swing while price presses lows.",
                        session=session,
                        confluence=len(factors),
                        factors=factors,
                        rr=round(rr, 2),
                    )
                )
                notes.append(f"Breakdown limit ready {entry} SL {stop} TP {tp} RR {rr:.2f}")
            else:
                notes.append(
                    f"Pending breakdown under {break_level:.0f} → limit {entry} SL {stop} TP {tp}"
                )
        else:
            notes.append(
                f"Pending breakdown under {break_level:.0f} → limit {entry} SL {stop} TP {tp} "
                f"(wait for 1H close; not active yet)"
            )

    # --- Strategy C: reclaim long ---
    reclaim = max(day_high, e20 if e20 > px else day_high)
    if last_h1["c"] > h1_e20 and (bias != "bearish" or px > e200):
        entry = round(reclaim * 1.001, 0)
        stop = structure_stop("buy", entry, day_low, daily_atr)
        tp = round(max(e50, entry + MIN_RR * max(entry - stop, 1)), 0)
        stop, tp = apply_ticket_risk("buy", entry, stop, tp)
        factors = []
        if last_h1["c"] > h1_e20:
            factors.append("h1_above_ema20")
        if macd_h1 > 0:
            factors.append("macd_h1_pos")
        if rise_line and px >= rise_line:
            factors.append("rising_support")
        if h1_rsi < 40:
            factors.append("h1_rsi_reset")
        if px > e200:
            factors.append("above_ema200")
        rr = risk_reward("buy", entry, stop, tp)
        if len(factors) >= MIN_CONFLUENCE and valid_ticket("buy", entry, stop, tp) and entry >= px:
            proposals.append(
                OrderProposal(
                    idea_id=f"long-reclaim-{session}-{ist_now().strftime('%Y%m%d')}",
                    side="buy",
                    order_type="limit",
                    entry=entry,
                    stop=stop,
                    take_profit=tp,
                    qty=qty_for(entry),
                    notional_usd=NOTIONAL_USD,
                    reason="Reclaim long with confluence (not mid-range chase).",
                    session=session,
                    confluence=len(factors),
                    factors=factors,
                    rr=round(rr, 2),
                )
            )
            notes.append(f"Long reclaim {entry} SL {stop} TP {tp} RR {rr:.2f} {factors}")

    # --- Strategy D: dip long at swing demand ---
    dip = round(min(day_low, swing_low_30), 0)
    if dip < px * 0.995 and bias != "bullish":
        entry = dip
        stop = structure_stop("buy", entry, dip, daily_atr)
        tp = round(min(day_high, e20), 0)
        stop, tp = apply_ticket_risk("buy", entry, stop, tp)
        factors = ["swing_demand"]
        if daily_rsi < 35:
            factors.append("rsi_oversold")
        if rise_line:
            factors.append("rise_tl_nearby")
        if h1_rsi < 35:
            factors.append("h1_oversold")
        rr = risk_reward("buy", entry, stop, tp)
        if len(factors) >= MIN_CONFLUENCE and valid_ticket("buy", entry, stop, tp):
            proposals.append(
                OrderProposal(
                    idea_id=f"long-dip-{session}-{ist_now().strftime('%Y%m%d')}",
                    side="buy",
                    order_type="limit",
                    entry=entry,
                    stop=stop,
                    take_profit=tp,
                    qty=qty_for(entry),
                    notional_usd=NOTIONAL_USD,
                    reason="Dip long at swing demand with oversold confluence.",
                    session=session,
                    confluence=len(factors),
                    factors=factors,
                    rr=round(rr, 2),
                )
            )
            notes.append(f"Dip long {entry} SL {stop} TP {tp} RR {rr:.2f}")

    # Rank by confluence, then RR, then nearer-to-price entry (avoid far bounce limits after drops).
    def _rank_short(p: OrderProposal) -> tuple:
        return (p.confluence, p.rr, -abs(p.entry - px))

    def _rank_long(p: OrderProposal) -> tuple:
        return (p.confluence, p.rr, -abs(p.entry - px))

    shorts = sorted([p for p in proposals if p.side == "sell"], key=_rank_short, reverse=True)
    longs = sorted([p for p in proposals if p.side == "buy"], key=_rank_long, reverse=True)
    chosen: list[OrderProposal] = []
    if shorts:
        chosen.append(shorts[0])
    if longs and not (in_mid and bias == "bearish"):
        chosen.append(longs[0])
    chosen = chosen[:2]

    if in_mid:
        notes.append("Price in day mid-range → no market chase; limits only.")
    if desc_line:
        notes.append(f"Descending resistance trendline ≈ {desc_line:.0f}")
    if rise_line:
        notes.append(f"Rising support trendline ≈ {rise_line:.0f}")

    # Wait for previous Open trade to Pass/Fail before proposing a new one.
    waiting_prev = WAIT_FOR_PREV_BEFORE_NEW and review.get("grade") == "Open"
    if waiting_prev:
        chosen = []
        notes.insert(0, "SILENT: previous still Open — leave it; no new LONG/SHORT until Pass or Fail.")

    # Auto-invalidate stale tracked ideas
    state = load_state()
    stale_notes = invalidate_stale(state, px, daily_atr)
    notes.extend(stale_notes)

    if review.get("had_previous"):
        notes.insert(0, f"PREV REVIEW: {review.get('detail')}")
        if review.get("lesson"):
            notes.insert(1, f"LESSON: {review['lesson']}")
        if review.get("adjustment"):
            notes.insert(2, f"ADJUSTED: {review['adjustment']}")

    return {
        "session": session,
        "timestamp_ist": ist_now().isoformat(),
        "price": px,
        "bias": bias,
        "previous_review": review,
        "levels": {
            "ema20": round(e20, 1),
            "ema50": round(e50, 1),
            "ema200": round(e200, 1),
            "h1_ema20": round(h1_e20, 1),
            "day_high": round(day_high, 1),
            "day_low": round(day_low, 1),
            "day_mid": round(mid, 1),
            "yday_high": round(yday["h"], 1),
            "yday_low": round(yday["l"], 1),
            "swing_low_30": round(swing_low_30, 1),
            "swing_high_30": round(swing_high_30, 1),
            "desc_trendline": round(desc_line, 1) if desc_line else None,
            "rise_trendline": round(rise_line, 1) if rise_line else None,
            "rsi14": round(daily_rsi, 1),
            "h1_rsi14": round(h1_rsi, 1),
            "atr14": round(daily_atr, 1),
            "h1_atr14": round(h1_atr, 1),
            "macd_hist_daily": round(macd_d, 1),
            "macd_hist_h1": round(macd_h1, 1),
            "vol_spike": vol_spike,
            "lower_highs": lower_highs,
            "lower_lows": lower_lows,
        },
        "in_midrange": in_mid,
        "waiting_prev": waiting_prev,
        "notes": notes,
        "strategies": [
            "A_supply_rejection",
            "B_breakdown_confirm",
            "C_reclaim_long",
            "D_dip_demand",
        ],
        "filters": {
            "min_rr": MIN_RR,
            "min_confluence": MIN_CONFLUENCE,
            "atr_stop_mult": ATR_STOP_MULT,
        },
        "proposals": [asdict(p) for p in chosen],
        "tv_ticket": [
            {
                "panel": "TradingView Paper Order",
                "side": p.side.upper(),
                "type": "Limit",
                "price": p.entry,
                "units": p.qty,
                "take_profit": p.take_profit,
                "stop_loss": p.stop,
                "rr": p.rr,
                "confluence": p.confluence,
                "idea_id": p.idea_id,
            }
            for p in chosen
        ],
    }


def merge_proposals(state: dict[str, Any], report: dict[str, Any], force_replace: bool) -> dict[str, Any]:
    open_ones = working_orders(state)
    new_props = report["proposals"]

    if open_ones and PROTECT_OPEN_ORDERS and not force_replace:
        report["action"] = "keep_existing"
        report["blocked_reason"] = (
            "Open/proposed orders already tracked. Will not end them for a new idea. "
            "Close or fill them first, or pass --force-replace."
        )
        report["existing"] = open_ones
        return report

    if force_replace and open_ones:
        for o in state["orders"]:
            if o.get("status") in {"proposed", "working"}:
                o["status"] = "cancelled"
                o["cancelled_at"] = ist_now().isoformat()
                o["cancel_reason"] = "force_replace"

    for p in new_props:
        p["status"] = "proposed"
        p["created_at"] = ist_now().isoformat()
        state.setdefault("orders", []).append(p)

    report["action"] = "proposed"
    save_state(state)
    return report


def confirm_placed(state: dict[str, Any]) -> None:
    for o in state.get("orders", []):
        if o.get("status") == "proposed":
            o["status"] = "working"
            o["placed_at"] = ist_now().isoformat()
            o["venue"] = "tradingview_paper"
    save_state(state)


def _tickets_from_active() -> list[dict[str, Any]]:
    """Fallback tickets from active_trade.json while PREV is Open."""
    if not ACTIVE_TRADE_PATH.exists():
        return []
    try:
        active = json.loads(ACTIVE_TRADE_PATH.read_text())
    except Exception:
        return []
    out = []
    for s in active.get("signals") or []:
        out.append(
            {
                "side": s.get("side", "SHORT"),
                "price": s.get("entry"),
                "stop_loss": s.get("stop_loss"),
                "take_profit": s.get("take_profit"),
                "units": s.get("qty"),
            }
        )
    return out


def print_simple(report: dict[str, Any], *, force: bool = False) -> bool:
    """Cursor alert format. Returns True if an alert was printed.

    User rule: alert ONLY when previous is Pass or Fail (unless force / no prev).
    While Open → wait (no Cursor alert).
    """
    review = report.get("previous_review") or {}
    perf = review.get("performance") or {}
    today = perf.get("today") or {}
    week = perf.get("week") or {}
    month = perf.get("month") or {}

    grade = review.get("grade") or "—"
    if grade not in {"Pass", "Fail", "Open", "—"}:
        grade = "—"

    if ALERT_ONLY_ON_PASS_FAIL and not force and grade == "Open":
        return False

    when = report.get("timestamp_ist") or ist_now().isoformat()
    try:
        dt = datetime.fromisoformat(when)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        when_line = dt.strftime("%d %b %Y, %I:%M %p IST")
    except Exception:
        when_line = when
    print(ALERT_TITLE)
    print("")
    print(f"Time: {when_line}")
    print(f"PREV: {grade}")
    if review.get("pnl_usd"):
        print(f"PREV PnL: ${review['pnl_usd']:+.2f}")
    print(
        f"Today: Pass {today.get('pass', 0)} Fail {today.get('fail', 0)} PnL ${today.get('pnl_usd', 0):+.2f}"
    )
    print(
        f"Week: Pass {week.get('pass', 0)} Fail {week.get('fail', 0)} PnL ${week.get('pnl_usd', 0):+.2f}"
    )
    print(
        f"Month: Pass {month.get('pass', 0)} Fail {month.get('fail', 0)} PnL ${month.get('pnl_usd', 0):+.2f}"
    )

    tickets = report.get("tv_ticket") or []
    if not tickets and grade == "Open":
        tickets = _tickets_from_active()
    if not tickets:
        print("FLAT")
        print("Entry: —")
        print("Stop Loss: —")
        print("Take Profit: —")
        print("If TP: — | If SL: —")
        return True
    for t in tickets:
        entry = float(t["price"])
        sl = float(t["stop_loss"])
        tp = float(t["take_profit"])
        qty = float(t["units"])
        side = t["side"].lower()
        if side in {"sell", "short"}:
            profit = (entry - tp) * qty
            loss = (sl - entry) * qty
        else:
            profit = (tp - entry) * qty
            loss = (entry - sl) * qty
        print(side_label(t["side"]))
        print(f"Entry: {t['price']}")
        print(f"Stop Loss: {t['stop_loss']}")
        print(f"Take Profit: {t['take_profit']}")
        print(f"If TP: +${profit:.2f} | If SL: -${loss:.2f}")
    return True


def save_latest_signal(report: dict[str, Any]) -> Path:
    path = LATEST_SIGNAL_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    signals = [
        {
            "side": side_label(t["side"]),
            "entry": t["price"],
            "stop_loss": t["stop_loss"],
            "take_profit": t["take_profit"],
            "qty": t["units"],
        }
        for t in report.get("tv_ticket") or []
    ]
    simple = {
        "timestamp_ist": report["timestamp_ist"],
        "price": report["price"],
        "bias": report["bias"],
        "previous_review": report.get("previous_review"),
        "waiting_prev": report.get("waiting_prev", False),
        "signals": signals,
    }
    path.write_text(json.dumps(simple, indent=2))

    # Keep a stable active trade until Pass/Fail (hourly rechecks must not reset / replace it).
    if report.get("waiting_prev") and ACTIVE_TRADE_PATH.exists():
        return path
    if signals:
        if ACTIVE_TRADE_PATH.exists():
            active = json.loads(ACTIVE_TRADE_PATH.read_text())
            a_sigs = active.get("signals") or []
            same = (
                a_sigs
                and a_sigs[0].get("side") == signals[0]["side"]
                and float(a_sigs[0].get("entry", 0)) == float(signals[0]["entry"])
                and active.get("graded_outcome") not in {"Pass", "Fail"}
            )
            if not same:
                ACTIVE_TRADE_PATH.write_text(json.dumps({**simple, "signals": signals}, indent=2))
        else:
            ACTIVE_TRADE_PATH.write_text(json.dumps({**simple, "signals": signals}, indent=2))
    return path


def print_report(report: dict[str, Any]) -> None:
    print("=" * 60)
    print(f"BTC PAPER BOT v2 | session={report['session']} | {report['timestamp_ist']}")
    print(f"Price ${report['price']:.2f} | bias={report['bias']} | midrange={report['in_midrange']}")
    lv = report["levels"]
    print(
        f"EMA20 {lv['ema20']} | EMA50 {lv['ema50']} | EMA200 {lv['ema200']} | "
        f"RSI {lv['rsi14']} | ATR {lv['atr14']}"
    )
    print(
        f"H1 RSI {lv['h1_rsi14']} | MACD_d {lv['macd_hist_daily']} | "
        f"LH {lv['lower_highs']} LL {lv['lower_lows']} | vol_spike {lv['vol_spike']}"
    )
    print(f"Day H/L {lv['day_high']}/{lv['day_low']} | 30d H/L {lv['swing_high_30']}/{lv['swing_low_30']}")
    if lv.get("desc_trendline"):
        print(f"Desc TL {lv['desc_trendline']} | Rise TL {lv.get('rise_trendline')}")
    for n in report.get("notes", []):
        print(f"- {n}")
    if report.get("blocked_reason"):
        print(f"ORDER GUARD: {report['blocked_reason']}")
    print(f"\nTradingView tickets (${int(NOTIONAL_USD)} each, min RR {MIN_RR}, min conf {MIN_CONFLUENCE}):")
    for t in report.get("tv_ticket", []):
        print(
            f"  {t['side']} LIMIT {t['price']} | qty {t['units']} | "
            f"SL {t['stop_loss']} | TP {t['take_profit']} | "
            f"RR {t.get('rr')} conf {t.get('confluence')} | {t['idea_id']}"
        )
    if not report.get("tv_ticket"):
        print("  (no ticket passed confluence/RR filters — FLAT)")
    print("=" * 60)
    print("\nSIMPLE:")
    print_simple(report)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", choices=["india", "uk", "us", "ad_hoc"], default="ad_hoc")
    parser.add_argument("--propose", action="store_true")
    parser.add_argument("--force-replace", action="store_true")
    parser.add_argument("--confirm-placed", action="store_true")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--simple", action="store_true", help="Print Cursor alert when Pass/Fail (or new after close)")
    parser.add_argument(
        "--show",
        action="store_true",
        help="Force Cursor alert even if PREV is Open (manual check)",
    )
    parser.add_argument(
        "--hourly",
        action="store_true",
        help="Silent status check while Open; on Pass/Fail alert + next order",
    )
    parser.add_argument("--performance", action="store_true", help="Show Pass/Fail and PnL summary")
    args = parser.parse_args()

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()

    if args.performance:
        from performance import write_summary

        print(json.dumps(write_summary(), indent=2))
        return

    if args.status:
        print(json.dumps({"working": working_orders(state), "all": state.get("orders", [])}, indent=2))
        return

    if args.confirm_placed:
        confirm_placed(state)
        print("Marked proposed orders as working (TradingView Paper).")
        print(json.dumps(working_orders(state), indent=2))
        return

    report = analyze(args.session)
    if args.propose:
        report = merge_proposals(state, report, force_replace=args.force_replace)

    out = LOG_DIR / f"report_{args.session}_{ist_now().strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(report, indent=2))
    grade = (report.get("previous_review") or {}).get("grade")

    # Hourly: silent while Open. On Pass/Fail keep next tickets (immediate re-analyze).
    if args.hourly and grade == "Open":
        report["tv_ticket"] = []
        report["proposals"] = []
        report["waiting_prev"] = True
    elif args.hourly and grade in {"Pass", "Fail"} and IMMEDIATE_REANALYZE_ON_CLOSE:
        # Keep new LONG/SHORT from same run — do not strip tickets.
        report["waiting_prev"] = False
    elif args.hourly:
        # Flat / no close this hour — do not open a fresh trade on silent hourly.
        report["tv_ticket"] = []
        report["proposals"] = []

    latest = save_latest_signal(report)

    if args.hourly:
        if grade in {"Pass", "Fail"}:
            # Alert close + next order (if any)
            print_simple(report, force=True)
        else:
            print("STATUS:SILENT")
    elif args.simple or args.show:
        if args.show:
            print_simple(report, force=True)
        elif HOURLY_SILENT_IF_OPEN and grade == "Open":
            print("STATUS:SILENT")
        else:
            # After Pass/Fail or when flat: show next ticket immediately
            force = grade in {"Pass", "Fail", "—", None} or bool(report.get("tv_ticket"))
            printed = print_simple(report, force=bool(force))
            if not printed:
                print("STATUS:SILENT")
    else:
        print_report(report)
        print(f"Wrote {out}")
        print(f"Saved {latest}")


if __name__ == "__main__":
    main()
