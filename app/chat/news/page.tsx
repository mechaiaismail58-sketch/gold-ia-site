"use client";

import Link from "next/link";

export default function ChatNewsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 bg-[#0A0A0A]">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold text-white mb-3">Gold Intelligence Feed</h1>
        <p className="text-sm text-[#71717A] mb-8">Live news analysis coming soon.</p>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6">
          <p className="text-sm text-[#A1A1AA]">
            In the meantime, ask the AI coach about current gold market news — it has access to live RSS feeds.
          </p>
        </div>

        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 mt-6 rounded-xl border border-[#D4A843]/30 bg-[#D4A843]/[0.08] px-5 py-2.5 text-sm font-medium text-[#D4A843] hover:bg-[#D4A843]/[0.14] hover:shadow-[0_0_20px_rgba(212,168,67,0.2)] transition"
        >
          Ask the AI →
        </Link>
      </div>
    </div>
  );
}
