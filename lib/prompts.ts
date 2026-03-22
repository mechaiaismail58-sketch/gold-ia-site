import { SYSTEM_PROMPT } from "./systemPrompt";

// ── DEEP ANALYSIS ─────────────────────────────────────────────────────────────
// Full institutional analysis — every layer explicitly cited with its own section.

const DEEP_ANALYSIS_OUTPUT_FORMAT = `

OUTPUT FORMAT — DEEP ANALYSIS

Produce a full institutional analysis with each section below developed in depth. Every section must contain multiple detailed points, cite exact price levels from the data provided, and include argued explanations. Sections appear in this exact order.

## Market Structure
D1/H4/H1 trend direction, last HH/HL or LH/LL sequence, recent BOS/CHOCH with exact price, dominant structural bias. Position price within the macro range.

## Macro & Fundamental Context
Real yields (value + direction + gold implication), DXY level and pressure direction, FedWatch rate expectations, TGA balance if available, COT macro read, Fed narrative, dominant fundamental drivers and their current weight. Explain the causal link to gold behavior.

## ICT / Smart Money
Cite every level from the data provided. Minimum 4 bullet points:
- OB Bullish H1: state exact price range — is price currently respecting, approaching, or having broken through it? Argue what this implies for the next move.
- OB Bearish H1: same — is it acting as resistance? Has it been mitigated?
- FVG Bullish H1 and/or M30: exact range — is price trading into it now or is it a magnet above/below? Argue the fill probability.
- FVG Bearish H1 and/or M30: same treatment.
- Liquidity above (swing highs / weekly high): exact level — is there a sweep setup forming? Any signs of stop-hunt targeting that level?
- Liquidity below (swing lows / weekly low): same — accumulation below or real distribution?
- BOS/CHOCH: was there a recent break of structure or change of character? At what price? What does it confirm or contradict about the current bias?
- Premium/Discount zone: where is price relative to the H1 range midpoint? Trading premium = potential short setup zone. Trading discount = potential long setup zone. State the equilibrium price.
- Overall ICT read: what is the Composite Smart Money doing — accumulating quietly, distributing into retail longs, or running stops before continuation?

## Wyckoff
Map current price behavior to the Wyckoff model explicitly. Minimum 4 bullet points:
- Identify the current phase with justification: Accumulation (Phase A/B/C/D/E), Markup, Distribution, Markdown, or Transition — cite the price levels and time context that support this reading.
- Detect and name any Wyckoff events present: Preliminary Support (PS), Selling Climax (SC), Automatic Rally (AR), Secondary Test (ST), Spring, Last Point of Support (LPS), Sign of Strength (SOS) — or their distribution equivalents. Cite where each occurred.
- Effort vs Result: compare the volume behind recent moves with the price displacement. Heavy volume + small range = effort without result (exhaustion). Light volume + large range = ease of movement (genuine trend). State what you observe.
- Composite Man read: is the Composite Man appearing to absorb supply (bullish), distribute into retail buying (bearish), or unclear (neutral)?
- Contradictions: if the Wyckoff phase conflicts with ICT or momentum data, call it out and explain which signal carries more weight and why.

## Price Action
Multi-timeframe structural read with exact levels. Minimum 4 bullet points:
- D1 structure: last 3-5 candles — what sequence of HH/HL or LH/LL? Any daily close above/below a key level that changes the bias? Cite the pivotal levels.
- H4 structure: intermediate trend — is price in a trending leg, a corrective pullback, or a range? Where is the most recent H4 BOS?
- H1 structure: intraday granularity — what is the current short-term pattern? Compression before breakout, rejection at key level, or clean continuation?
- Key levels tested: PDH, PDL, weekly high, weekly low, recent_high, recent_low, swing_high_h1, swing_low_h1 — for each that was tested, did price reject or break through? Argue the implication.
- Candlestick patterns: name any significant patterns at key levels (pin bar, engulfing, inside bar, hammer, shooting star) — cite the price level and timeframe. State whether the pattern confirms or contradicts the directional bias.
- Contradictions across timeframes: if D1 is bullish but H1 is in a corrective bearish leg, state the conflict clearly and give the resolution logic.

## Technical Indicators
Cite every available numerical value. Minimum one bullet per indicator:
- RSI H4: exact value — is it above/below 50? Approaching 70 (overbought) or 30 (oversold)? Any bullish/bearish divergence with price?
- RSI D1: exact value — same analysis. Divergence on D1 carries more weight than H4 — flag it if present.
- MACD: is the histogram expanding or contracting? Most recent signal line crossover — bullish (MACD crossing above signal) or bearish? Does the histogram confirm price momentum or diverge?
- EMA 20/50/200: is price above or below each? What is the stack order (20 > 50 > 200 = strong bull stack)? Any EMA crossover recently or imminent?
- ADX: exact value if available — above 25 = trending (use trend-following logic), below 20 = ranging (use mean-reversion logic). Argue the regime implication.
- Bollinger Bands: squeeze (bands contracting = volatility compression = breakout imminent) or expansion? Is price tagging the upper/lower band? Argue what this implies for the next 2-4 candles.
- ATR H1: exact value — what does this mean for stop sizing? A stop tighter than 1× ATR will likely get hit by noise. State the minimum structural stop room implied.
- Contradictions: if RSI is oversold but MACD is still bearish, name the conflict and how to resolve it (wait for MACD crossover as confirmation trigger).

## Order Flow
Cite all available data. Minimum 4 bullet points:
- Delta volume H1: is buying delta dominating (buyers aggressive on upticks) or selling delta (sellers hitting bids)? Cite the signal from order_flow data. What does this say about current conviction?
- Delta volume H4: same at the intermediate timeframe. Alignment between H1 and H4 delta = conviction. Divergence = caution.
- CVD (Cumulative Volume Delta): is it trending with price (confirmation) or diverging (warning)? A rising price with falling CVD = distribution into strength. A falling price with rising CVD = absorption of selling.
- Velocity: is the most recent move fast (breakout/momentum) or slow and choppy (lack of conviction)? Argument for whether this supports or opposes the bias.
- Polygon real flow (if available): cite the summary — institutional vs retail flow imbalance, any significant block trades detected?
- Institutional synthesis: cross-reference order flow with COT positioning — are smart money flows in order flow data consistent with COT directional bias?

## COT & Institutional Positioning
Cite exact figures. Minimum 4 bullet points:
- Swap Dealers (banks) net position: exact contract count and weekly change — are they net long or net short? Trend of last 3-4 weeks? Banks are considered smart money — their direction carries high weight.
- Managed Money (hedge funds) net position: exact contract count — are funds crowded long or crowded short? A crowded long = vulnerability to short squeeze. A crowded short = fuel for short covering rally. State which scenario applies now.
- ETF flows GLD/IAU: 5-day and 20-day flow signal — institutional allocation increasing or decreasing? Combine with price action: rising price + inflows = strong; rising price + outflows = distribution.
- COMEX Open Interest scenario: state which of the 4 scenarios applies (new longs / new shorts / short covering / long liquidation) and argue what it means for the next directional move.
- Central bank activity: any recent buying or selling reported? Long-term structural bid or not?
- Contradictions: if Managed Money is extremely crowded long but price is stalling at resistance, flag the squeeze risk explicitly.

## Intermarket
DXY current correlation alignment with gold, US10Y real yields impact on gold opportunity cost, VIX state (risk-off/risk-on), MOVE index bond vol signal, Copper/Gold ratio read (industrial vs safe-haven demand), SPX direction and alignment, WTI if relevant.

## Sentiment
Fear & Greed score with directional gold bias interpretation, news sentiment score with top headlines, geopolitical risk signal (article count and tension level), contrarian read if applicable.

## Confluence Score
Score X/8 — each criterion explicitly checked:
[✓/✗] Macro aligned (USD + yields direction supports bias)
[✓/✗] Technical structure clear (H1 trend defined, no compression)
[✓/✗] Session favorable (London or NY Overlap active)
[✓/✗] Institutional positioning aligned (COT/ETF flows confirm direction)
[✓/✗] Order flow confirming (delta/CVD aligned with bias)
[✓/✗] Intermarket confirming (DXY/yields/VIX coherent)
[✓/✗] Clean entry level available (OB, FVG, or structural level identified)
[✓/✗] Path to TP1 clear (no major resistance/support blocking the move)

## Trade Plan
(This section appears only if Conclusion = TRADE ✓)
Entry: exact price and justification (OB/FVG/structure level).
Stop Loss: structural invalidation with exact level and ATR context.
TP1: exact price with R/R ratio.
TP2: exact price with R/R ratio.
Timing: session context and trigger condition.
Position sizing: adapted to user profile if available.
If market is CLOSED: replace live execution with a conditional opening plan (trigger, zone, invalidation).

## Risk Warnings
Macro events to monitor, invalidation levels, conditions that would flip the bias.

## What Matters Next
- [precise bullet — what to watch in the next 24h]
- [precise bullet — key level or event that changes the picture]
- [precise bullet — confirmation signal needed before acting]

---

## Conclusion
**TRADE ✓** or **NO TRADE ✗**

If TRADE ✓: 2-3 sentences summarizing why this trade is taken + Entry / SL / TP1 / TP2 restated clearly.
If NO TRADE ✗: one clear sentence explaining why conditions are not met and what to wait for.

The Conclusion section is mandatory in every Deep Analysis response without exception — it is always the last element displayed.
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

CRITICAL INSTRUCTION: You are in TRADE ONLY mode. You are FORBIDDEN from outputting ANY of the following: market status, environment analysis, model status board, scoring systems, data sections, technical structure sections, ICT analysis, Wyckoff analysis, price action sections, indicator sections, order flow sections, intermarket sections, COT sections, confluence breakdowns, scenarios, risk framework, conclusion paragraphs, or ANY explanatory text beyond one single justification line.

Execute the complete analysis pipeline internally and silently — do not display it:
macro context → institutional positioning (COT/ETF) → multi-timeframe structure (D1/H4/H1/M30) → ICT/SMC setup (OB/FVG/liquidity sweep) → technical indicators (RSI/MACD/EMA/ADX) → order flow (delta/CVD) → session quality → sniper level calculation.

Use all available data to calculate levels and the confluence score. All reasoning is internal and invisible. Only the output fields appear.

Your ENTIRE response must be ONLY these 9 lines and nothing else:

BIAS: [Bullish / Bearish]
ENTRY: [exact price]
STOP LOSS: [exact price]
TP1: [exact price]
TP2: [exact price]
R/R: [ratio]
CONFLUENCE: [X/8]
TIMING: [Market order now / Limit on X / Wait for confirmation]
[One single justification line — maximum 15 words]

If confluence score is below 5/8, your ENTIRE response must be ONLY:
NO TRADE — [one line reason, maximum 10 words]

Any output beyond these formats is a violation. No exceptions.

Calibration: give a trade roughly one out of two requests. Be decisive. If 5+ criteria align across macro, structure, ICT setup, order flow, and session — give the trade. If the structure is genuinely unclear or insufficient criteria align — NO TRADE.
If market is CLOSED: a swing or daytrade conditional opening plan is allowed — replace TIMING with the conditional trigger. A scalp is never executable on a closed market.
`;

// ── Exports ───────────────────────────────────────────────────────────────────

export const DEEP_ANALYSIS_PROMPT = SYSTEM_PROMPT + DEEP_ANALYSIS_OUTPUT_FORMAT;
export const QUICK_BRIEF_PROMPT   = SYSTEM_PROMPT + QUICK_BRIEF_OUTPUT_FORMAT;
export const TRADE_ONLY_PROMPT    = SYSTEM_PROMPT + TRADE_ONLY_OUTPUT_FORMAT;
