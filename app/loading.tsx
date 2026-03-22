export default function Loading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero skeleton */}
      <div className="card rounded-2xl sm:rounded-3xl border border-white/10 p-6 sm:p-8">
        <div className="space-y-4">
          <div className="skeleton h-8 w-3/4 rounded-xl" />
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="skeleton h-4 w-4/5 rounded-lg" />
          <div className="flex gap-3 mt-2">
            <div className="skeleton h-6 w-24 rounded-2xl" />
            <div className="skeleton h-6 w-20 rounded-2xl" />
            <div className="skeleton h-6 w-20 rounded-2xl" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="card rounded-2xl sm:rounded-3xl border border-white/10 p-6 sm:p-8">
        <div className="space-y-3">
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="skeleton h-4 w-5/6 rounded-lg" />
          <div className="skeleton h-4 w-4/5 rounded-lg" />
          <div className="skeleton h-4 w-3/4 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
