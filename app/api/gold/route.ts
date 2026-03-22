export async function GET(req: Request) {
  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Missing TWELVE_DATA_API_KEY" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);

    const interval = searchParams.get("interval") || "15min";
    const outputsize = searchParams.get("outputsize") || "5000";

    const allowedIntervals = [
      "1min",
      "5min",
      "15min",
      "30min",
      "1h",
      "4h",
      "1day",
    ];

    if (!allowedIntervals.includes(interval)) {
      return Response.json(
        { error: `Unsupported interval: ${interval}` },
        { status: 400 }
      );
    }

    const cappedOutput = Math.min(Number(outputsize), 5000);

    const url =
      `https://api.twelvedata.com/time_series` +
      `?symbol=XAU/USD` +
      `&interval=${interval}` +
      `&outputsize=${cappedOutput}` +
      `&apikey=${apiKey}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!data || !Array.isArray(data.values)) {
      return Response.json(
        { error: "Invalid Twelve Data response", raw: data },
        { status: 500 }
      );
    }

    const candles = data.values
      .map((c: any) => ({
        time: Math.floor(new Date(c.datetime).getTime() / 1000),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
      }))
      .filter(
        (c: any) =>
          Number.isFinite(c.time) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
      )
      .reverse();

    return Response.json(candles);
  } catch (error) {
    return Response.json(
      {
        error: "Server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}