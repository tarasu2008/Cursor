"""Furry A & Furry B — Python port of indicators/furry_ab.pine (default EMA 9/21)."""

from __future__ import annotations

from typing import Literal

from rules import FURRY_A_LEN, FURRY_B_LEN, FURRY_MA_TYPE


def _sma(vals: list[float], n: int) -> list[float]:
    out: list[float] = []
    for i in range(len(vals)):
        if i + 1 < n:
            out.append(sum(vals[: i + 1]) / (i + 1))
        else:
            out.append(sum(vals[i + 1 - n : i + 1]) / n)
    return out


def _ema(vals: list[float], n: int) -> list[float]:
    if not vals:
        return []
    k = 2 / (n + 1)
    out = [vals[0]]
    for v in vals[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def _rma(vals: list[float], n: int) -> list[float]:
    """TradingView RMA (Wilder)."""
    if not vals:
        return []
    out = [vals[0]]
    for i, v in enumerate(vals[1:], start=1):
        if i < n:
            out.append((out[-1] * i + v) / (i + 1))
        else:
            out.append((out[-1] * (n - 1) + v) / n)
    return out


def _wma(vals: list[float], n: int) -> list[float]:
    out: list[float] = []
    weights = list(range(1, n + 1))
    wsum = sum(weights)
    for i in range(len(vals)):
        window = vals[max(0, i + 1 - n) : i + 1]
        ww = weights[-len(window) :]
        out.append(sum(x * w for x, w in zip(window, ww)) / sum(ww))
    return out


def get_ma(vals: list[float], length: int, ma_type: str) -> list[float]:
    t = (ma_type or "EMA").upper()
    if t == "SMA":
        return _sma(vals, length)
    if t == "RMA":
        return _rma(vals, length)
    if t == "WMA":
        return _wma(vals, length)
    return _ema(vals, length)


def furry_state(
    closes: list[float],
    *,
    len_a: int = FURRY_A_LEN,
    len_b: int = FURRY_B_LEN,
    ma_type: str = FURRY_MA_TYPE,
) -> dict:
    """Return Furry A/B values, cloud bias, and latest cross signals."""
    a = get_ma(closes, len_a, ma_type)
    b = get_ma(closes, len_b, ma_type)
    if len(a) < 2 or len(b) < 2:
        return {
            "furry_a": None,
            "furry_b": None,
            "bullish_cloud": False,
            "bull_cross": False,
            "bear_cross": False,
        }
    bull_cross = a[-2] <= b[-2] and a[-1] > b[-1]
    bear_cross = a[-2] >= b[-2] and a[-1] < b[-1]
    return {
        "furry_a": round(a[-1], 1),
        "furry_b": round(b[-1], 1),
        "bullish_cloud": a[-1] > b[-1],
        "bull_cross": bull_cross,
        "bear_cross": bear_cross,
        "ma_type": ma_type,
        "len_a": len_a,
        "len_b": len_b,
    }
