import "./globals.css";
import type { Metadata, Viewport } from "next";
import ConditionalHeader from "../components/ConditionalHeader";
import SiteFooter from "../components/SiteFooter";
import PushManager from "../components/PushManager";
import NavigationProgress from "../components/NavigationProgress";
import { ChatProvider } from "@/context/ChatContext";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "BullionDesk — AI Gold Trading Coach",
  description: "Institutional-grade gold analysis for serious XAUUSD traders. Structure, macro, risk management. Prop firm ready. No signals. Just clarity.",
  keywords: "trading advisor, AI trading, prop firm, market analysis, FTMO, gold analysis, risk management, trading psychology, gold trading coach, XAUUSD analysis, gold market structure",
  openGraph: {
    title: "BullionDesk — Your AI Gold Trading Coach",
    description: "Institutional-grade gold analysis for serious XAUUSD traders. Structure, macro, risk management. Prop firm ready. No signals. Just clarity.",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialEmail: string | null = null;
  let initialAvatarUrl: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      initialEmail = user.email ?? null;
      const { data } = await supabase.from("users").select("avatar_url").eq("id", user.id).single();
      initialAvatarUrl = data?.avatar_url ?? null;
    }
  } catch {
    // Not authenticated — middleware handles redirect
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#07060b] text-white">
        {/* Background glows */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.22)] blur-[110px]" />
          <div className="absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
          <div className="absolute bottom-[-220px] left-[20%] h-[520px] w-[520px] rounded-full bg-[rgba(200,162,74,0.08)] blur-[130px]" />
        </div>

        <NavigationProgress />
        <ChatProvider>
          {/* Navbar row */}
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20">
            <PushManager />
            <ConditionalHeader initialEmail={initialEmail} initialAvatarUrl={initialAvatarUrl} />
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
