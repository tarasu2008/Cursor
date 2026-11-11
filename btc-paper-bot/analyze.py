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
)

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "data" / "orders_state.json"
LATEST_SIGNAL_PATH = ROOT / "data" / "latest_signal.json"
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


def side_label(side: str) -> str:
    s = side.lower()
    if s in {"sell", "short"}:
        return "SHORT"
    if s in {"buy", "long"}:
        return "LONG"
    return side.upper()


def review_previous_signal(h1: list[dict], px: float) -> dict[str, Any]:
    """Score the last saved signal against price path since it was issued."""
    global _active_atr_stop_mult
    _active_atr_stop_mult = ATR_STOP_MULT
    empty = {
        "had_previous": False,
        "result": "none",
        "mistake": None,
        "lesson": None,
        "adjustment": None,
        "detail": "No previous signal file.",
    }
    if not REVIEW_PREVIOUS_SIGNAL or not LATEST_SIGNAL_PATH.exists():
        return empty

    prev = json.loads(LATEST_SIGNAL_PATH.read_text())
    signals = prev.get("signals") or []
    if not signals:
        return {**empty, "detail": "Previous file had no signals (was FLAT)."}

    ts = prev.get("timestamp_ist")
    try:
        issued = datetime.fromisoformat(ts)
        if issued.tzinfo is None:
            issued = issued.replace(tzinfo=IST)
    except Exception:
        issued = ist_now() - timedelta(hours=6)

    # Price extremes since signal (from 1H bars at/after issue hour)
    bars = [b for b in h1 if b["dt"] >= issued - timedelta(minutes=30)]
    if not bars:
        bars = h1[-12:]
    hi = max(b["h"] for b in bars)
    lo = min(b["l"] for b in bars)

    reviews = []
    worst_mistake = None
    lesson = None
    adjustment = None

    for sig in signals:
        side = sig["side"].lower()
        entry = float(sig["entry"])
        stop = float(sig["stop_loss"])
        tp = float(sig["take_profit"])
        is_short = side in {"sell", "short"}

        filled = hi >= entry if is_short else lo <= entry
        hit_sl = hi >= stop if is_short else lo <= stop
        hit_tp = lo <= tp if is_short else hi >= tp

        # Path order approximation: if both SL and TP tagged, assume adverse first if
        # stop is closer to first extreme in direction of entry fill.
        result = "pending"
        mistake = None
        if not filled:
            result = "not_filled"
        elif hit_sl and hit_tp:
            result = "stopped_before_or_with_tp"
            mistake = "stop_too_tight_or_choppy"
        elif hit_sl:
            result = "stopped_out"
            mistake = "stop_too_tight" if abs(stop - entry) < atr(h1) * 1.2 else "thesis_wrong"
        elif hit_tp:
            result = "take_profit_hit"
        else:
            result = "open_in_profit" if (
                (is_short and px < entry) or ((not is_short) and px > entry)
            ) else "open_underwater"

        if mistake == "stop_too_tight" or mistake == "stop_too_tight_or_choppy":
            worst_mistake = mistake
            lesson = "Widen stop to >= 1.25 ATR beyond structure; do not place SL under obvious liquidity high/low."
            adjustment = f"ATR_STOP_MULT -> {ATR_STOP_MULT_AFTER_STOPOUT}"
            _active_atr_stop_mult = ATR_STOP_MULT_AFTER_STOPOUT
        elif result == "not_filled" and is_short and hi < entry and (entry - hi) > atr(h1):
            worst_mistake = worst_mistake or "entry_too_far"
            lesson = lesson or "Entry was unrealistic above market; place supply closer to price or wait."
        elif result == "take_profit_hit":
            lesson = lesson or "Prior signal worked — keep same confluence rules."

        reviews.append(
            {
                "side": side_label(side),
                "entry": entry,
                "stop_loss": stop,
                "take_profit": tp,
                "filled": filled,
                "hit_sl": hit_sl,
                "hit_tp": hit_tp,
                "result": result,
                "mistake": mistake,
                "path_high": round(hi, 1),
                "path_low": round(lo, 1),
            }
        )

    detail = "; ".join(
        f"{r['side']} entry {r['entry']} → {r['result']}" + (f" ({r['mistake']})" if r["mistake"] else "")
        for r in reviews
    )
    out = {
        "had_previous": True,
        "previous_timestamp_ist": ts,
        "previous_price": prev.get("price"),
        "result": reviews[0]["result"] if len(reviews) == 1 else "mixed",
        "mistake": worst_mistake,
        "lesson": lesson,
        "adjustment": adjustment,
        "atr_stop_mult_now": _active_atr_stop_mult,
        "reviews": reviews,
        "detail": detail,
    }

    # Persist review trail
    history = []
    if HISTORY_PATH.exists():
        try:
            history = json.loads(HISTORY_PATH.read_text())
        except Exception:
            history = []
    history.append({"reviewed_at_ist": ist_now().isoformat(), "current_price": px, **out})
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_PATH.write_text(json.dumps(history[-50:], indent=2))
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
    review = review_previous_signal(h1, px)

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
        # Target: next swing low or 1.5R, whichever is farther but sane
        swing_tp = min(day_low, swing_low_30)
        r_dist = stop - entry
        tp_rr = round(entry - MIN_RR * r_dist, 0)
        tp = round(min(swing_tp, tp_rr), 0)
        if tp >= entry:
            tp = round(entry - MIN_RR * r_dist, 0)

        rr = risk_reward("sell", entry, stop, tp)
        if (
            len(factors) >= MIN_CONFLUENCE
            and valid_ticket("sell", entry, stop, tp)
            and entry > px
            and (entry - px) < daily_atr * 1.5
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
        tp = round(min(FALLBACK["deep_target"], entry - MIN_RR * (stop - entry)), 0)
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
        tp = round(min(FALLBACK["deep_target"], entry - MIN_RR * (stop - entry)), 0)
        notes.append(
            f"Pending breakdown under {break_level:.0f} → limit {entry} SL {stop} TP {tp} "
            f"(wait for 1H close; not active yet)"
        )

    # --- Strategy C: reclaim long ---
    reclaim = max(day_high, e20 if e20 > px else day_high)
    if last_h1["c"] > h1_e20 and (bias != "bearish" or px > e200):
        entry = round(reclaim * 1.001, 0)
        stop = structure_stop("buy", entry, day_low, daily_atr)
        tp = round(max(e50, entry + MIN_RR * (entry - stop)), 0)
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

    # Rank by confluence then RR; keep best short + best long
    shorts = sorted([p for p in proposals if p.side == "sell"], key=lambda p: (p.confluence, p.rr), reverse=True)
    longs = sorted([p for p in proposals if p.side == "buy"], key=lambda p: (p.confluence, p.rr), reverse=True)
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


def print_simple(report: dict[str, Any]) -> None:
    """User-facing format: LONG/SHORT + entry + SL + TP only."""
    review = report.get("previous_review") or {}
    if review.get("had_previous"):
        print(f"PREV: {review.get('detail')}")
        if review.get("lesson"):
            print(f"LESSON: {review['lesson']}")
    tickets = report.get("tv_ticket") or []
    print(f"Price ${report['price']:.2f} | {report['timestamp_ist']}")
    if not tickets:
        print("FLAT — no LONG/SHORT setup")
        return
    for t in tickets:
        print(
            f"{side_label(t['side'])} | Entry {t['price']} | Stop Loss {t['stop_loss']} | "
            f"Take Profit {t['take_profit']} | Qty {t['units']}"
        )


def save_latest_signal(report: dict[str, Any]) -> Path:
    path = LATEST_SIGNAL_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    simple = {
        "timestamp_ist": report["timestamp_ist"],
        "price": report["price"],
        "bias": report["bias"],
        "previous_review": report.get("previous_review"),
        "signals": [
            {
                "side": side_label(t["side"]),
                "entry": t["price"],
                "stop_loss": t["stop_loss"],
                "take_profit": t["take_profit"],
                "qty": t["units"],
            }
            for t in report.get("tv_ticket") or []
        ],
    }
    path.write_text(json.dumps(simple, indent=2))
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
    parser.add_argument("--simple", action="store_true", help="Print only Buy/Sell entry SL TP")
    args = parser.parse_args()

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    state = load_state()

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
    latest = save_latest_signal(report)
    if args.simple:
        print_simple(report)
    else:
        print_report(report)
    print(f"Wrote {out}")
    print(f"Saved {latest}")


if __name__ == "__main__":
    main()
