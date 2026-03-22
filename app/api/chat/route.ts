import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { GOLDEN_EXAMPLES } from "@/lib/goldenExamples";
import { STYLE_MEMORY } from "@/lib/styleMemory";
import { buildResearchContext } from "@/lib/research/buildResearchContext";
import { getTradeMemory } from "@/lib/research/getTradeMemory";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// ── Clean context text builder — strips nulls, outputs readable text ──────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCleanContextText(ctx: any): string {
  const lines: string[] = [];
  const fmt = (n: number | null | undefined, d = 2) =>
    n != null ? n.toFixed(d) : null;

  // Market Status
  const mc = ctx.market_context;
  if (mc) {
    lines.push(`MARKET STATUS
Status: ${mc.market_status} | Session: ${mc.active_session} | Liquidity: ${mc.session_liquidity}
${mc.session_characteristics}${mc.next_open_utc ? `\nNext open: ${mc.next_open_utc}` : ""}
${mc.next_open_note}`);
  }

  // Price Data — only non-null values
  const pc = ctx.price_context;
  if (pc) {
    const priceLines: string[] = [];
    if (pc.xauusd != null) priceLines.push(`XAUUSD: ${fmt(pc.xauusd)}`);
    if (pc.gc_f != null) priceLines.push(`GC=F: ${fmt(pc.gc_f)}`);
    if (pc.gld != null) priceLines.push(`GLD: ${fmt(pc.gld)}`);
    if (pc.dxy != null) priceLines.push(`DXY: ${fmt(pc.dxy)}`);
    if (priceLines.length > 0) {
      lines.push(`\nPRICE DATA\n${priceLines.join(" | ")}`);
    }
  }

  // Macro Data — only non-null values
  const mc2 = ctx.macro_context;
  const ms = ctx.macro_state;
  if (mc2 || ms) {
    const macroLines: string[] = [];
    if (mc2?.us10y != null) macroLines.push(`US10Y: ${fmt(mc2.us10y)}% (${mc2.us10y_direction ?? "—"})`);
    if (mc2?.real_yield_10y != null) macroLines.push(`Real Yield 10Y: ${fmt(mc2.real_yield_10y)}% (${mc2.real_yield_direction ?? "—"})`);
    if (mc2?.us2y != null) macroLines.push(`US2Y: ${fmt(mc2.us2y)}%`);
    if (mc2?.breakeven_10y != null) macroLines.push(`Breakeven 10Y: ${fmt(mc2.breakeven_10y)}%`);
    if (mc2?.yield_curve_spread != null) macroLines.push(`Yield Curve Spread (10Y-2Y): ${fmt(mc2.yield_curve_spread)}%`);
    if (ms?.gold_pressure && ms.gold_pressure !== "Data not found") macroLines.push(`Gold Pressure: ${ms.gold_pressure}`);
    if (ms?.dominant_driver && ms.dominant_driver !== "Donnée non trouvée") macroLines.push(`Dominant Driver: ${ms.dominant_driver}`);
    if (ms?.usd_strength && ms.usd_strength !== "Data not found") macroLines.push(`USD: ${ms.usd_strength}`);
    if (ms?.yields_trend && ms.yields_trend !== "Data not found") macroLines.push(`Yields: ${ms.yields_trend}`);
    if (ms?.yield_curve_note && ms.yield_curve_note !== "Data not found") macroLines.push(`Yield Curve: ${ms.yield_curve_note}`);
    if (ms?.breakeven_note && ms.breakeven_note !== "Data not found") macroLines.push(`Breakeven: ${ms.breakeven_note}`);
    if (ms?.us2y_level && ms.us2y_level !== "Data not found") macroLines.push(`US2Y Level: ${ms.us2y_level}`);
    if (macroLines.length > 0) {
      lines.push(`\nMACRO DATA\n${macroLines.join("\n")}`);
    }
  }

  // Technical Data — only non-null values
  const tc = ctx.technical_context;
  const ts = ctx.technical_state;
  if (tc) {
    const techLines: string[] = [];
    if (tc.current_price != null) techLines.push(`Current Price: ${fmt(tc.current_price)}`);
    if (tc.h1_trend && tc.h1_trend !== "Data not found") techLines.push(`H1 Trend: ${tc.h1_trend}`);
    if (tc.m30_structure && tc.m30_structure !== "Data not found") techLines.push(`M30 Structure: ${tc.m30_structure}`);
    if (tc.short_term_regime && tc.short_term_regime !== "Data not found") techLines.push(`Short-term Regime: ${tc.short_term_regime}`);
    if (tc.range_position_pct != null) techLines.push(`Range Position: ${tc.range_position_pct.toFixed(0)}%`);
    if (tc.price_change_24h_pct != null) techLines.push(`24h Change: ${tc.price_change_24h_pct.toFixed(2)}%`);
    if (tc.intraday_high != null && tc.intraday_low != null) techLines.push(`Intraday Range: ${fmt(tc.intraday_low)} – ${fmt(tc.intraday_high)}`);
    if (tc.recent_high != null && tc.recent_low != null) techLines.push(`Recent Range (24h): ${fmt(tc.recent_low)} – ${fmt(tc.recent_high)}`);
    if (tc.weekly_high != null && tc.weekly_low != null) techLines.push(`Weekly Range: ${fmt(tc.weekly_low)} – ${fmt(tc.weekly_high)}`);
    if (tc.prev_day_high != null) techLines.push(`PDH: ${fmt(tc.prev_day_high)}`);
    if (tc.prev_day_low != null) techLines.push(`PDL: ${fmt(tc.prev_day_low)}`);
    if (tc.swing_high_h1 != null) techLines.push(`Swing High H1: ${fmt(tc.swing_high_h1)}`);
    if (tc.swing_low_h1 != null) techLines.push(`Swing Low H1: ${fmt(tc.swing_low_h1)}`);
    if (tc.atr_h1 != null) techLines.push(`ATR H1: ${fmt(tc.atr_h1, 1)}`);
    if (tc.volatility_state && tc.volatility_state !== "Data not found") techLines.push(`Volatility: ${tc.volatility_state}`);
    if (tc.fvg_bullish_h1 != null) techLines.push(`FVG Bullish H1: ${fmt(tc.fvg_bullish_h1.low)} – ${fmt(tc.fvg_bullish_h1.high)}`);
    if (tc.fvg_bearish_h1 != null) techLines.push(`FVG Bearish H1: ${fmt(tc.fvg_bearish_h1.low)} – ${fmt(tc.fvg_bearish_h1.high)}`);
    if (tc.fvg_bullish_m30 != null) techLines.push(`FVG Bullish M30: ${fmt(tc.fvg_bullish_m30.low)} – ${fmt(tc.fvg_bullish_m30.high)}`);
    if (tc.fvg_bearish_m30 != null) techLines.push(`FVG Bearish M30: ${fmt(tc.fvg_bearish_m30.low)} – ${fmt(tc.fvg_bearish_m30.high)}`);
    if (tc.orderblock_bullish_h1 != null) techLines.push(`OB Bullish H1: ${fmt(tc.orderblock_bullish_h1.low)} – ${fmt(tc.orderblock_bullish_h1.high)}`);
    if (tc.orderblock_bearish_h1 != null) techLines.push(`OB Bearish H1: ${fmt(tc.orderblock_bearish_h1.low)} – ${fmt(tc.orderblock_bearish_h1.high)}`);
    if (tc.liquidity_above != null) techLines.push(`Liquidity Above: ${fmt(tc.liquidity_above)}`);
    if (tc.liquidity_below != null) techLines.push(`Liquidity Below: ${fmt(tc.liquidity_below)}`);
    if (tc.momentum_5_bars_pct != null) techLines.push(`Momentum 5 bars: ${tc.momentum_5_bars_pct.toFixed(3)}%`);
    if (ts?.bias && ts.bias !== "Data not found") techLines.push(`Technical Bias: ${ts.bias} (${ts.condition})`);
    if (techLines.length > 0) {
      lines.push(`\nTECHNICAL DATA\n${techLines.join("\n")}`);
    }
  }

  // Alpha Vantage indicators (primary source if available)
  const av = ctx.av_context;
  if (av?.summary) {
    lines.push(`\nALPHA VANTAGE INDICATORS\n${av.summary}`);
  }

  // Polygon real order flow
  const pof = ctx.polygon_order_flow;
  if (pof?.summary) {
    lines.push(`\nREAL ORDER FLOW (Polygon)\n${pof.summary}`);
  }

  // Sentiment & geopolitical
  const sc = ctx.sentiment_context;
  if (sc) {
    const sentLines: string[] = [];
    if (sc.fear_greed_score != null && sc.fear_greed_label) {
      sentLines.push(`Fear & Greed: ${sc.fear_greed_score}/100 (${sc.fear_greed_label}) — gold bias: ${sc.fear_greed_gold_bias ?? "—"}`);
    }
    if (sc.news_sentiment_score != null && sc.news_headlines.length > 0) {
      const label = sc.news_sentiment_score > 0.3 ? "bullish gold" : sc.news_sentiment_score < -0.3 ? "bearish gold" : "neutral";
      sentLines.push(`News sentiment: ${label} | Headlines: ${sc.news_headlines.slice(0, 3).join(" / ")}`);
    }
    if (sc.geopolitical_articles != null) {
      sentLines.push(`Geopolitical signal: ${sc.geopolitical_articles} gold/safe-haven articles in last 4h${sc.geopolitical_articles >= 5 ? " — elevated tension" : ""}`);
    }
    if (sc.gold_bias) sentLines.push(`Aggregate sentiment bias: ${sc.gold_bias}`);
    if (sentLines.length > 0) lines.push(`\nSENTIMENT & GEOPOLITICAL\n${sentLines.join("\n")}`);
  }

  // Extended intermarket (VIX, MOVE, Copper, Oil)
  const yf = ctx.yahoo_finance;
  if (yf) {
    const yfLines: string[] = [];
    if (yf.vix != null) yfLines.push(`VIX: ${yf.vix.toFixed(1)}${yf.vix > 25 ? " — risk-off" : yf.vix < 15 ? " — low fear" : ""}`);
    if (yf.move_index != null) yfLines.push(`MOVE: ${yf.move_index.toFixed(0)}${yf.move_index > 100 ? " — bond vol elevated" : ""}`);
    if (yf.copper_gold_ratio != null) {
      const cgNote = yf.copper_gold_ratio > 0.25 ? "risk-on" : yf.copper_gold_ratio < 0.15 ? "risk-off" : "neutral";
      yfLines.push(`Copper/Gold ratio: ${yf.copper_gold_ratio.toFixed(3)} — ${cgNote}`);
    }
    if (yf.oil_wti != null) yfLines.push(`WTI Oil: $${yf.oil_wti.toFixed(1)}`);
    if (yf.dxy_yahoo != null && ctx.price_context?.dxy == null) yfLines.push(`DXY (Yahoo fallback): ${yf.dxy_yahoo.toFixed(2)}`);
    if (yf.risk_sentiment) yfLines.push(`Risk sentiment composite: ${yf.risk_sentiment.replace(/_/g, " ")}`);
    if (yfLines.length > 0) lines.push(`\nEXTENDED INTERMARKET\n${yfLines.join("\n")}`);
  }

  // Fed Watch / policy context
  const fw = ctx.fed_watch;
  if (fw?.summary) {
    const fwLines: string[] = [fw.summary];
    if (fw.liquidity_note) fwLines.push(fw.liquidity_note);
    lines.push(`\nFED POLICY CONTEXT\n${fwLines.join("\n")}`);
  }

  // SOFR liquidity signal
  if (ctx.sofr != null) {
    lines.push(`\nSOFR: ${ctx.sofr.toFixed(2)}% (short-term dollar liquidity rate)`);
  }

  // ETF institutional flows with trend
  const etf = ctx.etf_flows;
  if (etf) {
    const etfLines: string[] = [];
    if (etf.summary) etfLines.push(etf.summary);
    if (etf.gld_5d_flow_signal && etf.gld_5d_flow_signal !== "neutral") {
      etfLines.push(`5d flow: ${etf.gld_5d_flow_signal.replace(/_/g, " ")}${etf.gld_price_5d_pct != null ? ` (GLD ${etf.gld_price_5d_pct > 0 ? "+" : ""}${etf.gld_price_5d_pct.toFixed(1)}%)` : ""}`);
    }
    if (etf.gld_20d_flow_signal && etf.gld_20d_flow_signal !== "neutral") {
      etfLines.push(`20d flow: ${etf.gld_20d_flow_signal.replace(/_/g, " ")}${etf.gld_price_20d_pct != null ? ` (GLD ${etf.gld_price_20d_pct > 0 ? "+" : ""}${etf.gld_price_20d_pct.toFixed(1)}%)` : ""}`);
    }
    if (etfLines.length > 0) lines.push(`\nETF INSTITUTIONAL FLOWS\n${etfLines.join("\n")}`);
  }

  // Disaggregated COT — banks and hedge funds
  const cot = ctx.cot_context;
  if (cot) {
    const cotLines: string[] = [];
    if (cot.disagg_summary) cotLines.push(cot.disagg_summary);
    if (cot.managed_money_net != null) {
      const mmSignal = cot.managed_money_signal ?? "unknown";
      const mmChg = cot.managed_money_change != null ? ` | WoW: ${cot.managed_money_change > 0 ? "+" : ""}${Math.round(cot.managed_money_change / 1000)}k` : "";
      cotLines.push(`Hedge Funds (Managed Money): net ${Math.round(cot.managed_money_net / 1000)}k contracts (${mmSignal.replace(/_/g, " ")})${mmChg}`);
    }
    if (cot.swap_dealer_net != null) {
      const sdSignal = cot.swap_dealer_signal ?? "unknown";
      const sdChg = cot.swap_dealer_change != null ? ` | WoW: ${cot.swap_dealer_change > 0 ? "+" : ""}${Math.round(cot.swap_dealer_change / 1000)}k` : "";
      cotLines.push(`Banks (Swap Dealers): net ${Math.round(cot.swap_dealer_net / 1000)}k contracts (${sdSignal.replace(/_/g, " ")})${sdChg}`);
    }
    if (cot.producer_merchant_net != null) {
      cotLines.push(`Producers/Merchants: net ${Math.round(cot.producer_merchant_net / 1000)}k contracts`);
    }
    if (cotLines.length > 0) lines.push(`\nDISAGGREGATED COT (INSTITUTIONAL POSITIONING)\n${cotLines.join("\n")}`);
  }

  // COMEX Open Interest signal
  const ois = ctx.oi_signal;
  if (ois?.note) {
    lines.push(`\nCOMEX OPEN INTEREST\nOI: ${ois.oi != null ? Math.round(ois.oi / 1000) + "k contracts" : "n/a"} | Scenario: ${ois.scenario.replace(/_/g, " ")} — ${ois.note}`);
  }

  // Central bank gold reserves
  const cb = ctx.central_bank;
  if (cb?.summary) {
    lines.push(`\nCENTRAL BANK RESERVES\n${cb.summary}`);
  }

  // Validation metadata (compact)
  const vc = ctx.validation_context;
  if (vc) {
    lines.push(`\nDATA QUALITY
Completeness: ${vc.completeness} | Source: ${vc.source_consistency} | Timestamp: ${vc.timestamp_utc}`);
  }

  // Event/news instructions (always include — these are web search directives)
  if (ctx.event_context?.note) {
    lines.push(`\nEVENT CONTEXT\n${ctx.event_context.note}`);
  }
  if (ctx.news_context?.note) {
    lines.push(`\nNEWS CONTEXT\n${ctx.news_context.note}`);
  }

  return lines.filter(Boolean).join("\n");
}

