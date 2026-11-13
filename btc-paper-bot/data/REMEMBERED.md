# Remembered user rules (BTC paper bot)

Locked in `rules.py`. Change only when the user explicitly asks.

## Always
1. Paper size **$1000** per trade.
2. Risk **1% Stop Loss / 2% Take Profit** until analysis is proven.
3. Say **LONG / SHORT** only (not Buy/Sell).
4. Notification title **Cursor alert** only.
5. Every alert includes **Time + Date (IST)**.
6. Before each new idea, recheck previous → **Pass or Fail only** (no partial).
7. Pass/Fail = TP or SL **price level** traded after signal (**fill not required**).
8. Save Pass/Fail + paper **$ PnL** for **today / week / month**.
9. **Every 30 min** timer must stay ON — checks BTC price + previous analysis/trade status.
10. If still Open → silent (no message). That is working, not broken.
11. **Alert** only when Pass/Fail; then **immediately analyze next order**.
12. While Open → do not stack a new trade; no "waiting" spam; no email/git/PR noise.
13. **One ticket only** at a time (never SHORT+LONG together).
14. Session timers (India/UK/US) optional; 30-min timer is required for Pass/Fail watching.
15. No mid-range chase; protect open orders; prefer supply shorts / confirmed breakdowns.
16. **Furry A & Furry B** (EMA 9/21): use cloud + cross in confluence (`indicators/furry_ab.pine`).
17. Use these frameworks for analysis progress (`indicators/*.pine` + `extra_indicators.py`):
    Triple Confluence (trend + ADX + ATR tiers), MACD+SMA200, UT Bot + SSL (agree-only),
    Q Trend Quality (signal/noise), Supertrend, CDC Action Zone, multi-EMA suite, TrueMarket mean.
18. **Cycle (locked):** analyze → if new LONG/SHORT ticket → **automatically bid on Delta DEMO**
    (`delta_demo.py`, keys `DELTA_API_KEY` / `DELTA_API_SECRET`) with same Entry / 1% SL / 2% TP.
    30-min watch → Pass/Fail Cursor alert → analyze next → bid again. Silent while Open.
    Demo only (`cdn-ind.testnet.deltaex.org`). Do not stack if Delta already has an open position.

## Manual
- `python3 btc-paper-bot/analyze.py --simple --show` → force current ticket view.
- `python3 btc-paper-bot/analyze.py --hourly` → silent unless Pass/Fail (+ next order + Delta bid).
- `python3 btc-paper-bot/analyze.py --performance` → ledger summary.
