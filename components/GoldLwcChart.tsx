"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type CandlestickData,
} from "lightweight-charts";

type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

const timeframes = [
  { label: "1m", value: "1min", outputsize: 5000, visible: 180 },
  { label: "5m", value: "5min", outputsize: 5000, visible: 220 },
  { label: "15m", value: "15min", outputsize: 5000, visible: 220 },
  { label: "30m", value: "30min", outputsize: 5000, visible: 220 },
  { label: "1H", value: "1h", outputsize: 5000, visible: 220 },
  { label: "4H", value: "4h", outputsize: 2000, visible: 180 },
  { label: "1D", value: "1day", outputsize: 1000, visible: 160 },
];

export default function GoldLwcChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState("");
  const [timeframe, setTimeframe] = useState("15min");
  // Signals the data-load effect that the chart is ready to receive data
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 1200,
      height: 720,
      layout: {
        background: { type: ColorType.Solid, color: "#07060b" },
        textColor: "#d1d5db",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 3,
        rightOffset: 12,
      },
      crosshair: {
        vertLine: { color: "rgba(139,92,246,0.40)" },
        horzLine: { color: "rgba(139,92,246,0.40)" },
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#8b5cf6",
      downColor: "#ffffff",
      borderUpColor: "#8b5cf6",
      borderDownColor: "#ffffff",
      wickUpColor: "#8b5cf6",
      wickDownColor: "#ffffff",
      priceLineColor: "#8b5cf6",
      lastValueVisible: true,
      priceLineVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    setChartReady(true);

    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth || 1200,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      setChartReady(false);
    };
  }, []);

  useEffect(() => {
    if (!chartReady) return;
    let cancelled = false;

    async function loadData() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        setStatus("loading");
        setErrorText("");

        const tf = timeframes.find((t) => t.value === timeframe);
        const outputsize = tf?.outputsize ?? 5000;
        const visibleBars = tf?.visible ?? 200;

        const res = await fetch(
          `/api/gold?interval=${timeframe}&outputsize=${outputsize}`,
          { cache: "no-store", signal: controller.signal }
        );

        clearTimeout(timeout);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || !Array.isArray(data)) {
          setStatus("error");
          const msg = data?.error ?? data?.details ?? JSON.stringify(data);
          setErrorText(typeof msg === "string" ? msg : "API error");
          return;
        }

        const validData: CandlestickData<UTCTimestamp>[] = data
          .map((c: any) => ({
            time: Math.floor(Number(c.time)) as UTCTimestamp,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }))
          .filter(
            (c) =>
              Number.isFinite(c.time) &&
              Number.isFinite(c.open) &&
              Number.isFinite(c.high) &&
              Number.isFinite(c.low) &&
              Number.isFinite(c.close)
          )
          .sort((a, b) => Number(a.time) - Number(b.time));

        if (validData.length === 0) {
          setStatus("error");
          setErrorText("No valid candles returned by /api/gold.");
          return;
        }

        seriesRef.current?.setData(validData);

        const from = Math.max(0, validData.length - visibleBars);
        const to = validData.length - 1;

        chartRef.current?.timeScale().setVisibleLogicalRange({
          from,
          to,
        });

        setStatus("ready");
      } catch (err) {
        clearTimeout(timeout);
        if (cancelled) return;
        setStatus("error");
        const msg = err instanceof Error ? err.message : String(err);
        setErrorText(
          msg.includes("aborted") || msg.includes("abort")
            ? "Request timed out — check TWELVE_DATA_API_KEY"
            : msg
        );
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [timeframe, chartReady]);

  return (
    <div className="w-full">
      <div className="border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {timeframes.map((tf) => {
            const active = timeframe === tf.value;
            return (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={
                  active
                    ? "rounded-xl border border-[rgba(109,40,217,0.65)] bg-[rgba(109,40,217,0.14)] px-3 py-2 text-xs uppercase tracking-[0.08em] text-white"
                    : "rounded-xl border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.08em] text-white/70 transition hover:border-white/20 hover:text-white"
                }
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative h-[720px] w-full">
        <div ref={containerRef} className="h-[720px] w-full" />

        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#07060b]/65 text-sm text-white/70">
            Loading XAUUSD market data...
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07060b]/85 px-6 text-center">
            <div className="text-lg text-white">Chart failed to load</div>
            <div className="mt-3 max-w-3xl break-all text-sm text-red-300">
              {errorText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}