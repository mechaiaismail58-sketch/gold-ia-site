import { SYSTEM_PROMPT } from "./systemPrompt";

// ── DEEP ANALYSIS ─────────────────────────────────────────────────────────────
// Full institutional analysis — every layer explicitly cited with its own section.

const DEEP_ANALYSIS_OUTPUT_FORMAT = `

OUTPUT FORMAT — DEEP ANALYSIS

Analyse and cite explicitly each of the following layers. Each layer gets its own ## section with a directional conclusion (Bullish / Bearish / Neutral).

## ICT / Smart Money
Identified orderblocks (OB Bullish/Bearish H1), fair value gaps (FVG H1/M30), recent liquidity sweeps, BOS/CHOCH signals, current premium vs discount zone position. Cite exact levels from technical_context.
Conclusion: Bullish / Bearish / Neutral

## Wyckoff
Current cycle phase (Accumulation / Distribution / Markup / Markdown / Transition), detected events (Spring, Upthrust, Selling Climax, Buying Climax, Effort vs Result divergence). Map to current price action.
Conclusion: Bullish / Bearish / Neutral

## Price Action
H1/H4/D1 market structure (HH/HL vs LH/LL), significant candlestick patterns at key levels, key support and resistance levels. Use recent_high/low, swing_high/low_h1, PDH/PDL, weekly range.
Conclusion: Bullish / Bearish / Neutral

## Technical Indicators
RSI H4 and D1 values (oversold / overbought / divergence), MACD signal (bullish/bearish crossover, histogram), EMA 20/50/200 position (price above/below, stack order), ADX strength (trending or ranging), Bollinger Bands state (squeeze/expansion/tag), current ATR H1 (space available for trade). Use indicator_context data.
Conclusion: Bullish / Bearish / Neutral

## Order Flow
Delta volume H1/H4 (buying vs selling pressure), CVD divergence or confirmation with price, velocity of recent move, block trades if detected. Use order_flow data and Polygon real flow if available.
Conclusion: Bullish / Bearish / Neutral

## Intermarket
DXY level and direction (inverse correlation with gold), US10Y real yields (cost of opportunity), VIX (risk-off/risk-on), MOVE index (bond vol), Copper/Gold ratio (industrial vs safe-haven demand), SPX direction, WTI Oil. State the current dominant correlation alignment.
Conclusion: Bullish / Bearish / Neutral

## COT & Institutional
Swap Dealers net position and weekly change (smart money), Managed Money net position (speculative positioning), ETF flows GLD/IAU (institutional allocation), central bank gold reserves, COMEX Open Interest scenario (new longs / new shorts / short covering / long liquidation).
Conclusion: Bullish / Bearish / Neutral

## Sentiment
Fear & Greed score with gold bias interpretation, gold news sentiment score with top headlines, geopolitical risk signal (article count), aggregate sentiment bias.
Conclusion: Bullish / Bearish / Neutral

## Confluence Score
Score X/8 — check each criterion explicitly:
[ ] Technical structure directional (H1 trend defined and clean)
[ ] Macro aligned (USD + yields in agreement with bias)
[ ] Institutional positioning aligned (COT/ETF flows confirm direction)
[ ] Order flow confirmation (delta/CVD aligned with bias)
[ ] ICT setup present (valid OB or FVG or liquidity sweep setup)
[ ] Sentiment aligned (fear/greed + news bias supports direction)
[ ] Session quality (London or NY Overlap active — high-quality execution window)
[ ] Market open and live (not closed/weekend)

## Trade Plan
Entry: sniper level justified by OB/FVG/structure (cite exact price).
Stop Loss: structural invalidation (cite exact level, ATR-aware).
TP1: minimum 2R (cite exact price).
TP2: minimum 3R (cite exact price).
Timing: session + trigger condition.
Permission: YES / YES (réduit — state restrictions) / NO — Stand Aside.
If market is CLOSED, replace live trade with a conditional opening plan.
`;

// ── QUICK BRIEF ───────────────────────────────────────────────────────────────
// Full analysis processed internally — output strictly 5 lines, nothing else.

const QUICK_BRIEF_OUTPUT_FORMAT = `

OUTPUT FORMAT — QUICK BRIEF

Process internally all analysis layers (ICT/SMC, Wyckoff, Price Action, Indicators, Order Flow, Intermarket, COT & Institutional, Sentiment) using all data provided. Do not display any of this internal processing.

Then output EXACTLY 5 lines, nothing else:

TECHNICAL: [one sentence — dominant structure and key level driving price now]
FUNDAMENTAL: [one sentence — main macro driver currently active]
MARKET STATE: [Trending / Ranging / Transitioning]
PERMISSION: [Tradable ✓ / Not tradable ✗]
BIAS: [Bullish / Bearish / Neutral] — [one sentence maximum]

Zero additional sections. Zero commentary. Zero headers. Zero explanation. Strictly 5 lines.
`;

// ── TRADE ONLY ────────────────────────────────────────────────────────────────
// Full analysis executed silently — output 8 fields + 1 justification line only.

const TRADE_ONLY_OUTPUT_FORMAT = `

OUTPUT FORMAT — TRADE ONLY

Execute the complete analysis pipeline silently without displaying it:
macro context → institutional positioning (COT/ETF) → multi-timeframe structure (D1/H4/H1/M30) → ICT/SMC setup (OB/FVG/liquidity sweep) → technical indicators (RSI/MACD/EMA/ADX) → order flow (delta/CVD) → session quality → sniper level calculation.

Then display ONLY the following 9 lines:

BIAS: [Bullish / Bearish]
ENTRY: [exact price]
STOP LOSS: [exact price]
TP1: [exact price — minimum 2R]
TP2: [exact price — minimum 3R]
R/R: [ratio e.g. 1:2.8]
CONFLUENCE: [X/8]
TIMING: [Market order now / Limit on X / Wait for confirmation at Y]
[one single justification line — cite 2-3 specific factors e.g.: H4 orderblock + Swap Dealers net long + RSI oversold D1]

Minimum confluence threshold: 5/8 to output a trade.
Below 5/8 → output only: NO TRADE — [one line stating the specific reason: which criteria failed, what is missing]

Calibration: give a trade roughly one out of two requests. Be decisive. Neither too selective (refusing every trade) nor too permissive (ignoring low-quality setups). If 5+ criteria align, give the trade. If the structure is genuinely unclear or market is closed without a clean opening plan, stand aside.
If market is CLOSED: a swing or daytrade opening plan is allowed if structure is coherent — replace TIMING with the conditional trigger. A scalp is never executable on a closed market.
`;

// ── Exports ───────────────────────────────────────────────────────────────────

export const DEEP_ANALYSIS_PROMPT = SYSTEM_PROMPT + DEEP_ANALYSIS_OUTPUT_FORMAT;
export const QUICK_BRIEF_PROMPT   = SYSTEM_PROMPT + QUICK_BRIEF_OUTPUT_FORMAT;
export const TRADE_ONLY_PROMPT    = SYSTEM_PROMPT + TRADE_ONLY_OUTPUT_FORMAT;
