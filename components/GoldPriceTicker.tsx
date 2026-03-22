"use client";

import { useEffect, useRef } from "react";

export default function GoldPriceTicker() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      symbols: [
        {
          description: "Gold",
          proName: "OANDA:XAUUSD",
        },
      ],
      showSymbolLogo: false,
      isTransparent: true,
      displayMode: "regular",
      colorTheme: "dark",
      locale: "en",
    });

    container.current.appendChild(script);
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-transparent">
      <div className="tradingview-widget-container" ref={container}>
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}