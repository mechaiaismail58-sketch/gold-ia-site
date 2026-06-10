import NavbarPrivate from "@/components/NavbarPrivate";
import { MobileChatTabs } from "@/components/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0A0A0A]">
      <NavbarPrivate />

      {/* Don't trade banner */}
      <div className="chat-anchor-pulse chat-banner-glow flex-none bg-[#D4A843]/[0.08] border-b border-[#D4A843]/20 py-2.5 px-4">
        <p className="text-sm text-[#D4A843] font-medium text-center leading-snug">
          Don&apos;t take any trade before checking with the AI.
        </p>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-[#D4A843]/30 to-transparent flex-none" />

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
      <MobileChatTabs />
    </div>
  );
}
