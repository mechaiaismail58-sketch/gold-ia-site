// Alpha Vantage — RSI + MACD for XAUUSD
// 2 calls per 6-hour cache window ≈ 8 calls/day — fits free tier (25/day)

export type AlphaVantageContext = {
  rsi_1h: number | null;
  macd_value: number | null;
  macd_signal_line: number | null;
  macd_histogram: number | null;
  macd_bias: "bullish" | "bearish" | "neutral" | null;
  summary: string;
};

const AV_BASE = "https://www.alphavantage.co/query";

async function fetchAVSeries(
  params: Record<string, string>
): Promise<Record<string, Record<string, string>> | null> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return null;

  const url = new URL(AV_BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 21600 } }); // 6h cache
    if (!res.ok) {
      console.warn(`Alpha Vantage ${params["function"]} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json() as Record<string, unknown>;
    if (typeof data["Note"] === "string" || typeof data["Information"] === "string") {
      console.warn("Alpha Vantage rate limit:", data["Note"] ?? data["Information"]);
      return null;
    }
    const dataKey = Object.keys(data).find((k) => k !== "Meta Data" && typeof data[k] === "object");
    if (!dataKey) return null;
    return data[dataKey] as Record<string, Record<string, string>>;
  } catch (err) {
    console.error("Alpha Vantage fetch error:", err);
    return null;
  }
}

function latestField(
  series: Record<string, Record<string, string>> | null,
  field: string
): number | null {
  if (!series) return null;
  const dates = Object.keys(series).sort().reverse();
  for (const d of dates.slice(0, 3)) {
    const val = Number(series[d][field]);
    if (Number.isFinite(val)) return val;
  }
  return null;
}

export async function getAlphaVantageContext(): Promise<AlphaVantageContext | null> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return null;

  const [rsiData, macdData] = await Promise.all([
    fetchAVSeries({
      function: "RSI",
      symbol: "XAUUSD",
      interval: "60min",
      time_period: "14",
      series_type: "close",
    }),
    fetchAVSeries({
      function: "MACD",
      symbol: "XAUUSD",
      interval: "60min",
      fastperiod: "12",
      slowperiod: "26",
      signalperiod: "9",
      series_type: "close",
    }),
  ]);

  const rsi_1h = latestField(rsiData, "RSI");
  const macd_value = latestField(macdData, "MACD");
  const macd_signal_line = latestField(macdData, "MACD_Signal");
  const macd_histogram = latestField(macdData, "MACD_Hist");

  if (rsi_1h == null && macd_value == null) return null;

  const macd_bias: AlphaVantageContext["macd_bias"] =
    macd_histogram != null
      ? macd_histogram > 0 ? "bullish" : macd_histogram < 0 ? "bearish" : "neutral"
      : null;

  const parts: string[] = [];
  if (rsi_1h != null) {
    const note = rsi_1h > 70 ? "overbought" : rsi_1h < 30 ? "oversold" : "neutral";
    parts.push(`RSI(14) H1: ${rsi_1h.toFixed(1)} (${note})`);
  }
  if (macd_value != null && macd_signal_line != null && macd_histogram != null) {
    parts.push(
      `MACD H1: ${macd_value.toFixed(2)} / Sig: ${macd_signal_line.toFixed(2)} / Hist: ${macd_histogram.toFixed(2)} (${macd_bias ?? "—"})`
    );
  }

  return {
    rsi_1h,
    macd_value,
    macd_signal_line,
    macd_histogram,
    macd_bias,
    summary: `[AV] ${parts.join(" | ")}`,
  };
}