type Mode =
  | "analysis"
  | "trade_request"
  | "market_question"
  | "identity"
  | "education";

type TradeHorizon = "scalp" | "daytrade" | "swing" | "unspecified";

function detectMode(message: string): Mode {
  const m = message.toLowerCase().trim();

  const identitySignals = [
    "tu es chat gpt",
    "are you chatgpt",
    "who are you",
    "qui es tu",
    "c'est qui",
    "what are you",
  ];

  const tradeSignals = [
    "donne un trade",
    "trade en",
    "position en",
    "setup",
    "entry",
    "sl",
    "tp",
    "swing",
    "scalp",
    "daytrade",
    "day trade",
    "day trading",
    "intraday",
    "intra day",
    "short",
    "long",
  ];

  const analysisSignals = [
    "analyse le gold",
    "analyse gold",
    "analyse xauusd",
    "analyse l'or",
    "analyse lor",
    "analyze gold",
    "analyze xauusd",
    "xauusd analysis",
    "gold analysis",
    "market analysis",
    "full analysis",
    "full xauusd analysis",
    "status board",
  ];

  const educationSignals = [
    "c'est quoi",
    "what is",
    "explique",
    "explain",
    "que veut dire",
    "ça veut dire quoi",
    "how does",
    "difference between",
    "différence entre",
  ];

  const marketQuestionSignals = [
    "pourquoi",
    "why",
    "comment",
    "how come",
    "what is driving",
    "driver",
    "volatilité",
    "volatility",
    "pourquoi ça bouge pas",
    "why is gold not moving",
    "pourquoi le gold",
    "why did gold",
    "qu'est-ce qui bloque",
    "what is blocking",
    "qu'est-ce qui pousse",
    "what is pushing",
    "pourquoi ya pas",
    "why is there no",
  ];

  if (identitySignals.some((s) => m.includes(s))) return "identity";
  if (tradeSignals.some((s) => m.includes(s))) return "trade_request";
  if (analysisSignals.some((s) => m.includes(s))) return "analysis";
  if (educationSignals.some((s) => m.includes(s))) return "education";
  if (marketQuestionSignals.some((s) => m.includes(s))) return "market_question";

  return "market_question";
}

