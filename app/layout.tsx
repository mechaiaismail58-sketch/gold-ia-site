import "./globals.css";
import type { Metadata, Viewport } from "next";
import ConditionalHeader from "../components/ConditionalHeader";
import PushManager from "../components/PushManager";
import NavigationProgress from "../components/NavigationProgress";
import { ChatProvider } from "@/context/ChatContext";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Bullion Desk",
  description: "Institutional Gold Intelligence",
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
  // Read session server-side so Header never flashes "logged out" state.
  // Done before the WAITLIST_MODE check so admins get the header on all non-landing pages.
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
    // Not authenticated — fine, middleware handles redirect
  }

  // Waitlist mode — ConditionalHeader still included so admins can navigate non-landing pages.
  if (process.env.WAITLIST_MODE?.trim() === "true") {
    return (
      <html lang="en">
        <body className="min-h-screen bg-[#07060b] text-white">
          <NavigationProgress />
          <ChatProvider>
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <ConditionalHeader initialEmail={initialEmail} initialAvatarUrl={initialAvatarUrl} />
            </div>
            {children}
          </ChatProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#07060b] text-white">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute -top-24 left-[-140px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.22)] blur-[110px]" />
          <div className="absolute top-[-120px] right-[-180px] h-[520px] w-[520px] rounded-full bg-[rgba(109,40,217,0.14)] blur-[120px]" />
          <div className="absolute bottom-[-220px] left-[20%] h-[520px] w-[520px] rounded-full bg-[rgba(200,162,74,0.08)] blur-[130px]" />
        </div>

        <NavigationProgress />
        <ChatProvider>
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <PushManager />
            <ConditionalHeader initialEmail={initialEmail} initialAvatarUrl={initialAvatarUrl} />
            <main className="pt-8 pb-10 animate-fade-in">{children}</main>
          </div>
        </ChatProvider>
      </body>
    </html>
  );
}
