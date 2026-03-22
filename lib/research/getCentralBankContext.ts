// Central bank gold reserves — FRED aggregate + best-effort IMF key countries

import { getLatestFredValue } from "./getFredSeries";

export type CentralBankContext = {
  world_total_moz: number | null;      // million fine troy oz — FRED XAUTSAM
  world_total_tonnes: number | null;
  world_trend: "increasing" | "decreasing" | "stable" | null;
  world_prev_moz: number | null;
  imf_note: string;                    // descriptive note on key buyers
  summary: string;
};

// FRED XAUTSAM: World: Gold: Total Official Reserves (million fine troy oz, monthly)
// https://fred.stlouisfed.org/series/XAUTSAM
const MOZ_TO_TONNES = 31.1035; // 1 million troy oz = 31.1035 tonnes

async function fetchWorldGoldReserves(): Promise<{ current: number | null; prev: number | null } | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", "XAUTSAM");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "12"); // last 12 months

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } }); // 24h cache
    if (!res.ok) return null;
    const data = await res.json() as { observations?: Array<{ value: string }> };
    const valid = (data.observations ?? [])
      .map((o) => Number(o.value))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (valid.length < 1) return null;
    return { current: valid[0], prev: valid[1] ?? null };
  } catch {
    return null;
  }
}

// Best-effort: fetch China's gold reserves from FRED if available
// FRED doesn't have individual country central bank gold series in a simple way
// We derive the IMF note from well-known structural facts + latest context
function buildIMFNote(worldTrend: "increasing" | "decreasing" | "stable" | null): string {
  const structural = "Key buyers 2023-2024: China (PBoC — intermittent monthly purchases), India (RBI — diversification), Turkey, Poland, Czech Republic, Hungary. Structural shift from Western selling to EM buying post-2022 sanctions/USD weaponization.";

  if (worldTrend === "increasing") {
    return `${structural} Current trend: world CB gold holdings rising — sustained institutional bid supporting gold long-term.`;
  }
  if (worldTrend === "decreasing") {
    return `${structural} Current trend: world CB holdings declining — net selling cycle, reduces structural bid.`;
  }
  return structural;
}

export async function getCentralBankContext(): Promise<CentralBankContext | null> {
  const reserves = await fetchWorldGoldReserves();
  if (reserves == null || reserves.current == null) return null;

  const world_total_moz = reserves.current;
  const world_prev_moz = reserves.prev;
  const world_total_tonnes = world_total_moz * MOZ_TO_TONNES;

  let world_trend: CentralBankContext["world_trend"] = null;
  if (world_prev_moz != null) {
    const diff = world_total_moz - world_prev_moz;
    world_trend = diff > 0.5 ? "increasing" : diff < -0.5 ? "decreasing" : "stable";
  }

  const imf_note = buildIMFNote(world_trend);

  const parts: string[] = [];
  parts.push(`World CB gold: ${world_total_moz.toFixed(1)} Moz (~${world_total_tonnes.toFixed(0)}t)`);
  if (world_trend) {
    parts.push(
      world_trend === "increasing"
        ? "CB demand rising — long-term bullish structural bid"
        : world_trend === "decreasing"
        ? "CB net selling — reduces structural support"
        : "CB holdings stable"
    );
  }
  parts.push(`Key buyers: China, India, Turkey, EM central banks (structural diversification away from USD reserves)`);

  return {
    world_total_moz,
    world_total_tonnes,
    world_trend,
    world_prev_moz,
    imf_note,
    summary: parts.join(" | "),
  };
}

// Re-export for use in buildResearchContext
export { getLatestFredValue };
