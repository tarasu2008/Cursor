# BTC Pine indicators used in analysis

Paste any `.pine` file into TradingView → Pine Editor → Add to chart.

| File | Role in bot |
| --- | --- |
| `furry_ab.pine` | Fast/slow MA cloud + cross confluence |
| `supertrend.pine` | Directional filter + flips |
| `triple_confluence_navigator.pine` | RSI MA + Supertrend + swings + ADX |
| `q_trend_quality.pine` | Signal/noise (Sepiashvili-style) — skip chop |
| `macd_sma200.pine` | Macro SMA200 + MACD impulse filter |
| `cdc_action_zone.pine` | EMA12/26 risk / momentum zones |
| `multi_ema_suite.pine` | 9/21/55/200 alignment vs chop |
| `truemarket_mean.pine` | VWMA±ATR accum/distrib proxy |
| `ut_bot.pine` | ATR trailing stop (violent BTC legs) |
| `ssl_channel.pine` | SSL channel bias |
| `ut_bot_ssl_combo.pine` | UT+SSL agree-only (cuts sideways over-trade) |

Python ports: `furry.py`, `extra_indicators.py` → feed `analyze.py` confluence.
Paper tickets still use **1% SL / 2% TP**; ATR tiered targets are attached as analysis `tiers`.
