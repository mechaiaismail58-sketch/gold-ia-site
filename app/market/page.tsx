import GoldTradingViewChart from "../../components/GoldTradingViewChart";
import NewsFeed from "../../components/NewsFeed";

export default function MarketPage() {
  return (
    <main>
      <section className="card rounded-3xl border border-white/10 p-6 shadow-[0_18px_80px_rgba(109,40,217,0.18)] sm:p-8">
        <div className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Live Market
          </p>

          <h1 className="text-[28px] leading-[1.1] tracking-[-0.02em] sm:text-[36px]">
            XAUUSD Execution Chart
          </h1>

          <p className="max-w-[70ch] leading-6 text-[color:var(--muted)]">
            Real-time gold chart integrated into Bullion Desk. Switch timeframe to inspect short-term execution and broader structure.
          </p>
        </div>
      </section>

      <div className="flex flex-col mt-6 sm:mt-8 gap-6 sm:gap-8">
        {/* Chart — first on mobile, second on desktop via order */}
        <section className="order-1 sm:order-2">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#07060b] shadow-[0_18px_90px_rgba(109,40,217,0.18)]">
            <GoldTradingViewChart />
          </div>
        </section>

        {/* News — second on mobile, first on desktop */}
        <section className="order-2 sm:order-1">
          <NewsFeed />
        </section>
      </div>
    </main>
  );
}
