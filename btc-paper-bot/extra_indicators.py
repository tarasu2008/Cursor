"""Python ports of useful BTC Pine frameworks (see indicators/*.pine)."""

from __future__ import annotations

from typing import Any


def sma(vals: list[float], n: int) -> list[float]:
    out: list[float] = []
    for i in range(len(vals)):
        w = vals[max(0, i + 1 - n) : i + 1]
        out.append(sum(w) / len(w))
    return out


def ema(vals: list[float], n: int) -> list[float]:
    if not vals:
        return []
    k = 2 / (n + 1)
    out = [vals[0]]
    for v in vals[1:]:
        out.append(v * k + out[-1] * (1 - k))
    return out


def rma(vals: list[float], n: int) -> list[float]:
    if not vals:
        return []
    out = [vals[0]]
    for i, v in enumerate(vals[1:], start=1):
        if i < n:
            out.append((out[-1] * i + v) / (i + 1))
        else:
            out.append((out[-1] * (n - 1) + v) / n)
    return out


def true_ranges(rows: list[dict]) -> list[float]:
    trs = [rows[0]["h"] - rows[0]["l"]]
    for i in range(1, len(rows)):
        trs.append(
            max(
                rows[i]["h"] - rows[i]["l"],
                abs(rows[i]["h"] - rows[i - 1]["c"]),
                abs(rows[i]["l"] - rows[i - 1]["c"]),
            )
        )
    return trs


def atr_series(rows: list[dict], n: int = 14) -> list[float]:
    return rma(true_ranges(rows), n)


def supertrend(rows: list[dict], factor: float = 3.0, atr_len: int = 10) -> dict[str, Any]:
    """TradingView-style Supertrend. dir<0 bull, dir>0 bear."""
    if len(rows) < atr_len + 2:
        return {"value": None, "bullish": False, "flip_bull": False, "flip_bear": False}
    atrs = atr_series(rows, atr_len)
    hl2 = [(r["h"] + r["l"]) / 2 for r in rows]
    upper: list[float] = []
    lower: list[float] = []
    st: list[float] = []
    direction: list[int] = []  # -1 bull, +1 bear

    for i in range(len(rows)):
        bu = hl2[i] + factor * atrs[i]
        bl = hl2[i] - factor * atrs[i]
        if i == 0:
            upper.append(bu)
            lower.append(bl)
            st.append(bu)
            direction.append(1)
            continue
        upper.append(bu if bu < upper[i - 1] or rows[i - 1]["c"] > upper[i - 1] else upper[i - 1])
        lower.append(bl if bl > lower[i - 1] or rows[i - 1]["c"] < lower[i - 1] else lower[i - 1])
        prev_dir = direction[i - 1]
        if prev_dir == 1:  # was bear / using upper
            if rows[i]["c"] > upper[i]:
                direction.append(-1)
                st.append(lower[i])
            else:
                direction.append(1)
                st.append(upper[i])
        else:
            if rows[i]["c"] < lower[i]:
                direction.append(1)
                st.append(upper[i])
            else:
                direction.append(-1)
                st.append(lower[i])

    bull = direction[-1] < 0
    flip_bull = direction[-2] > 0 and direction[-1] < 0
    flip_bear = direction[-2] < 0 and direction[-1] > 0
    return {
        "value": round(st[-1], 1),
        "bullish": bull,
        "flip_bull": flip_bull,
        "flip_bear": flip_bear,
    }


def adx(rows: list[dict], n: int = 14) -> dict[str, Any]:
    if len(rows) < n + 2:
        return {"adx": None, "plus_di": None, "minus_di": None, "trending": False}
    plus_dm: list[float] = [0.0]
    minus_dm: list[float] = [0.0]
    for i in range(1, len(rows)):
        up = rows[i]["h"] - rows[i - 1]["h"]
        down = rows[i - 1]["l"] - rows[i]["l"]
        plus_dm.append(up if up > down and up > 0 else 0.0)
        minus_dm.append(down if down > up and down > 0 else 0.0)
    tr = true_ranges(rows)
    atr = rma(tr, n)
    pdm = rma(plus_dm, n)
    mdm = rma(minus_dm, n)
    plus_di = [100 * (p / a if a else 0) for p, a in zip(pdm, atr)]
    minus_di = [100 * (m / a if a else 0) for m, a in zip(mdm, atr)]
    dx = []
    for p, m in zip(plus_di, minus_di):
        s = p + m
        dx.append(100 * abs(p - m) / s if s else 0.0)
    adx_s = rma(dx, n)
    val = adx_s[-1]
    return {
        "adx": round(val, 1),
        "plus_di": round(plus_di[-1], 1),
        "minus_di": round(minus_di[-1], 1),
        "trending": val >= 18.0,
    }


