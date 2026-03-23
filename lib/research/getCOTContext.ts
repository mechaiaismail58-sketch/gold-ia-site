// ── CFTC COT data for Gold — Legacy + Disaggregated (Managed Money, Swap Dealers) ──

// ─────────────────── Types ───────────────────

type CFTCLegacyRecord = {
  market_and_exchange_names?: string;
  report_date_as_yyyy_mm_dd?: string;
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
  comm_positions_long_all?: string;
  comm_positions_short_all?: string;
  nonrept_positions_long_all?: string;
  nonrept_positions_short_all?: string;
  open_interest_all?: string;
};

type CFTCDisaggRecord = {
  report_date_as_yyyy_mm_dd?: string;
  m_money_positions_long_all?: string;
  m_money_positions_short_all?: string;
  prod_merc_positions_long_all?: string;
  prod_merc_positions_short_all?: string;
  swap_positions_long_all?: string;
  swap__positions_short_all?: string; // double underscore — CFTC field quirk
  swap_positions_short_all?: string;  // fallback single underscore
  other_rept_positions_long_all?: string;
  other_rept_positions_short_all?: string;
  open_interest_all?: string;
};

export type COTContext = {
  // ── Legacy fields ──────────────────────────────────
  report_date: string | null;
  commercial_net: number | null;
  large_spec_net: number | null;
  small_spec_net: number | null;
  large_spec_change: number | null;
  commercial_change: number | null;
  large_spec_signal: "extreme_long" | "extreme_short" | "moderate_long" | "moderate_short" | "neutral" | null;
  commercial_signal: "extreme_long" | "extreme_short" | "moderate_long" | "moderate_short" | "neutral" | null;
  summary: string;

  // ── Disaggregated fields (banks, hedge funds) ──────
  managed_money_net: number | null;
  managed_money_long: number | null;
  managed_money_short: number | null;
  managed_money_change: number | null;
  managed_money_signal: "crowded_long" | "long" | "neutral" | "short" | "crowded_short" | null;
  swap_dealer_net: number | null;
  swap_dealer_long: number | null;
  swap_dealer_short: number | null;
  swap_dealer_change: number | null;
  swap_dealer_signal: "extreme_long" | "moderate_long" | "neutral" | "moderate_short" | "extreme_short" | null;
  producer_merchant_net: number | null;
  other_reportables_net: number | null;
  open_interest: number | null;
  open_interest_prev: number | null;
  oi_change: number | null;
  disagg_report_date: string | null;
  disagg_summary: string;
};

// ─────────────────── Helpers ─────────────────

const LEGACY_BASE  = "https://publicreporting.cftc.gov/resource/jun7-nznf.json";
const LEGACY_ALT   = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";  // alt dataset
const DISAGG_BASE  = "https://publicreporting.cftc.gov/resource/72hh-3qpy.json";

function toNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function netOf<T extends Record<string, string | undefined>>(
  r: T,
  longField: keyof T,
  shortField: keyof T
): number | null {
  const l = toNum(r[longField] as string | undefined);
  const s = toNum(r[shortField] as string | undefined);
  return l != null && s != null ? l - s : null;
}

function fmtK(n: number): string {
  return (n > 0 ? "+" : "") + (Math.round(n / 100) / 10).toFixed(1) + "k";
}

// ── Legacy signal classifiers ─────────────────────────────────────────────────
function classifyLargeSpec(net: number): COTContext["large_spec_signal"] {
  if (net > 200_000) return "extreme_long";
  if (net > 80_000) return "moderate_long";
  if (net > -20_000) return "neutral";
  if (net > -80_000) return "moderate_short";
  return "extreme_short";
}

function classifyCommercial(net: number): COTContext["commercial_signal"] {
  if (net > -80_000) return "extreme_long";
  if (net > -180_000) return "moderate_long";
  if (net > -280_000) return "neutral";
  if (net > -380_000) return "moderate_short";
  return "extreme_short";
}

// ── Disaggregated signal classifiers ─────────────────────────────────────────

// Managed Money (hedge funds): typical COMEX range -80k to +280k
function classifyManagedMoney(net: number): COTContext["managed_money_signal"] {
  if (net > 220_000) return "crowded_long";  // extreme crowding, reversal risk
  if (net > 80_000)  return "long";
  if (net > -30_000) return "neutral";
  if (net > -80_000) return "short";
  return "crowded_short";
}

// Swap Dealers (banks): can be long or short depending on OTC book
function classifySwapDealer(net: number): COTContext["swap_dealer_signal"] {
  if (net > 50_000)  return "extreme_long";   // banks net long = very bullish signal
  if (net > 10_000)  return "moderate_long";
  if (net > -10_000) return "neutral";
  if (net > -50_000) return "moderate_short";
  return "extreme_short";                      // banks max hedged = bearish signal
}

// ─────────────────── Legacy fetch ────────────────────────────────────────────

