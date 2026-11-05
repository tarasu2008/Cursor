#!/usr/bin/env python3
"""BTC multi-timeframe analysis + paper-order proposals for TradingView."""

from __future__ import annotations

import argparse
import json
import math
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from rules import (
    FALLBACK,
    MIDRANGE_NO_TRADE,
    NOTIONAL_USD,
    PREFER_SHORT_AT_SUPPLY,
    PROTECT_OPEN_ORDERS,
    REQUIRE_BREAK_CLOSE_FOR_BREAKDOWN,
)

ROOT = Path(__file__).resolve().parent
STATE_PATH = ROOT / "data" / "orders_state.json"
LOG_DIR = ROOT / "logs"
IST = timezone(timedelta(hours=5, minutes=30))
KRAKEN_OHLC = "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval={interval}"
KRAKEN_TICKER = "https://api.kraken.com/0/public/Ticker?pair=XBTUSD"


@dataclass
class OrderProposal:
    idea_id: str
    side: str  # buy | sell
    order_type: str  # limit
    entry: float
    stop: float
    take_profit: float
    qty: float
    notional_usd: float
    reason: str
    session: str
    status: str = "proposed"  # proposed | working | filled | closed | cancelled


def ist_now() -> datetime:
    return datetime.now(tz=IST)


def fetch_json(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode())


def load_ohlc(interval: int) -> list[dict[str, float | datetime]]:
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


def qty_for(entry: float) -> float:
    return round(NOTIONAL_USD / entry, 3)


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {"orders": [], "history": []}
    return json.loads(STATE_PATH.read_text())


def save_state(state: dict[str, Any]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, indent=2, default=str))


