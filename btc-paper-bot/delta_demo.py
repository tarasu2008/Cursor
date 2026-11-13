"""Delta Exchange India DEMO (testnet) order placement for the BTC paper cycle.

Requires env: DELTA_API_KEY, DELTA_API_SECRET (demo keys from demo.delta.exchange).
Base URL: https://cdn-ind.testnet.deltaex.org

Cycle: after analysis creates a new LONG/SHORT ticket → place matching demo order
with bracket SL/TP. While a demo position/order is open for the same ticket, skip.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DELTA_STATE_PATH = ROOT / "data" / "delta_orders.json"
IST = timezone(timedelta(hours=5, minutes=30))

BASE_URL = "https://cdn-ind.testnet.deltaex.org"
PRODUCT_SYMBOL = "BTCUSD"
PRODUCT_ID = 84
CONTRACT_VALUE_BTC = 0.001  # 1 contract = 0.001 BTC


def ist_now() -> datetime:
    return datetime.now(tz=IST)


def _env_ready() -> bool:
    return bool(os.environ.get("DELTA_API_KEY", "").strip() and os.environ.get("DELTA_API_SECRET", "").strip())


def _sign(method: str, path: str, query: str = "", body: str = "") -> tuple[str, str]:
    api_secret = os.environ["DELTA_API_SECRET"].strip()
    ts = str(int(time.time()))
    q = ("?" + query) if query and not query.startswith("?") else query
    payload = method + ts + path + q + body
    sig = hmac.new(api_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return ts, sig


def call(
    method: str,
    path: str,
    query: str = "",
    body: dict[str, Any] | None = None,
    *,
    retries: int = 6,
) -> tuple[int, Any]:
    """Authenticated REST call; retries briefly for rotating Cloud Agent egress IPs."""
    api_key = os.environ["DELTA_API_KEY"].strip()
    body_s = json.dumps(body, separators=(",", ":")) if body is not None else ""
    q = ("?" + query) if query else ""
    last: tuple[int, Any] = (0, {"error": {"code": "no_attempt"}})
    for attempt in range(max(1, retries)):
        ts, sig = _sign(method, path, q if q.startswith("?") else (("?" + query) if query else ""), body_s)
        # Delta signature: method + timestamp + path + queryString + body
        # queryString includes leading '?'
        req = urllib.request.Request(
            BASE_URL + path + q,
            data=(body_s.encode() if body_s else None),
            method=method,
        )
        req.add_header("api-key", api_key)
        req.add_header("timestamp", ts)
        req.add_header("signature", sig)
        req.add_header("User-Agent", "btc-paper-bot/1.0")
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = raw
            last = (e.code, parsed)
            code = ""
            if isinstance(parsed, dict):
                code = str((parsed.get("error") or {}).get("code") or "")
            if e.code == 401 and "ip_not_whitelisted" in code and attempt + 1 < retries:
                time.sleep(0.35)
                continue
            return last
        except Exception as e:
            last = (0, {"error": {"code": "network", "message": str(e)}})
            time.sleep(0.35)
    return last


def load_delta_state() -> dict[str, Any]:
    if not DELTA_STATE_PATH.exists():
        return {}
    try:
        return json.loads(DELTA_STATE_PATH.read_text())
    except Exception:
        return {}


def save_delta_state(state: dict[str, Any]) -> None:
    DELTA_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    DELTA_STATE_PATH.write_text(json.dumps(state, indent=2, default=str))


def contracts_for_qty_btc(qty_btc: float) -> int:
    return max(1, int(round(float(qty_btc) / CONTRACT_VALUE_BTC)))


def _same_ticket(a: dict[str, Any] | None, side: str, entry: float, sl: float, tp: float) -> bool:
    if not a:
        return False
    try:
        return (
            str(a.get("side", "")).upper() == side.upper()
            and abs(float(a.get("entry", 0)) - float(entry)) < 0.5
            and abs(float(a.get("stop_loss", 0)) - float(sl)) < 0.5
            and abs(float(a.get("take_profit", 0)) - float(tp)) < 0.5
        )
    except Exception:
        return False


def position_size() -> int | None:
    st, body = call("GET", "/v2/positions", f"product_id={PRODUCT_ID}")
    if st != 200 or not isinstance(body, dict):
        return None
    res = body.get("result") or {}
    if isinstance(res, list):
        res = res[0] if res else {}
    try:
        return int(float(res.get("size") or 0))
    except Exception:
        return None


def _mark_price() -> float | None:
    try:
        with urllib.request.urlopen(BASE_URL + f"/v2/tickers/{PRODUCT_SYMBOL}", timeout=15) as r:
            data = json.loads(r.read().decode())
        res = data.get("result") or {}
        return float(res.get("mark_price") or res.get("close") or 0) or None
    except Exception:
        return None


def place_ticket(
    *,
    side: str,
    entry: float,
    stop_loss: float,
    take_profit: float,
    qty_btc: float,
) -> dict[str, Any]:
    """Place limit + bracket SL/TP on demo. side: LONG/SHORT or buy/sell."""
    if not _env_ready():
        return {"ok": False, "error": "missing_DELTA_API_KEY_or_SECRET"}

    label = str(side).upper()
    if label in {"SHORT", "SELL"}:
        label = "SHORT"
        api_side = "sell"
    else:
        label = "LONG"
        api_side = "buy"
    size = contracts_for_qty_btc(qty_btc)
    client_id = f"btc-paper-{api_side}-{int(time.time())}"

    prev = load_delta_state()
    if prev.get("status") == "open" and _same_ticket(prev.get("analysis"), label, entry, stop_loss, take_profit):
        return {"ok": True, "skipped": True, "reason": "same_ticket_already_open", "state": prev}

    # Do not re-bid a ticket that just failed (same side/entry/SL/TP).
    if prev.get("close_reason") in {"paper_Fail", "paper_Fail_sync_close", "invalid_reentry_fill_above_sl"}:
        if _same_ticket(prev.get("analysis"), label, entry, stop_loss, take_profit):
            return {"ok": True, "skipped": True, "reason": "same_ticket_just_failed"}

    pos = position_size()
    if pos is not None and pos != 0:
        return {
            "ok": False,
            "skipped": True,
            "reason": "delta_position_already_open",
            "position_size": pos,
        }

    mark = _mark_price()
    if mark is not None:
        # Limit sells above market fill immediately near mark — SL must stay valid vs mark.
        if label == "SHORT" and stop_loss <= mark:
            return {
                "ok": False,
                "skipped": True,
                "reason": "sl_already_invalid_vs_mark",
                "mark": mark,
                "stop_loss": stop_loss,
            }
        if label == "LONG" and stop_loss >= mark:
            return {
                "ok": False,
                "skipped": True,
                "reason": "sl_already_invalid_vs_mark",
                "mark": mark,
                "stop_loss": stop_loss,
            }

    order = {
        "product_id": PRODUCT_ID,
        "product_symbol": PRODUCT_SYMBOL,
        "size": size,
        "side": api_side,
        "order_type": "limit_order",
        "limit_price": str(entry),
        "time_in_force": "gtc",
        "reduce_only": False,
        "client_order_id": client_id,
        "bracket_stop_loss_price": str(stop_loss),
        "bracket_take_profit_price": str(take_profit),
        "bracket_stop_trigger_method": "last_traded_price",
    }
    st, body = call("POST", "/v2/orders", body=order)
    if st != 200 or not isinstance(body, dict) or not body.get("success"):
        return {"ok": False, "http": st, "error": body, "request": order}

    result = body.get("result") or {}
    state = {
        "updated_ist": ist_now().isoformat(),
        "venue": "delta_demo",
        "base_url": BASE_URL,
        "status": "open",
        "analysis": {
            "side": "SHORT" if api_side == "sell" else "LONG",
            "entry": float(entry),
            "stop_loss": float(stop_loss),
            "take_profit": float(take_profit),
            "qty_btc": float(qty_btc),
            "notional_usd": 1000,
        },
        "order": {
            "id": result.get("id"),
            "client_order_id": result.get("client_order_id") or client_id,
            "side": result.get("side"),
            "size_contracts": size,
            "contract_value_btc": CONTRACT_VALUE_BTC,
            "limit_price": result.get("limit_price"),
            "average_fill_price": result.get("average_fill_price"),
            "state": result.get("state"),
            "product_symbol": PRODUCT_SYMBOL,
            "product_id": PRODUCT_ID,
            "bracket_stop_loss_price": result.get("bracket_stop_loss_price"),
            "bracket_take_profit_price": result.get("bracket_take_profit_price"),
        },
    }
    # refresh position
    psz = position_size()
    state["position"] = {"size": psz}
    save_delta_state(state)
    return {"ok": True, "skipped": False, "state": state, "raw": result}


def maybe_place_from_report(report: dict[str, Any]) -> dict[str, Any] | None:
    """If report has a new tv_ticket, place it on Delta demo. Returns placement result or None."""
    tickets = report.get("tv_ticket") or []
    if not tickets:
        return None
    if report.get("waiting_prev"):
        return None
    t = tickets[0]
    side = t.get("side") or "SHORT"
    return place_ticket(
        side=side,
        entry=float(t["price"]),
        stop_loss=float(t["stop_loss"]),
        take_profit=float(t["take_profit"]),
        qty_btc=float(t["units"]),
    )


def mark_flat(reason: str) -> None:
    st = load_delta_state()
    if not st:
        return
    st["updated_ist"] = ist_now().isoformat()
    st["status"] = "flat"
    st["position"] = {"size": 0}
    st["close_reason"] = reason
    save_delta_state(st)


def close_position_market() -> dict[str, Any]:
    """Reduce-only market close of BTCUSD demo position."""
    psz = position_size()
    if psz is None:
        return {"ok": False, "error": "position_unknown"}
    if psz == 0:
        mark_flat("already_flat")
        return {"ok": True, "skipped": True, "reason": "already_flat"}
    side = "buy" if psz < 0 else "sell"
    order = {
        "product_id": PRODUCT_ID,
        "product_symbol": PRODUCT_SYMBOL,
        "size": abs(int(psz)),
        "side": side,
        "order_type": "market_order",
        "reduce_only": True,
        "client_order_id": f"btc-paper-close-{int(time.time())}",
    }
    st, body = call("POST", "/v2/orders", body=order)
    if st == 200 and isinstance(body, dict) and body.get("success"):
        mark_flat("force_close")
        return {"ok": True, "raw": body.get("result")}
    return {"ok": False, "http": st, "error": body}


def sync_after_paper_grade(grade: str | None) -> None:
    """When paper Pass/Fail, flatten Delta demo if a leftover position remains."""
    if grade not in {"Pass", "Fail"}:
        return
    psz = position_size()
    if psz is None:
        return
    if psz == 0:
        mark_flat(f"paper_{grade}")
        return
    # Brackets can go missing; force-close so the cycle does not stack.
    close_position_market()
    mark_flat(f"paper_{grade}_force_close")
