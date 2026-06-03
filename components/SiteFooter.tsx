import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20 pb-10">
      <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-white/25">
          Bullion Desk © {new Date().getFullYear()} · Not investment advice
        </p>
        <nav className="flex items-center gap-5">
          <Link href="/terms"   className="text-[11px] text-white/25 hover:text-white/50 transition">Terms</Link>
          <Link href="/privacy" className="text-[11px] text-white/25 hover:text-white/50 transition">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
