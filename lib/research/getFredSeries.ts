const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

type FredObservation = {
  date: string;
  value: string;
};

type FredResponse = {
  observations?: FredObservation[];
};

export type FredTrendResult = {
  current: number | null;
  previous: number | null;
  direction: "rising" | "falling" | "stable" | "Data not found";
};

export async function getLatestFredValue(seriesId: string): Promise<number | null> {
  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    console.error("Missing FRED_API_KEY");
    return null;
  }

  const url = new URL(FRED_BASE);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "10");

  const res = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 3600 }, // 1h cache — FRED data is daily
  });

  if (!res.ok) {
    console.error(`FRED request failed for ${seriesId}: ${res.status}`);
    return null;
  }

  const data = (await res.json()) as FredResponse;
  const observations = data.observations ?? [];

  for (const obs of observations) {
    if (obs.value !== "." && obs.value !== "") {
      const parsed = Number(obs.value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Fetches the two most recent valid observations for trend direction detection.
 * Returns current value, previous value, and derived direction.
 */
export async function getFredLatestTwo(seriesId: string): Promise<FredTrendResult> {
  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    return { current: null, previous: null, direction: "Data not found" };
  }

  const url = new URL(FRED_BASE);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "20");

  const res = await fetch(url.toString(), {
    method: "GET",
    next: { revalidate: 3600 }, // 1h cache — FRED data is daily
  });

  if (!res.ok) {
    console.error(`FRED request failed for ${seriesId}: ${res.status}`);
    return { current: null, previous: null, direction: "Data not found" };
  }

  const data = (await res.json()) as FredResponse;
  const valid: number[] = [];

  for (const obs of data.observations ?? []) {
    if (obs.value !== "." && obs.value !== "") {
      const n = Number(obs.value);
      if (Number.isFinite(n)) {
        valid.push(n);
        if (valid.length >= 2) break;
      }
    }
  }

  if (valid.length < 1) {
    return { current: null, previous: null, direction: "Data not found" };
  }

  if (valid.length < 2) {
    return { current: valid[0], previous: null, direction: "Data not found" };
  }

  const [current, previous] = valid;
  const diff = current - previous;
  // 0.02 threshold filters out noise from daily FRED rounding
  const direction: FredTrendResult["direction"] =
    diff > 0.02 ? "rising" : diff < -0.02 ? "falling" : "stable";

  return { current, previous, direction };
}