async function fetchLegacyCOT(): Promise<CFTCLegacyRecord[]> {
  const ENDPOINTS = [
    `${LEGACY_BASE}?$where=${encodeURIComponent("market_and_exchange_names like '%GOLD - COMMODITY EXCHANGE%'")}&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}&$limit=4`,
    `${LEGACY_BASE}?$where=${encodeURIComponent("market_and_exchange_names like '%GOLD%' AND cftc_commodity_code='088691'")}&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}&$limit=4`,
    `${LEGACY_BASE}?$where=${encodeURIComponent("cftc_commodity_code='088691'")}&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}&$limit=4`,
    `${LEGACY_ALT}?$where=${encodeURIComponent("cftc_commodity_code='088691'")}&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}&$limit=4`,
  ];

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 }, // 24h — COT is weekly data
      });
      if (!res.ok) {
        console.error(`fetchLegacyCOT: HTTP ${res.status} for ${url}`);
        continue;
      }
      const data: CFTCLegacyRecord[] = await res.json();
      if (data.length > 0) return data;
      console.warn(`fetchLegacyCOT: empty response from ${url}`);
    } catch (err) {
      console.error(`fetchLegacyCOT: fetch failed for ${url}:`, err);
      continue;
    }
  }
  return [];
}

// ─────────────────── Disaggregated fetch ─────────────────────────────────────

async function fetchDisaggCOT(): Promise<CFTCDisaggRecord[]> {
  // Disaggregated futures report (dataset 72hh-3qpy)
  const url = `${DISAGG_BASE}?$where=${encodeURIComponent("cftc_commodity_code='088691'")}&$order=${encodeURIComponent("report_date_as_yyyy_mm_dd DESC")}&$limit=4`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // 24h — COT is weekly data
    });
    if (!res.ok) {
      console.error(`fetchDisaggCOT: HTTP ${res.status} for ${url}`);
      return [];
    }
    const data: CFTCDisaggRecord[] = await res.json();
    if (!data.length) console.warn(`fetchDisaggCOT: empty response`);
    return data;
  } catch (err) {
    console.error(`fetchDisaggCOT: fetch failed:`, err);
    return [];
  }
}

// ─────────────────── Main export ─────────────────────────────────────────────

