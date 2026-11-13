"""Pass/Fail + paper P&L ledger (daily / weekly / monthly)."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from rules import NOTIONAL_USD, STOP_LOSS_PCT, TAKE_PROFIT_PCT

ROOT = Path(__file__).resolve().parent
LEDGER_PATH = ROOT / "data" / "performance_ledger.json"
SUMMARY_PATH = ROOT / "data" / "performance_summary.json"
IST = timezone(timedelta(hours=5, minutes=30))


def _now() -> datetime:
    return datetime.now(tz=IST)


def _load_ledger() -> dict[str, Any]:
    if not LEDGER_PATH.exists():
        return {"trades": [], "updated_ist": None}
    return json.loads(LEDGER_PATH.read_text())


def _save_ledger(ledger: dict[str, Any]) -> None:
    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    ledger["updated_ist"] = _now().isoformat()
    LEDGER_PATH.write_text(json.dumps(ledger, indent=2))


def trade_pnl(side: str, entry: float, qty: float, outcome: str) -> float:
    """Paper P&L in USD for a closed trade. Pass=+2% notional, Fail=-1% notional."""
    notional = qty * entry if qty and entry else NOTIONAL_USD
    if outcome == "Pass":
        return round(notional * TAKE_PROFIT_PCT, 2)
    if outcome == "Fail":
        return round(-notional * STOP_LOSS_PCT, 2)
    return 0.0


def record_closed_trade(
    *,
    side: str,
    entry: float,
    stop_loss: float,
    take_profit: float,
    qty: float,
    outcome: str,
    issued_ist: str | None,
    session: str = "ad_hoc",
) -> dict[str, Any] | None:
    """Append a Pass/Fail closed trade once. Skip duplicates of same issue+entry+outcome."""
    if outcome not in {"Pass", "Fail"}:
        return None
    ledger = _load_ledger()
    key = f"{issued_ist}|{side}|{entry}|{outcome}"
    for t in ledger.get("trades", []):
        if t.get("dedupe_key") == key:
            return t
    pnl = trade_pnl(side, entry, qty, outcome)
    row = {
        "dedupe_key": key,
        "closed_ist": _now().isoformat(),
        "issued_ist": issued_ist,
        "session": session,
        "side": side,
        "entry": entry,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "qty": qty,
        "outcome": outcome,  # Pass | Fail only
        "pnl_usd": pnl,
        "notional_usd": round(qty * entry, 2) if qty and entry else NOTIONAL_USD,
    }
    ledger.setdefault("trades", []).append(row)
    _save_ledger(ledger)
    write_summary(ledger)
    return row


def _in_range(ts: str, start: datetime, end: datetime) -> bool:
    try:
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        return start <= dt <= end
    except Exception:
        return False


def summarize(ledger: dict[str, Any] | None = None) -> dict[str, Any]:
    ledger = ledger or _load_ledger()
    trades = ledger.get("trades", [])
    now = _now()
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start - timedelta(days=day_start.weekday())
    month_start = day_start.replace(day=1)

    def bucket(start: datetime) -> dict[str, Any]:
        rows = [t for t in trades if _in_range(t.get("closed_ist", ""), start, now)]
        wins = [t for t in rows if t.get("outcome") == "Pass"]
        losses = [t for t in rows if t.get("outcome") == "Fail"]
        profit = round(sum(float(t.get("pnl_usd", 0) or 0) for t in wins), 2)
        # Total loss as negative USD sum of Fail trades.
        loss = round(sum(float(t.get("pnl_usd", 0) or 0) for t in losses), 2)
        pnl = round(profit + loss, 2)
        return {
            "trades": len(rows),
            "pass": len(wins),
            "fail": len(losses),
            "pnl_usd": pnl,
            "total_profit_usd": profit,
            "total_loss_usd": loss,
        }

    wins_all = [t for t in trades if t.get("outcome") == "Pass"]
    losses_all = [t for t in trades if t.get("outcome") == "Fail"]
    all_profit = round(sum(float(t.get("pnl_usd", 0) or 0) for t in wins_all), 2)
    all_loss = round(sum(float(t.get("pnl_usd", 0) or 0) for t in losses_all), 2)
    all_pnl = round(all_profit + all_loss, 2)
    summary = {
        "updated_ist": now.isoformat(),
        "rules": {
            "notional_usd": NOTIONAL_USD,
            "stop_loss_pct": STOP_LOSS_PCT,
            "take_profit_pct": TAKE_PROFIT_PCT,
            "grade": "Pass or Fail only (no partial)",
        },
        "today": bucket(day_start),
        "week": bucket(week_start),
        "month": bucket(month_start),
        "all_time": {
            "trades": len(trades),
            "pass": len(wins_all),
            "fail": len(losses_all),
            "pnl_usd": all_pnl,
            "total_profit_usd": all_profit,
            "total_loss_usd": all_loss,
        },
    }
    return summary


def write_summary(ledger: dict[str, Any] | None = None) -> dict[str, Any]:
    summary = summarize(ledger)
    SUMMARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2))
    return summary
