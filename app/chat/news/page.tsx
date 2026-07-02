"use client";

import Eyebrow from "@/components/design-system/Eyebrow";
import NewsFeed from "@/components/NewsFeed";
import { t } from "@/lib/i18n";

export default function ChatNewsPage() {
  return (
    <div
      data-lenis-prevent
      className="flex-1 flex flex-col items-center px-6 py-12 overflow-y-auto"
    >
      <div className="w-full max-w-2xl text-center mb-10">
        <Eyebrow className="text-center">Gold News &amp; Sentiment</Eyebrow>
        <h1 className="text-white text-[32px] sm:text-[40px] font-semibold tracking-[-0.03em] leading-[1.1] mt-4 mb-4">
          Market Intelligence
        </h1>
        <p className="text-[14px] leading-relaxed text-white/40">
          {t("news-page-subtitle")}
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <NewsFeed />
      </div>
    </div>
  );
}