export async function getCOTContext(): Promise<COTContext | null> {
  const [legacyRecords, disaggRecords] = await Promise.all([
    fetchLegacyCOT(),
    fetchDisaggCOT(),
  ]);

  if (!legacyRecords.length && !disaggRecords.length) {
    console.error("getCOTContext: both legacy and disaggregated endpoints returned empty");
    return null;
  }

  // ── Parse legacy ──────────────────────────────────────────────────────────
  let report_date: string | null = null;
  let commercial_net: number | null = null;
  let large_spec_net: number | null = null;
  let small_spec_net: number | null = null;
  let large_spec_change: number | null = null;
  let commercial_change: number | null = null;
  let large_spec_signal: COTContext["large_spec_signal"] = null;
  let commercial_signal: COTContext["commercial_signal"] = null;
  let legacy_open_interest: number | null = null;
  let legacy_open_interest_prev: number | null = null;
  let summary = "";

  if (legacyRecords.length > 0) {
    const cur = legacyRecords[0];
    const prev = legacyRecords[1] ?? null;

    large_spec_net  = netOf(cur, "noncomm_positions_long_all", "noncomm_positions_short_all");
    commercial_net  = netOf(cur, "comm_positions_long_all", "comm_positions_short_all");
    small_spec_net  = netOf(cur, "nonrept_positions_long_all", "nonrept_positions_short_all");
    legacy_open_interest = toNum(cur.open_interest_all);

    if (prev) {
      const prevLS   = netOf(prev, "noncomm_positions_long_all", "noncomm_positions_short_all");
      const prevComm = netOf(prev, "comm_positions_long_all", "comm_positions_short_all");
      large_spec_change = large_spec_net != null && prevLS   != null ? large_spec_net - prevLS   : null;
      commercial_change = commercial_net != null && prevComm != null ? commercial_net - prevComm : null;
      legacy_open_interest_prev = toNum(prev.open_interest_all);
    }

    large_spec_signal = large_spec_net != null ? classifyLargeSpec(large_spec_net) : null;
    commercial_signal = commercial_net != null ? classifyCommercial(commercial_net) : null;

    const lsStr = large_spec_net != null
      ? `Large Specs ${fmtK(large_spec_net)}${large_spec_signal ? ` (${large_spec_signal.replace(/_/g, " ")})` : ""}${large_spec_change != null ? ` ${fmtK(large_spec_change)} WoW` : ""}`
      : "Large Specs: n/a";
    const commStr = commercial_net != null
      ? `Commercials ${fmtK(commercial_net)}${commercial_signal ? ` (${commercial_signal.replace(/_/g, " ")})` : ""}${commercial_change != null ? ` ${fmtK(commercial_change)} WoW` : ""}`
      : "Commercials: n/a";
    const smallStr = small_spec_net != null ? `Small Specs ${fmtK(small_spec_net)}` : "";
    report_date = cur.report_date_as_yyyy_mm_dd ?? null;
    summary = `COT Legacy (${report_date ?? "n/a"}): ${[lsStr, commStr, ...(smallStr ? [smallStr] : [])].join(" | ")}`;
  }

  // ── Parse disaggregated ───────────────────────────────────────────────────
  let managed_money_net: number | null = null;
  let managed_money_long: number | null = null;
  let managed_money_short: number | null = null;
  let managed_money_change: number | null = null;
  let managed_money_signal: COTContext["managed_money_signal"] = null;
  let swap_dealer_net: number | null = null;
  let swap_dealer_long: number | null = null;
  let swap_dealer_short: number | null = null;
  let swap_dealer_change: number | null = null;
  let swap_dealer_signal: COTContext["swap_dealer_signal"] = null;
  let producer_merchant_net: number | null = null;
  let other_reportables_net: number | null = null;
  let disagg_open_interest: number | null = null;
  let disagg_open_interest_prev: number | null = null;
  let disagg_report_date: string | null = null;
  let disagg_summary = "";

  if (disaggRecords.length > 0) {
    const cur = disaggRecords[0];
    const prev = disaggRecords[1] ?? null;

    managed_money_long  = toNum(cur.m_money_positions_long_all);
    managed_money_short = toNum(cur.m_money_positions_short_all);
    managed_money_net   = managed_money_long != null && managed_money_short != null
      ? managed_money_long - managed_money_short : null;

    swap_dealer_long  = toNum(cur.swap_positions_long_all);
    // Try double underscore first (CFTC quirk), then single
    swap_dealer_short = toNum(cur["swap__positions_short_all"]) ?? toNum(cur.swap_positions_short_all);
    swap_dealer_net   = swap_dealer_long != null && swap_dealer_short != null
      ? swap_dealer_long - swap_dealer_short : null;

    producer_merchant_net  = netOf(cur, "prod_merc_positions_long_all", "prod_merc_positions_short_all");
    other_reportables_net  = netOf(cur, "other_rept_positions_long_all", "other_rept_positions_short_all");
    disagg_open_interest   = toNum(cur.open_interest_all);
    disagg_report_date     = cur.report_date_as_yyyy_mm_dd ?? null;

    if (prev) {
      const prevMM = (() => {
        const pl = toNum(prev.m_money_positions_long_all);
        const ps = toNum(prev.m_money_positions_short_all);
        return pl != null && ps != null ? pl - ps : null;
      })();
      const prevSD = (() => {
        const pl = toNum(prev.swap_positions_long_all);
        const ps = toNum(prev["swap__positions_short_all"]) ?? toNum(prev.swap_positions_short_all);
        return pl != null && ps != null ? pl - ps : null;
      })();
      managed_money_change = managed_money_net != null && prevMM != null ? managed_money_net - prevMM : null;
      swap_dealer_change   = swap_dealer_net   != null && prevSD != null ? swap_dealer_net   - prevSD : null;
      disagg_open_interest_prev = toNum(prev.open_interest_all);
    }

    managed_money_signal = managed_money_net != null ? classifyManagedMoney(managed_money_net) : null;
    swap_dealer_signal   = swap_dealer_net   != null ? classifySwapDealer(swap_dealer_net)   : null;

    const mmStr = managed_money_net != null
      ? `Managed Money ${fmtK(managed_money_net)}${managed_money_signal ? ` (${managed_money_signal.replace(/_/g, " ")})` : ""}${managed_money_change != null ? ` ${fmtK(managed_money_change)} WoW` : ""}`
      : null;
    const sdStr = swap_dealer_net != null
      ? `Swap Dealers (banks) ${fmtK(swap_dealer_net)}${swap_dealer_signal ? ` (${swap_dealer_signal.replace(/_/g, " ")})` : ""}${swap_dealer_change != null ? ` ${fmtK(swap_dealer_change)} WoW` : ""}`
      : null;
    const pmStr = producer_merchant_net != null
      ? `Producers/Merchants ${fmtK(producer_merchant_net)}`
      : null;

    const parts = [mmStr, sdStr, pmStr].filter(Boolean);
    disagg_summary = parts.length > 0
      ? `COT Disaggregated (${disagg_report_date ?? "n/a"}): ${parts.join(" | ")}`
      : "";
  }

  // ── Resolve open interest (prefer disaggregated, fall back to legacy) ──────
  const open_interest      = disagg_open_interest      ?? legacy_open_interest;
  const open_interest_prev = disagg_open_interest_prev ?? legacy_open_interest_prev;
  const oi_change          = open_interest != null && open_interest_prev != null
    ? open_interest - open_interest_prev : null;

  return {
    report_date,
    commercial_net,
    large_spec_net,
    small_spec_net,
    large_spec_change,
    commercial_change,
    large_spec_signal,
    commercial_signal,
    summary,
    managed_money_net,
    managed_money_long,
    managed_money_short,
    managed_money_change,
    managed_money_signal,
    swap_dealer_net,
    swap_dealer_long,
    swap_dealer_short,
    swap_dealer_change,
    swap_dealer_signal,
    producer_merchant_net,
    other_reportables_net,
    open_interest,
    open_interest_prev,
    oi_change,
    disagg_report_date,
    disagg_summary,
  };
}
