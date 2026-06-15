import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import PushManager from "../components/PushManager";
import NavigationProgress from "../components/NavigationProgress";
import { ChatProvider } from "@/context/ChatContext";
import PathAwareWrapper from "../components/PathAwareWrapper";
import GradientBlobs from "@/components/design-system/GradientBlobs";
import SmoothScroll from "@/components/SmoothScroll";

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
      <body className={`min-h-screen bg-[#07060b] text-white grain-overlay ${geist.variable}`}>
        {/* Shared background — animated purple/gold blobs, all routes */}
        <GradientBlobs />

        <NavigationProgress />
        <SmoothScroll>
          <ChatProvider>
            <PushManager />
            <PathAwareWrapper>
              {children}
            </PathAwareWrapper>
          </ChatProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
