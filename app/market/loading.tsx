export default function MarketLoading() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="card rounded-3xl border border-white/10 p-6 sm:p-8">
        <div className="space-y-4">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-9 w-2/3 rounded-xl" />
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="skeleton h-4 w-4/5 rounded-lg" />
        </div>
      </div>

      {/* News feed skeleton */}
      <div className="rounded-3xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.028)" }}>
        <div className="border-b border-white/10 px-5 py-3 flex items-center justify-between">
          <div className="skeleton h-3 w-40 rounded" />
          <div className="skeleton h-6 w-16 rounded-lg" />
        </div>
        <div className="divide-y divide-white/[0.05]">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-3 flex gap-3">
              <div className="skeleton h-5 w-14 rounded-md shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-full rounded" />
                <div className="skeleton h-3.5 w-4/5 rounded" />
                <div className="skeleton h-3 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="rounded-3xl border border-white/10 overflow-hidden" style={{ background: "#07060b" }}>
        <div className="border-b border-white/10 px-4 py-3 flex gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="skeleton h-8 w-12 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-[420px] sm:h-[680px] w-full rounded-none" style={{ borderRadius: 0 }} />
      </div>
    </div>
  );
}
