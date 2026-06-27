"use client";

import { usePathname } from "next/navigation";
import NavbarPublic from "./NavbarPublic";
import SiteFooter from "./SiteFooter";

export default function PathAwareWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/chat")) {
    return <>{children}</>;
  }

  const showPurpleGlow = pathname === "/methodology" || pathname === "/about";

  return (
    <>
      {showPurpleGlow && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "linear-gradient(180deg, rgba(124, 58, 237, 0.18) 0%, rgba(124, 58, 237, 0.06) 40%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
        <NavbarPublic initialEmail={null} initialAvatarUrl={null} />
      </div>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20" style={{ position: "relative", zIndex: 1 }}>
        <main className="pt-10 pb-16 animate-fade-in">{children}</main>
      </div>
      <SiteFooter />
    </>
  );
}