def working_orders(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [o for o in state.get("orders", []) if o.get("status") in {"proposed", "working", "filled"}]


def analyze(session: str) -> dict[str, Any]:
    daily = load_ohlc(1440)
    h1 = load_ohlc(60)
    px = ticker_price()
    closes = [r["c"] for r in daily]
    e20, e50, e200 = ema(closes, 20)[-1], ema(closes, 50)[-1], ema(closes, 200)[-1]
    daily_rsi = rsi(closes)
    daily_atr = atr(daily)
    today = daily[-1]
    yday = daily[-2]
    day_high, day_low = today["h"], today["l"]
    mid = (day_high + day_low) / 2

    # Recent structure
    swing_low_30 = min(r["l"] for r in daily[-30:])
    swing_high_30 = max(r["h"] for r in daily[-30:])
    last_h1 = h1[-1]

    bias = "range"
    if px < e20 and px < e50 and daily_rsi < 45:
        bias = "bearish"
    elif px > e20 and px > e50 and daily_rsi > 55:
        bias = "bullish"

    proposals: list[OrderProposal] = []
    notes: list[str] = []

    # Mid-range filter from chat: do not chase middle.
    in_mid = MIDRANGE_NO_TRADE and (day_low + 0.25 * (day_high - day_low)) < px < (
        day_low + 0.75 * (day_high - day_low)
    )
    if day_high - day_low < daily_atr * 0.3:
        in_mid = False  # too tight a day to apply mid filter

    # Setup A: rejection short into supply (20EMA / day high / 50EMA)
    supply = max(e20, day_high)
    if PREFER_SHORT_AT_SUPPLY and bias in {"bearish", "range"}:
        entry = round(min(supply, e50) if px < e50 else supply, 0)
        if entry <= px:
            entry = round(max(px * 1.002, e20), 0)
        stop = round(entry * 1.008, 0)
        tp = round(max(e200, FALLBACK["ema200_exit_zone"]), 0)
        if entry > px and (entry - px) < daily_atr * 1.2:
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
                    reason=f"Rejection short into supply/EMA. Bias={bias}. Chat rule: prefer short at supply.",
                    session=session,
                )
            )
            notes.append(f"Short limit {entry} SL {stop} TP {tp}")

    # Setup B: breakdown short only on confirmed close under day/swing low
    break_level = min(day_low, swing_low_30)
    if REQUIRE_BREAK_CLOSE_FOR_BREAKDOWN and last_h1["c"] < break_level:
        entry = round(break_level * 0.999, 0)
        stop = round(mid if mid > entry else entry * 1.015, 0)
        tp = round(FALLBACK["sept_swing_low"], 0)
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
                reason="1H close already under breakdown level (chat rule: wait for break close).",
                session=session,
            )
        )
        notes.append(f"Breakdown short confirmed under {break_level}")
    elif bias == "bearish":
        entry = round(break_level * 0.999, 0)
        stop = round(max(e50, day_high) * 1.002, 0)
        tp = round(min(e200, FALLBACK["sept_swing_low"] + 200), 0)
        proposals.append(
            OrderProposal(
                idea_id=f"short-break-wait-{session}-{ist_now().strftime('%Y%m%d')}",
                side="sell",
                order_type="limit",
                entry=entry,
                stop=stop,
                take_profit=tp,
                qty=qty_for(entry),
                notional_usd=NOTIONAL_USD,
                reason="Pending breakdown: only valid if price accepts under level (do not market short mid-range).",
                session=session,
            )
        )
        notes.append(f"Pending breakdown limit {entry} (wait for break)")

    # Setup C: long only on reclaim of day high / failed-breakdown repair
    reclaim = max(day_high, e20)
    if bias != "bearish" or last_h1["c"] > e20:
        entry = round(reclaim * 1.001, 0)
        stop = round(min(day_low, e200), 0)
        tp = round(e50 if e50 > entry else swing_high_30, 0)
        if tp > entry:
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
                    reason="Long only on reclaim strength (chat rule after failed mid-range shorts).",
                    session=session,
                )
            )
            notes.append(f"Long reclaim {entry} SL {stop} TP {tp}")

    # Dip long pending (optional second $10k)
    dip = round(min(e200, day_low), 0)
    if dip < px * 0.99:
        proposals.append(
            OrderProposal(
                idea_id=f"long-dip-{session}-{ist_now().strftime('%Y%m%d')}",
                side="buy",
                order_type="limit",
                entry=dip,
                stop=round(dip * 0.985, 0),
                take_profit=round(e20, 0),
                qty=qty_for(dip),
                notional_usd=NOTIONAL_USD,
                reason="Dip buy at 200EMA / day low demand.",
                session=session,
            )
        )

    # Prefer at most 2 working ideas: one short, one long
    shorts = [p for p in proposals if p.side == "sell"]
    longs = [p for p in proposals if p.side == "buy"]
    chosen: list[OrderProposal] = []
    if shorts:
        # Prefer supply rejection over pending break if price is mid/high
        chosen.append(shorts[0])
    if longs:
        chosen.append(longs[0] if in_mid or bias != "bearish" else longs[-1])
    chosen = chosen[:2]

    if in_mid and px < e20:
        notes.append("Price in day mid-range under 20EMA → no market chase; limits only.")

    return {
        "session": session,
        "timestamp_ist": ist_now().isoformat(),
        "price": px,
        "bias": bias,
        "levels": {
            "ema20": round(e20, 1),
            "ema50": round(e50, 1),
            "ema200": round(e200, 1),
            "day_high": round(day_high, 1),
            "day_low": round(day_low, 1),
            "day_mid": round(mid, 1),
            "yday_high": round(yday["h"], 1),
            "yday_low": round(yday["l"], 1),
            "swing_low_30": round(swing_low_30, 1),
            "swing_high_30": round(swing_high_30, 1),
            "rsi14": round(daily_rsi, 1),
            "atr14": round(daily_atr, 1),
        },
        "in_midrange": in_mid,
        "notes": notes,
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
        state.setdefault("history", []).extend(
            [o for o in open_ones if o.get("status") == "cancelled"]
        )

    # Attach new proposals
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


def print_report(report: dict[str, Any]) -> None:
    print("=" * 60)
    print(f"BTC PAPER BOT | session={report['session']} | {report['timestamp_ist']}")
    print(f"Price ${report['price']:.2f} | bias={report['bias']} | midrange={report['in_midrange']}")
    lv = report["levels"]
    print(
        f"EMA20 {lv['ema20']} | EMA50 {lv['ema50']} | EMA200 {lv['ema200']} | "
        f"RSI {lv['rsi14']} | ATR {lv['atr14']}"
    )
    print(f"Day H/L {lv['day_high']}/{lv['day_low']} | 30d H/L {lv['swing_high_30']}/{lv['swing_low_30']}")
    for n in report.get("notes", []):
        print(f"- {n}")
    if report.get("blocked_reason"):
        print(f"ORDER GUARD: {report['blocked_reason']}")
    print(f"\nTradingView tickets (${int(NOTIONAL_USD)} each):")
    for t in report.get("tv_ticket", []):
        print(
            f"  {t['side']} LIMIT {t['price']} | qty {t['units']} | "
            f"SL {t['stop_loss']} | TP {t['take_profit']} | {t['idea_id']}"
        )
    if not report.get("tv_ticket"):
        print("  (no new ticket — flat / guarded)")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", choices=["india", "uk", "us", "ad_hoc"], default="ad_hoc")
    parser.add_argument("--propose", action="store_true", help="Write proposals into order state")
    parser.add_argument("--force-replace", action="store_true", help="Cancel tracked opens and replace")
    parser.add_argument("--confirm-placed", action="store_true", help="Mark proposed as working on TV")
    parser.add_argument("--status", action="store_true")
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
    print_report(report)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
