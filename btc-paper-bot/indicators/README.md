# BTC Pine indicators used in analysis

Paste any `.pine` file into TradingView → Pine Editor → Add to chart.

| File | Role in bot |
| --- | --- |
| `furry_ab.pine` | Fast/slow MA cloud + cross confluence |
| `supertrend.pine` | Directional filter + flips |
| `triple_confluence_navigator.pine` | RSI MA + Supertrend + swings + ADX |
| `q_trend_quality.pine` | Signal/noise — skip choppy markets |
| `macd_sma200.pine` | Macro SMA200 + MACD impulse |
| `cdc_action_zone.pine` | EMA12/26 risk / momentum zones |
| `multi_ema_suite.pine` | 9/21/55/200 alignment vs chop |
| `truemarket_mean.pine` | VWMA±ATR accum/distrib proxy |

Python ports live in `furry.py` and `extra_indicators.py` and feed `analyze.py` confluence.
