import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import ConditionalHeader from "../components/ConditionalHeader";
import SiteFooter from "../components/SiteFooter";
import PushManager from "../components/PushManager";
import NavigationProgress from "../components/NavigationProgress";
import { ChatProvider } from "@/context/ChatContext";

const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BullionDesk",
  description: "Institutional-grade gold analysis for serious XAUUSD traders. Structure, macro, risk management. Prop firm ready. No signals. Just clarity.",
  keywords: "trading advisor, AI trading, prop firm, market analysis, FTMO, gold analysis, risk management, trading psychology, gold trading coach, XAUUSD analysis, gold market structure",
  openGraph: {
    title: "BullionDesk — Your AI Gold Trading Coach",
    description: "Institutional-grade gold analysis for serious XAUUSD traders. Structure, macro, risk management. Prop firm ready. No signals. Just clarity.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.ico",  sizes: "any" },
      { url: "/icon-32.png",  sizes: "32x32",   type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`min-h-screen bg-[#07060b] text-white ${geist.variable}`}>
        {/* Background glows */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="blob-drift-1 absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.22)] blur-[110px]" />
          <div className="blob-drift-2 absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
          <div className="blob-drift-3 absolute bottom-[-220px] left-[20%] h-[520px] w-[520px] rounded-full bg-[rgba(200,162,74,0.08)] blur-[130px]" />
        </div>

        <NavigationProgress />
        <ChatProvider>
          {/* Navbar row */}
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
            <PushManager />
            <ConditionalHeader initialEmail={null} initialAvatarUrl={null} />
          </div>
          {/* Page content */}
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
            <main className="pt-10 pb-16 animate-fade-in">{children}</main>
          </div>
          <SiteFooter />
        </ChatProvider>
      </body>
    </html>
  );
}
