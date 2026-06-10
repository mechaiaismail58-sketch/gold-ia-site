"use client";

export const dynamic = "force-dynamic";

export default function ChatMarketPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A]">
      <iframe
        src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_xauusd&symbol=OANDA%3AXAUUSD&interval=60&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=0&saveimage=1&toolbarbg=0A0A0A&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=1&locale=en"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        title="XAUUSD Live Chart"
        allowFullScreen
      />
    </div>
  );
}
