import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.12)] blur-[110px]" />
      </div>

      <div className="text-center max-w-sm">
        <div className="text-[96px] font-light leading-none text-white/[0.06] tracking-[-0.04em] select-none mb-6">
          404
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.05)] px-3 py-1 mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]/60" />
          <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-[rgba(212,175,55,0.7)]">Page not found</span>
        </div>

        <h1 className="text-[24px] tracking-[-0.02em] mb-3">This page doesn&apos;t exist</h1>
        <p className="text-[color:var(--muted)] text-[14px] leading-relaxed mb-8">
          The page you&apos;re looking for may have moved or been removed.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-[13px] border border-[rgba(109,40,217,0.50)] bg-[rgba(109,40,217,0.08)] text-white/80 hover:border-[rgba(109,40,217,0.95)] hover:text-white transition"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M8 2L3 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to home
        </Link>
      </div>
    </div>
  );
}
