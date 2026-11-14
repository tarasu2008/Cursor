"""Every-trade deep review — enhance the bot brain after each Pass/Fail.

Called automatically when a ticket closes. Writes structured lessons and
applies durable rule bumps so the next trade is stricter than the last.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
LESSONS_PATH = ROOT / "data" / "lessons_brain.json"
IST = timezone(timedelta(hours=5, minutes=30))


def _now() -> datetime:
    return datetime.now(tz=IST)


def load_brain() -> dict[str, Any]:
    if not LESSONS_PATH.exists():
        return {
            "updated_ist": None,
            "trade_count": 0,
            "pass": 0,
            "fail": 0,
            "hard_rules": [],
            "lessons": [],
        }
    try:
        return json.loads(LESSONS_PATH.read_text())
    except Exception:
        return {
            "updated_ist": None,
            "trade_count": 0,
            "pass": 0,
            "fail": 0,
            "hard_rules": [],
            "lessons": [],
        }


def save_brain(brain: dict[str, Any]) -> None:
    LESSONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    brain["updated_ist"] = _now().isoformat()
    LESSONS_PATH.write_text(json.dumps(brain, indent=2))


def deep_review_closed_trade(
    *,
    side: str,
    entry: float,
    stop_loss: float,
    take_profit: float,
    qty: float,
    outcome: str,
    mistake: str | None,
    lesson: str | None,
    path_high: float | None,
    path_low: float | None,
    fill_price: float | None = None,
    px: float | None = None,
) -> dict[str, Any]:
    """Deep analysis of one closed trade. Persist + return brain update."""
    brain = load_brain()
    brain["trade_count"] = int(brain.get("trade_count") or 0) + 1
    if outcome == "Pass":
        brain["pass"] = int(brain.get("pass") or 0) + 1
    elif outcome == "Fail":
        brain["fail"] = int(brain.get("fail") or 0) + 1

    stop_pct = abs(stop_loss - entry) / entry if entry else 0.0
    fill = float(fill_price) if fill_price else entry
    fill_slip_pct = abs(fill - entry) / entry if entry else 0.0
    room_from_fill = abs(stop_loss - fill) / fill if fill else 0.0

    findings: list[str] = []
    hard: list[str] = list(brain.get("hard_rules") or [])

    def add_hard(rule: str) -> None:
        if rule not in hard:
            hard.append(rule)

    if outcome == "Fail":
        if mistake in {"stop_hit", "stop_hit_before_tp"}:
            findings.append("Stop hunted — next ticket needs SL clear of recent range / liquidity.")
            add_hard("Never place SHORT/LONG if 1% SL sits inside recent 3H high/low.")
        if mistake == "both_sides_tagged":
            findings.append("Both sides tagged — prefer first-touch grading; avoid mid-range entries.")
            add_hard("No mid-range chase; wait for confirmed break or supply rejection.")
        if fill_slip_pct > 0.003 and room_from_fill < 0.008:
            findings.append(
                f"Fill slipped {fill_slip_pct:.2%} and left only {room_from_fill:.2%} to SL — "
                "limit was not resting; SL must be from fill."
            )
            add_hard("Require resting limits; recalculate Delta SL/TP from average fill.")
        if stop_pct < 0.012:
            findings.append("Fixed 1% stop was tight vs BTC noise — demand stronger confluence.")
            add_hard("Min confluence 4+; pending breakdown without 1H close is forbidden.")
        if mistake == "expired":
            findings.append("Trade expired 24h — idea lacked momentum; skip stale limits.")
            add_hard("Cancel / do not protect stale limits >2.5 ATR from market.")
    else:
        findings.append("Pass — keep the same structure filters that produced this win.")
        if stop_pct >= 0.009:
            findings.append("Risk distance respected (~1%); keep fill-based SL/TP.")

    # Always reinforce the locked Nov autopsy rules.
    for r in [
        "No pending breakdown ticket without confirmed 1H close under swing.",
        "Grade only bars after signal time; first-touch if both SL and TP tag.",
        "Dedupe same idea Fail within 24h — never triple-count losses.",
        "Deep-review every closed trade before proposing the next one.",
    ]:
        add_hard(r)

    entry_lesson = {
        "closed_ist": _now().isoformat(),
        "side": side,
        "entry": entry,
        "fill_price": fill,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "qty": qty,
        "outcome": outcome,
        "mistake": mistake,
        "base_lesson": lesson,
        "path_high": path_high,
        "path_low": path_low,
        "price_at_review": px,
        "stop_pct": round(stop_pct, 5),
        "fill_slip_pct": round(fill_slip_pct, 5),
        "room_from_fill_pct": round(room_from_fill, 5),
        "findings": findings,
        "brain_trade_n": brain["trade_count"],
    }
    lessons = list(brain.get("lessons") or [])
    lessons.append(entry_lesson)
    brain["lessons"] = lessons[-80:]
    brain["hard_rules"] = hard[-40:]
    brain["last_lesson"] = entry_lesson
    save_brain(brain)
    return entry_lesson


def brain_notes_for_next_trade() -> list[str]:
    """Short notes injected into the next analysis run."""
    brain = load_brain()
    notes: list[str] = []
    last = brain.get("last_lesson") or {}
    if last:
        notes.append(
            f"BRAIN last={last.get('outcome')} {last.get('side')} @{last.get('entry')} "
            f"— {'; '.join((last.get('findings') or [])[:2]) or last.get('base_lesson')}"
        )
    hard = brain.get("hard_rules") or []
    if hard:
        notes.append(f"BRAIN hard_rules({len(hard)}): {hard[-1]}")
    stats = f"BRAIN record P{brain.get('pass', 0)}/F{brain.get('fail', 0)} over {brain.get('trade_count', 0)} reviewed"
    notes.append(stats)
    return notes
