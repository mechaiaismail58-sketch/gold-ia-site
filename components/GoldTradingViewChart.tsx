"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    TradingView: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

const INTERVALS: Array<{ label: string; tv: string }> = [
  { label: "1m",  tv: "1"   },
  { label: "5m",  tv: "5"   },
  { label: "15m", tv: "15"  },
  { label: "30m", tv: "30"  },
  { label: "1H",  tv: "60"  },
  { label: "4H",  tv: "240" },
  { label: "1D",  tv: "D"   },
];

const CONTAINER_ID = "bullion-tv-chart";

export default function GoldTradingViewChart() {
  const scriptRef  = useRef<HTMLScriptElement | null>(null);
  const widgetRef  = useRef<unknown>(null);
  const [interval, setInterval] = useState("15");

  function buildWidget(iv: string) {
    if (!window.TradingView) return;
    // Destroy previous iframe/widget if any
    const el = document.getElementById(CONTAINER_ID);
    if (el) el.innerHTML = "";

    const chartHeight = typeof window !== "undefined" && window.innerWidth < 640 ? 420 : 680;

    widgetRef.current = new window.TradingView.widget({
      container_id:       CONTAINER_ID,
      symbol:             "OANDA:XAUUSD",
      interval:           iv,
      timezone:           "Etc/UTC",
      theme:              "dark",
      style:              "1",           // candlestick
      locale:             "en",
      toolbar_bg:         "#0d0c14",
      enable_publishing:  false,
      allow_symbol_change: false,
      hide_side_toolbar:  false,
      withdateranges:     true,
      save_image:         false,
      height:             chartHeight,
      width:              "100%",
      backgroundColor:    "rgba(7,6,11,1)",
      gridColor:          "rgba(255,255,255,0.04)",
      no_referral_id:     true,
      disabled_features: ["volume_force_overlay", "create_volume_indicator_by_default"],
      studies_overrides: {
        "volume.volume.color.0":   "rgba(0,0,0,0)",
        "volume.volume.color.1":   "rgba(0,0,0,0)",
        "volume.volume ma.visible": false,
        "volume.show ma":           false,
      },
      overrides: {
        // Institutional candle palette
        "mainSeriesProperties.candleStyle.upColor":         "#4CAF89",
        "mainSeriesProperties.candleStyle.downColor":       "#F06449",
        "mainSeriesProperties.candleStyle.borderUpColor":   "#4CAF89",
        "mainSeriesProperties.candleStyle.borderDownColor": "#F06449",
        "mainSeriesProperties.candleStyle.wickUpColor":     "rgba(76, 175, 137, 0.6)",
        "mainSeriesProperties.candleStyle.wickDownColor":   "rgba(240, 100, 73, 0.6)",
        // Background & grid
        "paneProperties.background":                        "#07060b",
        "paneProperties.backgroundType":                    "solid",
        "paneProperties.vertGridProperties.color":          "rgba(255,255,255,0.04)",
        "paneProperties.horzGridProperties.color":          "rgba(255,255,255,0.04)",
        // Crosshair
        "paneProperties.crossHairProperties.color":         "rgba(139,92,246,0.5)",
      },
    });
  }

  // Load TradingView script once
  useEffect(() => {
    if (scriptRef.current) return;

    const script = document.createElement("script");
    script.src   = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => buildWidget(interval);
    scriptRef.current = script;
    document.body.appendChild(script);

    return () => {
      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        document.body.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild widget when interval changes (after script is loaded)
  useEffect(() => {
    if (window.TradingView) buildWidget(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  return (
    <div className="w-full">
      {/* Timeframe bar — same style as original chart */}
      <div className="border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {INTERVALS.map((tf) => {
            const active = interval === tf.tv;
            return (
              <button
                key={tf.tv}
                onClick={() => setInterval(tf.tv)}
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

      {/* TradingView chart */}
      <div id={CONTAINER_ID} className="h-[420px] sm:h-[680px]" />
    </div>
  );
}