def q_trend_quality(closes: list[float], length: int = 20, smooth: int = 5) -> dict[str, Any]:
    if len(closes) < length + smooth + 1:
        return {"q": None, "strong": False, "choppy": True}
    raw: list[float] = []
    for i in range(length, len(closes)):
        signal = abs(closes[i] - closes[i - length])
        noise = sum(abs(closes[j] - closes[j - 1]) for j in range(i - length + 1, i + 1))
        raw.append(signal / noise if noise else 0.0)
    q_s = sma(raw, smooth)
    q = q_s[-1]
    return {"q": round(q, 3), "strong": q >= 0.7, "choppy": q < 0.45}


def cdc_action_zone(closes: list[float], fast: int = 12, slow: int = 26) -> dict[str, Any]:
    ef = ema(closes, fast)
    es = ema(closes, slow)
    bull = ef[-1] > es[-1]
    above_fast = closes[-1] > ef[-1]
    if bull and above_fast:
        zone = "strong_buy"
        score = 2
    elif bull:
        zone = "weak_buy"
        score = 1
    elif not above_fast:
        zone = "strong_sell"
        score = -2
    else:
        zone = "weak_sell"
        score = -1
    return {
        "zone": zone,
        "score": score,
        "ema_fast": round(ef[-1], 1),
        "ema_slow": round(es[-1], 1),
        "bull_cross": ef[-2] <= es[-2] and ef[-1] > es[-1],
        "bear_cross": ef[-2] >= es[-2] and ef[-1] < es[-1],
    }


def macd_sma200(closes: list[float]) -> dict[str, Any]:
    if len(closes) < 210:
        return {"above_sma200": False, "macd_hist": 0.0, "bull_impulse": False, "bear_impulse": False, "sma200": None}
    s200 = sma(closes, 200)
    e12 = ema(closes, 12)
    e26 = ema(closes, 26)
    macd_line = [a - b for a, b in zip(e12, e26)]
    signal = ema(macd_line, 9)
    hist = [m - s for m, s in zip(macd_line, signal)]
    above = closes[-1] > s200[-1]
    bull_cross = macd_line[-2] <= signal[-2] and macd_line[-1] > signal[-1]
    bear_cross = macd_line[-2] >= signal[-2] and macd_line[-1] < signal[-1]
    return {
        "sma200": round(s200[-1], 1),
        "above_sma200": above,
        "macd_hist": round(hist[-1], 1),
        "bull_impulse": bull_cross and above,
        "bear_impulse": bear_cross and not above,
    }


def multi_ema_suite(closes: list[float]) -> dict[str, Any]:
    ef, em, es, eM = ema(closes, 9), ema(closes, 21), ema(closes, 55), ema(closes, 200)
    aligned_bull = ef[-1] > em[-1] > es[-1] and closes[-1] > eM[-1]
    aligned_bear = ef[-1] < em[-1] < es[-1] and closes[-1] < eM[-1]
    return {
        "aligned_bull": aligned_bull,
        "aligned_bear": aligned_bear,
        "chop": not aligned_bull and not aligned_bear,
        "ema9": round(ef[-1], 1),
        "ema21": round(em[-1], 1),
        "ema55": round(es[-1], 1),
        "ema200": round(eM[-1], 1),
    }


def truemarket_mean(rows: list[dict], length: int = 100, atr_len: int = 14, mult: float = 1.5) -> dict[str, Any]:
    """VWMA mean ± ATR bands (proxy for TrueMarket Mean valuation zones)."""
    if len(rows) < length:
        return {"mean": None, "accum": False, "distrib": False}
    closes = [r["c"] for r in rows]
    vols = [max(r.get("v", 1.0), 1e-9) for r in rows]
    # VWMA
    mean_s: list[float] = []
    for i in range(len(rows)):
        w = closes[max(0, i + 1 - length) : i + 1]
        vv = vols[max(0, i + 1 - length) : i + 1]
        mean_s.append(sum(x * v for x, v in zip(w, vv)) / sum(vv))
    atr = atr_series(rows, atr_len)
    mean = mean_s[-1]
    upper = mean + mult * atr[-1]
    lower = mean - mult * atr[-1]
    px = closes[-1]
    return {
        "mean": round(mean, 1),
        "upper": round(upper, 1),
        "lower": round(lower, 1),
        "accum": px < lower,
        "distrib": px > upper,
    }


