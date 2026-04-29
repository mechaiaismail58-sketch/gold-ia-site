"use client";

import ChatPage from "@/components/ChatPage";

export const dynamic = "force-dynamic";

export default function ChatRoute() {
  return (
    <main style={{ minHeight: "100vh" }}>
      <ChatPage />
    </main>
  );
}