function detectTradeHorizon(message: string): TradeHorizon {
  const m = message.toLowerCase().trim();

  const scalpSignals = [
    "scalp",
    "scalping",
    "m1",
    "m5",
    "m15",
    "ultra court terme",
    "very short term",
  ];

  const daytradeSignals = [
    "daytrade",
    "day trade",
    "day trading",
    "intraday",
    "intra day",
    "session trade",
    "today only",
    "aujourd'hui seulement",
  ];

  const swingSignals = [
    "swing",
    "swing trade",
    "swing trading",
    "court terme",
    "short-term swing",
    "multi-session",
    "2-3 jours",
    "plusieurs jours",
  ];

  if (scalpSignals.some((s) => m.includes(s))) return "scalp";
  if (daytradeSignals.some((s) => m.includes(s))) return "daytrade";
  if (swingSignals.some((s) => m.includes(s))) return "swing";

  return "unspecified";
}

async function fileToDataUrl(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const mimeType = file.type || "image/png";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function POST(req: Request) {
  try {
    // Initialise inside the handler so OPENAI_API_KEY is read at request time,
    // not at cold-start module initialisation where env vars may not be injected yet.
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    let userMessage = "";
    let previous_response_id: string | undefined;
    let chartImageDataUrl: string | null = null;
    let analysis_mode: "deep" | "quick" | "trade_only" = "deep";
    let session_id: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      userMessage = String(formData.get("userMessage") || "");
      previous_response_id = formData.get("previous_response_id")
        ? String(formData.get("previous_response_id"))
        : undefined;
      if (formData.get("analysis_mode") === "quick") analysis_mode = "quick";
      else if (formData.get("analysis_mode") === "trade_only") analysis_mode = "trade_only";
      if (formData.get("session_id")) session_id = String(formData.get("session_id"));

      const maybeFile = formData.get("chartImage");
      if (maybeFile instanceof File && maybeFile.size > 0) {
        chartImageDataUrl = await fileToDataUrl(maybeFile);
      }
    } else {
      const body = await req.json();
      userMessage = body.userMessage || "";
      previous_response_id = body.previous_response_id || undefined;
      if (body.analysis_mode === "quick") analysis_mode = "quick";
      else if (body.analysis_mode === "trade_only") analysis_mode = "trade_only";
    }

    if ((!userMessage || typeof userMessage !== "string") && !chartImageDataUrl) {
      return Response.json(
        { ok: false, error: "userMessage or chartImage is required" },
        { status: 400 }
      );
    }

    const mode = detectMode(userMessage || "analyse xauusd");
    const tradeHorizon = detectTradeHorizon(userMessage || "");

    // Fetch user profile for context injection
    const admin = createAdminClient();
    const dbClient = admin ?? supabase;
    const { data: userProfile } = await (dbClient as typeof supabase)
      .from("users")
      .select("trading_horizon, trading_style, account_size, experience_level, risk_profile")
      .eq("id", user.id)
      .single();

    const [researchContext, tradeMemory] = await Promise.all([
      buildResearchContext(),
      getTradeMemory(user.id, dbClient as typeof supabase),
    ]);

    const horizonInstructionMap: Record<TradeHorizon, string> = {
      scalp: `
TRADE HORIZON CONTEXT: SCALP

Rules:
- Focus on immediate execution quality only
- Require much stricter trigger quality than swing
- Prefer breakout confirmation, reclaim, or rejection with immediate structure
- Do not produce a broad multi-day plan
- If structure is compressive, unstable, or unclear intraday, prefer Stand Aside
- Targets and invalidation must be tight and execution-specific
- If market is CLOSED, do not simulate a live scalp; only say that no live scalp is executable
`,
      daytrade: `
TRADE HORIZON CONTEXT: DAYTRADE

Rules:
- Focus on same-session execution
- Require clear intraday structure and tradable asymmetry
- A daytrade can tolerate more room than a scalp, but less than a swing
- Prefer session-level continuation, pullback, reclaim, or breakdown logic
- If market is CLOSED, replace any live daytrade by a conditional opening/session plan only if structure supports it
`,
      swing: `
TRADE HORIZON CONTEXT: SWING

Rules:
- Focus on multi-session structure
- Use the broader technical map and macro alignment
- A swing setup can be allowed in degraded form if structure remains exploitable
- Prefer pullback continuation, breakdown confirmation, or structured opening plan
- If market is CLOSED, a conditional opening plan is allowed if the swing structure is still coherent
`,
      unspecified: `
TRADE HORIZON CONTEXT: UNSPECIFIED

Rules:
- Infer the most reasonable horizon from structure and user wording
- If the structure is too compressed for scalp but potentially valid for swing, say so explicitly
- Do not force the same execution logic across scalp, daytrade, and swing
`,
    };

    const modeInstructionMap = {
      identity: `
MODE: IDENTITY

INSTRUCTIONS:
- If the user asks about identity, answer exactly:
Bullion Desk — XAUUSD Macro-Technical Analysis Engine.
- No extra sentence.
`,
      analysis: `
MODE: ANALYSIS

INSTRUCTIONS:
- Use the full Bullion Desk framework
- Start with Market Status
- Then follow the exact section order required by the system prompt
- Do not collapse the response into a shorter market note
- Fundamental analysis must be highly developed
- Technical analysis must be highly developed
- Technical structure is mandatory even if partial
- If technical data is partial, state the limitation but still derive the available structure
- If a chart screenshot is attached, use it as a visual confirmation layer, not as a replacement for technical_context
- Use web search only to enrich the live macro/fundamental layer:
  news, event risk, Fed/inflation/yields context, weekend/opening context if relevant
- Do not use web search as a substitute for technical_context
`,
      trade_request: `
MODE: TRADE_REQUEST

INSTRUCTIONS:
- Use the full Bullion Desk framework
- Start with Market Status
- Keep the existing institutional structure
- A trade is allowed only if Permission = YES (full) or YES (réduit)
- If Permission = YES (réduit), state the restrictions clearly
- Technical structure is mandatory in the reasoning
- A trade plan must be anchored to technical_context, not macro only
- If a chart screenshot is attached, use it to refine technical interpretation and execution quality
- Use web search only to enrich live fundamental context, event risk, and opening conditions
- Never force a trade
- Prefer Stand Aside over a low-quality setup
- But do not refuse mechanically if the setup is degraded yet still technically exploitable
- Respect the requested trade horizon explicitly
`,
      market_question: `
MODE: MARKET_QUESTION

INSTRUCTIONS:
- Answer directly
- Keep the existing structure for market questions
- Focus on real drivers:
  1. USD
  2. Yields / Real yields
  3. Fed expectations
  4. Liquidity / positioning
  5. Current technical structure
- Technical context must still appear in the answer
- Include a short technical snapshot when data is available
- If a chart screenshot is attached, integrate visible structure from the screenshot into the analysis
- Use web search to enrich current macro/news/event context when useful
- Do not let web search replace technical_context
`,
      education: `
MODE: EDUCATION

INSTRUCTIONS:
- Explain clearly
- Institutional tone
- No markdown
- Link the concept to gold market behavior
- If useful, mention how the concept interacts with current technical structure
- Use web search only if current macro context materially improves the explanation
`,
    } as const;

    const modeInstruction = modeInstructionMap[mode];
    const horizonInstruction = horizonInstructionMap[tradeHorizon];

    // Fetch last 3 exchanges from this session for continuity context
    let conversationHistory = "";
    if (session_id) {
      try {
        const { data: prevExchanges } = await (dbClient as typeof supabase)
          .from("conversations")
          .select("message_user, message_ia")
          .eq("user_id", user.id)
          .eq("session_id", session_id)
          .order("created_at", { ascending: false })
          .limit(3);
        if (prevExchanges && prevExchanges.length > 0) {
          const lines = [...prevExchanges].reverse().map((ex) =>
            `User: ${ex.message_user.slice(0, 300)}\nAssistant: ${ex.message_ia.slice(0, 600)}`
          ).join("\n\n");
          conversationHistory = `CONVERSATION HISTORY (last ${prevExchanges.length} exchanges — use for continuity only)\n${lines}\n`;
        }
      } catch { /* non-critical */ }
    }

    // Build the system prompt suffix — subtle adaptation appended to SYSTEM_PROMPT.
    // Only constructed when at least one profile value is non-null/non-empty.
    let systemPromptSuffix = "";
    if (userProfile) {
      const parts: string[] = [];
      if (userProfile.trading_style)    parts.push(`trading style: ${userProfile.trading_style}`);
      if (userProfile.experience_level) parts.push(`experience: ${userProfile.experience_level}`);
      if (userProfile.account_size)     parts.push(`account size: ${userProfile.account_size}`);
      if (userProfile.risk_profile)     parts.push(`risk profile: ${userProfile.risk_profile}`);

      if (parts.length > 0) {
        systemPromptSuffix = `\n\nSubtle profile adaptation — do not change your response structure or format. Only adjust: vocabulary complexity based on experience level, position sizing examples based on account size, timeframe focus based on trading style, and risk emphasis based on risk profile. Keep the same sections, same depth, same layout as always.\n\nCurrent user — ${parts.join(", ")}.`;
      }
    }

    const finalUserInput = `
CONTEXTE PRODUIT

Bullion Desk est un decision engine institutionnel dédié à l'or.
Le rôle du modèle est d'appliquer le framework avec discipline, pas de chatter.

STYLE MEMORY
${STYLE_MEMORY}

GOLDEN EXAMPLES
${GOLDEN_EXAMPLES}

RESEARCH CONTEXT
${buildCleanContextText(researchContext)}

${researchContext.indicator_context ? `INDICATOR DATA
${researchContext.indicator_context.summary}
` : ""}${researchContext.indicator_context?.order_flow ? `ORDER FLOW DATA
${researchContext.indicator_context.order_flow.summary}
` : ""}${researchContext.cot_context ? `COT DATA
${researchContext.cot_context.summary}
` : ""}${researchContext.intermarket_context?.summary && researchContext.intermarket_context.summary !== "Intermarket data unavailable" ? `INTERMARKET DATA
${researchContext.intermarket_context.summary}
` : ""}${researchContext.indicator_context?.market_regime ? `MARKET REGIME
${researchContext.indicator_context.market_regime.summary}
Approach: ${researchContext.indicator_context.market_regime.approach}
` : ""}${researchContext.upcoming_events && researchContext.upcoming_events.events.length > 0 ? `UPCOMING HIGH-IMPACT EVENTS
${researchContext.upcoming_events.summary}
` : ""}${tradeMemory && tradeMemory.signals.length > 0 ? `PREVIOUS TRADE SIGNALS
${tradeMemory.summary}
` : ""}
${modeInstruction}

${horizonInstruction}

ANALYSIS_MODE: ${analysis_mode.toUpperCase()}

TASK

1. Utilise les données structurées comme source primaire.
2. Si une donnée n'est pas trouvée, écris exactement : "Donnée non trouvée".
3. Sépare strictement DATA / INTERPRÉTATIONS.
4. La technique doit être omniprésente dans tous les modes sauf IDENTITY.
5. Utilise explicitement technical_context partout où c'est pertinent.
6. Si USD et yields sont alignés, traite cela comme driver macro prioritaire.
7. L'interprétation doit refléter une vraie lecture de marché, pas une simple reformulation des faits.
8. Réponds dans la langue principale de l'utilisateur.
9. Ne réponds jamais comme un assistant généraliste.
10. Ne donne un trade que si l'environnement est réellement tradable et la structure techniquement exploitable.
11. Quand le marché est fermé, indique-le explicitement et, si pertinent, fournis un plan d'ouverture conditionnel au lieu d'un trade live.
12. Utilise le web search uniquement pour compléter la fondamentale vivante :
    - headlines récentes sur gold / USD / yields / Fed / inflation
    - event risk dans les prochaines 24 à 72 heures
    - éléments expliquant le contexte macro actuel
13. Ne pas utiliser le web search pour inventer ou remplacer :
    - les prix live internes
    - les niveaux techniques
    - les highs/lows structuraux
    - la structure H1/M30
14. Si une image de graphique est jointe, utilise-la pour lire :
    - structure visible
    - sweeps
    - compression
    - cassure / rejet
    - cohérence ou incohérence avec technical_context
15. L'image jointe est une couche visuelle complémentaire, pas une source primaire qui remplace les données marché.

${conversationHistory}DEMANDE UTILISATEUR
${userMessage || "Analyse le graphique joint et donne la lecture Bullion Desk."}
`.trim();

    const userContent: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "high" }
    > = [
      {
        type: "input_text",
        text: finalUserInput,
      },
    ];

    if (chartImageDataUrl) {
      userContent.push({
        type: "input_image",
        image_url: chartImageDataUrl,
        detail: "high",
      });
    }

    console.log(`[chat] mode=${mode} analysis_mode=${analysis_mode} horizon=${tradeHorizon} has_image=${Boolean(chartImageDataUrl)} has_prev_response=${Boolean(previous_response_id)}`);

    let response;
    try {
      response = await client.responses.create({
        model: "gpt-4o",
        previous_response_id,
        store: true,
        max_output_tokens: 3500,
        tools: [
          {
            type: "web_search_preview",
          },
        ],
        input: [
          {
            role: "system",
            content: SYSTEM_PROMPT + systemPromptSuffix,
          },
          {
            role: "user",
            content: userContent as any,
          },
        ],
      });
    } catch (openaiError: unknown) {
      // Log the full OpenAI error with all available fields for diagnosis
      console.error("[chat] OpenAI API error:", {
        message:    openaiError instanceof Error ? openaiError.message : String(openaiError),
        status:     (openaiError as any)?.status,
        code:       (openaiError as any)?.code,
        type:       (openaiError as any)?.type,
        param:      (openaiError as any)?.param,
        error:      (openaiError as any)?.error,
        headers:    (openaiError as any)?.headers,
        raw:        openaiError,
      });
      throw openaiError; // re-throw so the outer catch returns the 500
    }

    const outputText = response.output_text;
    if (!outputText) {
      console.warn("[chat] OpenAI returned empty output_text. Full response:", JSON.stringify(response, null, 2));
    }

    return Response.json({
      ok: true,
      text: outputText || "Donnée non trouvée",
      response_id: response.id,
      mode,
      trade_horizon: tradeHorizon,
      image_attached: Boolean(chartImageDataUrl),
    });
  } catch (error) {
    console.error("[chat] Handler error:", error instanceof Error ? error.message : String(error));

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}