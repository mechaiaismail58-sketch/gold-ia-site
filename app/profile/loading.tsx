export default function ProfileLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile hero */}
      <div className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,92,246,0.5)] to-transparent" />
        <div className="p-8 sm:p-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-5">
              <div className="skeleton h-[72px] w-[72px] rounded-full shrink-0" />
              <div className="space-y-2">
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-7 w-40 rounded-xl" />
                <div className="skeleton h-4 w-48 rounded" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="skeleton h-9 w-36 rounded-xl" />
              <div className="skeleton h-9 w-40 rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Trading horizon */}
      <div className="card rounded-3xl border border-white/10 p-8">
        <div className="skeleton h-3 w-24 rounded mb-2" />
        <div className="skeleton h-6 w-48 rounded-lg mb-5" />
        <div className="flex gap-3">
          <div className="skeleton h-10 w-20 rounded-xl" />
          <div className="skeleton h-10 w-24 rounded-xl" />
          <div className="skeleton h-10 w-20 rounded-xl" />
        </div>
      </div>

      {/* Push alerts */}
      <div className="card rounded-3xl border border-white/10 p-8">
        <div className="skeleton h-3 w-28 rounded mb-2" />
        <div className="skeleton h-6 w-44 rounded-lg mb-5" />
        <div className="flex gap-4">
          <div className="skeleton h-10 w-32 rounded-xl" />
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Analysis history */}
      <div className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="px-8 py-5 border-b border-white/[0.06] flex justify-between">
          <div className="space-y-1.5">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-5 w-28 rounded-lg" />
          </div>
          <div className="skeleton h-4 w-16 rounded" />
        </div>
        <div className="divide-y divide-white/[0.05]">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-6 sm:px-8 py-5 flex gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="skeleton h-3 w-28 rounded" />
                  <div className="skeleton h-4 w-14 rounded-full" />
                </div>
                <div className="skeleton h-4 w-24 rounded-full" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-4/5 rounded" />
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="skeleton h-8 w-14 rounded-lg" />
                <div className="skeleton h-8 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
