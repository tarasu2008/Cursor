"""Profit-v2 trial — ATR risk, Fail cooldown, bounce regime, reclaim LONG, Delta sync.

User lock (15 Nov): run for the next 10 trades issued under these rules.
If results are not better after 10 closes → disable and revert to fixed 1%/2%.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from rules import (
    PROFIT_V2_TRIAL_ENABLED,
    PROFIT_V2_TRIAL_TRADES,
    PROFIT_V2_FEATURES,
)

ROOT = Path(__file__).resolve().parent
TRIAL_PATH = ROOT / "data" / "profit_v2_trial.json"
IST = timezone(timedelta(hours=5, minutes=30))


def _now() -> datetime:
    return datetime.now(tz=IST)


def _default() -> dict[str, Any]:
    return {
        "enabled": bool(PROFIT_V2_TRIAL_ENABLED),
        "status": "active" if PROFIT_V2_TRIAL_ENABLED else "off",
        "max_trades": int(PROFIT_V2_TRIAL_TRADES),
        "trades_completed": 0,
        "started_ist": _now().isoformat() if PROFIT_V2_TRIAL_ENABLED else None,
        "features": list(PROFIT_V2_FEATURES),
        "closed": [],
        "pass": 0,
        "fail": 0,
        "pnl_usd": 0.0,
        "verdict": None,
        "note": (
            "Trial: next 10 trades under profit-v2. "
            "If not clearly better → remove / revert to fixed 1%/2%."
        ),
    }


def load_trial() -> dict[str, Any]:
    if not TRIAL_PATH.exists():
        state = _default()
        if state["enabled"]:
            save_trial(state)
        return state
    try:
        state = json.loads(TRIAL_PATH.read_text())
    except Exception:
        state = _default()
        save_trial(state)
        return state
    # Boot/enable from rules if file was off and rules say on.
    if PROFIT_V2_TRIAL_ENABLED and state.get("status") in {None, "off"} and not state.get("expired_manual"):
        state["enabled"] = True
        state["status"] = "active"
        state["started_ist"] = state.get("started_ist") or _now().isoformat()
        state["max_trades"] = int(PROFIT_V2_TRIAL_TRADES)
        state["features"] = list(PROFIT_V2_FEATURES)
        save_trial(state)
    return state


def save_trial(state: dict[str, Any]) -> None:
    TRIAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    state["updated_ist"] = _now().isoformat()
    TRIAL_PATH.write_text(json.dumps(state, indent=2))


def trial_active() -> bool:
    """True while profit-v2 features should apply."""
    if not PROFIT_V2_TRIAL_ENABLED:
        return False
    state = load_trial()
    if state.get("status") == "remove":
        return False
    if not state.get("enabled"):
        return False
    if int(state.get("trades_completed") or 0) >= int(state.get("max_trades") or PROFIT_V2_TRIAL_TRADES):
        return False
    return True


def trial_started_ist() -> str | None:
    return (load_trial() or {}).get("started_ist")


def feature_on(name: str) -> bool:
    if not trial_active():
        return False
    feats = load_trial().get("features") or PROFIT_V2_FEATURES
    return name in feats


def record_trial_close(
    *,
    outcome: str,
    side: str,
    entry: float,
    stop_loss: float,
    take_profit: float,
    pnl_usd: float,
    issued_ist: str | None,
) -> dict[str, Any] | None:
    """Count a closed trade toward the 10-trade trial (issued after trial start only)."""
    if outcome not in {"Pass", "Fail"}:
        return None
    state = load_trial()
    if state.get("status") == "remove":
        return state
    started = state.get("started_ist")
    if not started:
        return state
    # Only count tickets issued under the trial window.
    if issued_ist:
        try:
            iss = datetime.fromisoformat(issued_ist)
            st = datetime.fromisoformat(started)
            if iss.tzinfo is None:
                iss = iss.replace(tzinfo=IST)
            if st.tzinfo is None:
                st = st.replace(tzinfo=IST)
            if iss < st:
                return state  # pre-trial open ticket — do not count
        except Exception:
            pass
    if not state.get("enabled") and state.get("status") != "active":
        # Still allow counting if we were active when trade was issued.
        if not started:
            return state

    # Dedupe by issued+entry+outcome
    key = f"{issued_ist}|{side}|{entry}|{outcome}"
    for row in state.get("closed") or []:
        if row.get("key") == key:
            return state

    state.setdefault("closed", []).append(
        {
            "key": key,
            "closed_ist": _now().isoformat(),
            "issued_ist": issued_ist,
            "side": side,
            "entry": entry,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "outcome": outcome,
            "pnl_usd": pnl_usd,
        }
    )
    state["trades_completed"] = len(state["closed"])
    state["pass"] = sum(1 for r in state["closed"] if r["outcome"] == "Pass")
    state["fail"] = sum(1 for r in state["closed"] if r["outcome"] == "Fail")
    state["pnl_usd"] = round(sum(float(r.get("pnl_usd") or 0) for r in state["closed"]), 2)

    max_n = int(state.get("max_trades") or PROFIT_V2_TRIAL_TRADES)
    if state["trades_completed"] >= max_n:
        state["enabled"] = False
        state["status"] = "expired"
        # Auto-verdict: keep only if expectancy clearly better than ~+$1 and WR > 40% or pnl > +20.
        wr = state["pass"] / max(state["trades_completed"], 1)
        pnl = state["pnl_usd"]
        if pnl >= 20.0 and wr >= 0.4:
            state["verdict"] = "keep_candidate"
            state["note"] = (
                f"Trial done ({max_n} trades): PnL ${pnl:+.2f} WR {wr:.0%}. "
                "Candidate to KEEP — confirm with user before locking forever."
            )
        else:
            state["verdict"] = "remove"
            state["status"] = "remove"
            state["note"] = (
                f"Trial done ({max_n} trades): PnL ${pnl:+.2f} WR {wr:.0%}. "
                "REMOVE profit-v2 — revert to fixed 1%/2% (user rule)."
            )
    save_trial(state)
    return state


def trial_notes() -> list[str]:
    state = load_trial()
    if state.get("status") == "remove":
        return [
            "PROFIT-V2: REMOVE — trial finished; features OFF. Revert to fixed 1%/2%.",
            state.get("note") or "",
        ]
    if not trial_active():
        if state.get("status") == "expired":
            return [f"PROFIT-V2: expired — {state.get('note')}"]
        return []
    n = int(state.get("trades_completed") or 0)
    max_n = int(state.get("max_trades") or 10)
    return [
        f"PROFIT-V2 TRIAL active: {n}/{max_n} trades "
        f"(ATR stops, Fail cooldown, bounce FLAT, reclaim LONG, Delta sync). "
        f"After {max_n} → keep or REMOVE."
    ]
