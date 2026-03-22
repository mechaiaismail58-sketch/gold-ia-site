export default function BacktestLoading() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="card rounded-3xl border border-white/10 p-6 sm:p-8">
        <div className="space-y-4">
          <div className="skeleton h-9 w-3/4 rounded-xl" />
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="skeleton h-4 w-2/3 rounded-lg" />
          <div className="flex gap-3 mt-2">
            <div className="skeleton h-6 w-28 rounded-2xl" />
            <div className="skeleton h-6 w-24 rounded-2xl" />
            <div className="skeleton h-6 w-24 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card rounded-3xl border border-white/10 p-5 space-y-3">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-8 w-16 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Performance chart */}
      <div className="card rounded-3xl border border-white/10 p-6">
        <div className="space-y-3 mb-5">
          <div className="skeleton h-4 w-36 rounded" />
          <div className="skeleton h-3 w-64 rounded" />
        </div>
        <div className="skeleton h-[320px] w-full rounded-2xl" />
      </div>

      {/* Table */}
      <div className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex justify-between">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-4 w-24 rounded" />
        </div>
        <div className="divide-y divide-white/[0.05]">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-6 py-4 flex gap-6">
              <div className="skeleton h-4 w-20 rounded" />
              <div className="skeleton h-4 flex-1 rounded" />
              <div className="skeleton h-4 w-16 rounded" />
              <div className="skeleton h-4 w-16 rounded" />
              <div className="skeleton h-4 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