def ut_bot(rows: list[dict], key: float = 1.0, atr_len: int = 10) -> dict[str, Any]:
    """UT Bot ATR trailing stop (HPotter-style)."""
    if len(rows) < atr_len + 2:
        return {"trail": None, "bullish": False, "buy": False, "sell": False}
    atrs = atr_series(rows, atr_len)
    closes = [r["c"] for r in rows]
    trail: list[float] = []
    for i, c in enumerate(closes):
        n_loss = key * atrs[i]
        if i == 0:
            trail.append(c - n_loss)
            continue
        prev = trail[i - 1]
        if c > prev and closes[i - 1] > prev:
            trail.append(max(prev, c - n_loss))
        elif c < prev and closes[i - 1] < prev:
            trail.append(min(prev, c + n_loss))
        elif c > prev:
            trail.append(c - n_loss)
        else:
            trail.append(c + n_loss)
    bull = closes[-1] > trail[-1]
    buy = closes[-2] < trail[-2] and closes[-1] > trail[-1]
    sell = closes[-2] > trail[-2] and closes[-1] < trail[-1]
    return {
        "trail": round(trail[-1], 1),
        "bullish": bull,
        "buy": buy,
        "sell": sell,
    }


def ssl_channel(rows: list[dict], length: int = 10) -> dict[str, Any]:
    highs = [r["h"] for r in rows]
    lows = [r["l"] for r in rows]
    closes = [r["c"] for r in rows]
    if len(rows) < length + 2:
        return {"bullish": False, "bull_cross": False, "bear_cross": False, "ssl_up": None, "ssl_down": None}
    sma_h = sma(highs, length)
    sma_l = sma(lows, length)
    hlv = 0
    ssl_up: list[float] = []
    ssl_down: list[float] = []
    dirs: list[int] = []
    for i in range(len(rows)):
        if closes[i] > sma_h[i]:
            hlv = 1
        elif closes[i] < sma_l[i]:
            hlv = -1
        dirs.append(hlv)
        if hlv < 0:
            ssl_down.append(sma_h[i])
            ssl_up.append(sma_l[i])
        else:
            ssl_down.append(sma_l[i])
            ssl_up.append(sma_h[i])
    bull = dirs[-1] > 0
    bull_cross = dirs[-2] <= 0 and dirs[-1] > 0
    bear_cross = dirs[-2] >= 0 and dirs[-1] < 0
    return {
        "bullish": bull,
        "bull_cross": bull_cross,
        "bear_cross": bear_cross,
        "ssl_up": round(ssl_up[-1], 1),
        "ssl_down": round(ssl_down[-1], 1),
    }


def ut_ssl_combo(rows: list[dict]) -> dict[str, Any]:
    """UT Bot + SSL: only agree signals (reduces sideways over-trading)."""
    ut = ut_bot(rows)
    ssl = ssl_channel(rows)
    return {
        "ut": ut,
        "ssl": ssl,
        "long_sig": bool(ut.get("buy") and ssl.get("bullish")),
        "short_sig": bool(ut.get("sell") and not ssl.get("bullish")),
        "agree_bull": bool(ut.get("bullish") and ssl.get("bullish")),
        "agree_bear": bool((not ut.get("bullish")) and (not ssl.get("bullish"))),
    }


def tiered_targets(side: str, entry: float, atr: float) -> dict[str, float]:
    """Triple-confluence style tiered TPs (ATR). Primary paper TP remains fixed % in rules."""
    a = max(atr, 1.0)
    if side in {"sell", "short"}:
        return {
            "tp1": round(entry - 1.0 * a, 0),
            "tp2": round(entry - 2.0 * a, 0),
            "tp3": round(entry - 3.0 * a, 0),
            "atr_stop": round(entry + 1.0 * a, 0),
        }
    return {
        "tp1": round(entry + 1.0 * a, 0),
        "tp2": round(entry + 2.0 * a, 0),
        "tp3": round(entry + 3.0 * a, 0),
        "atr_stop": round(entry - 1.0 * a, 0),
    }


def suite(rows: list[dict], closes: list[float] | None = None) -> dict[str, Any]:
    closes = closes or [r["c"] for r in rows]
    return {
        "supertrend": supertrend(rows),
        "adx": adx(rows),
        "q": q_trend_quality(closes),
        "cdc": cdc_action_zone(closes),
        "macd_sma200": macd_sma200(closes),
        "ema_suite": multi_ema_suite(closes),
        "truemarket": truemarket_mean(rows),
        "ut_ssl": ut_ssl_combo(rows),
    }
