"use client";

import ChatPage from "@/components/ChatPage";
import MarketDashboard from "@/components/MarketDashboard";

export const dynamic = "force-dynamic";

export default function ChatRoute() {
  return (
    <main style={{ minHeight: "100vh" }}>
      <MarketDashboard />
      <ChatPage />
    </main>
  );
}
