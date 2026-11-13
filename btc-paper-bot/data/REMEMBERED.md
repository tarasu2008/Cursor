# Remembered user rules (BTC paper bot)

Locked in `rules.py` + this file. Change only when the user explicitly asks.

## Always (full lock — everything so far)
1. Paper size **$1000** per trade.
2. Risk **1% Stop Loss / 2% Take Profit** until analysis is proven.
3. Say **LONG / SHORT** only (not Buy/Sell).
4. Notification title **Cursor alert** only (never “BTC alert”); no notification chatter.
5. Every alert includes **Time + Date (IST)** — `Time: dd Mon YYYY, hh:mm AM/PM IST`.
6. Before each new idea, recheck previous → **Pass or Fail only** (no partial / mixed).
7. Pass/Fail = TP or SL **price level** traded after signal (**fill not required**).
8. Save Pass/Fail + paper **$ PnL** for **today / week / month / all-time**.
9. Also show **Week Total Profit**, **Week Total Loss**, **Month Total Profit**, **Month Total Loss**.
10. **Every 30 min** timer ON — checks BTC price + previous analysis/trade status (`5,35 * * * *`).
11. If still Open → **STATUS:SILENT** (empty reply). No git/commit/push/PR/email.
12. **Alert** only when Pass/Fail (or new ticket while flat); then **immediately analyze next order**.
13. While Open → do not stack a new trade; one ticket only (never SHORT+LONG together).
14. Session timers (India/UK/US) optional; 30-min timer is required for Pass/Fail watching.
15. No mid-range chase; protect open orders; prefer supply shorts / confirmed breakdowns.
16. **Furry A & Furry B** (EMA 9/21) confluence (`indicators/furry_ab.pine` + `furry.py`).
17. Extra frameworks (`indicators/*.pine` + `extra_indicators.py`):
    Triple Confluence (trend + ADX + ATR tiers), MACD+SMA200, UT Bot + SSL (agree-only),
    Q Trend Quality, Supertrend, CDC Action Zone, multi-EMA suite, TrueMarket mean.
18. **Delta DEMO cycle (locked):**
    analyze → new LONG/SHORT → **auto-bid Delta DEMO** (`delta_demo.py`,
    `DELTA_API_KEY` / `DELTA_API_SECRET`) with same Entry / 1% SL / 2% TP on
    `cdn-ind.testnet.deltaex.org` (BTCUSD product_id 84, ~15 contracts for $1k).
    30-min watch → Pass/Fail → analyze next → bid again. Skip if Delta already open.
    Delta trading API needs whitelisted IPs; webhook is TradingView-only (not Cloud Agent).
19. FLAT alert = **no bid** (no Entry/SL/TP).
20. Lessons: no mid-range shorts into demand; don’t require fill to grade TP/SL;
    silent checks must not email; after close re-analyze immediately.

## Manual
- `python3 btc-paper-bot/analyze.py --simple --show` → force current ticket view.
- `python3 btc-paper-bot/analyze.py --hourly` → silent unless Pass/Fail or new ticket (+ Delta bid).
- `python3 btc-paper-bot/analyze.py --performance` → ledger summary (incl. total profit/loss).
