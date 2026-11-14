# BTC Paper Trading Automation

Encodes the trading rules from the analysis chat and runs before India / UK / US cash-market opens (Asia/Calcutta).

## What it does

1. Pulls BTC/USD daily + hourly candles (Kraken public OHLC).
2. Builds levels (EMA20/50/200, session high/low, ATR).
3. Produces at most one preferred setup + optional opposite pending ($10k notional each).
4. Loads `data/orders_state.json` and **refuses to cancel/replace** working orders unless:
   - invalidation hit, or
   - the new signal is the same idea (refresh SL/TP only), or
   - `--force-replace` is passed.
5. Prints exact TradingView Paper ticket fields (side, limit, qty, SL, TP).

## Market schedule (IST)

| Session | Cash open (IST) | Bot run (IST) | Cron (UTC) |
| --- | --- | --- | --- |
| India | 09:15 | 09:00 | `0 3 * * 1-5` |
| UK | 13:30 | 13:00 | `30 7 * * 1-5` |
| US | 20:00 (EST) | 19:45 | `15 14 * * 1-5` |

Crypto trades 24/7; these windows catch liquidity around equity opens.

## Commands

```bash
# Analyze only
python3 btc-paper-bot/analyze.py

# Analyze + write proposed orders into state (does not touch TV)
python3 btc-paper-bot/analyze.py --session india --propose

# Mark that you manually placed TV paper orders matching the proposal
python3 btc-paper-bot/analyze.py --confirm-placed

# Show open tracked orders
python3 btc-paper-bot/analyze.py --status
```

## TradingView placement

TradingView Paper has no official order API from this environment. Placement is:

1. Bot prints the ticket.
2. Cloud Agent (or you) enters it on the Paper Order panel.
3. You run `--confirm-placed` or the agent updates `orders_state.json` after a successful UI fill.

Rules burned in from chat history are in `rules.py`.
