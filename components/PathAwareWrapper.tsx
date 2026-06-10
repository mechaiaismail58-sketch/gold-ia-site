"use client";

import { usePathname } from "next/navigation";
import ConditionalHeader from "./ConditionalHeader";
import SiteFooter from "./SiteFooter";

export default function PathAwareWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/chat")) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <div className="flex-none px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
          <ConditionalHeader initialEmail={null} initialAvatarUrl={null} />
        </div>
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
        <ConditionalHeader initialEmail={null} initialAvatarUrl={null} />
      </div>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
        <main className="pt-10 pb-16 animate-fade-in">{children}</main>
      </div>
      <SiteFooter />
    </>
  );
}
