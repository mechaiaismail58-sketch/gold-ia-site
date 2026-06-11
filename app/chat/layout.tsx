import NavbarPrivate from "@/components/NavbarPrivate";
import { MobileChatTabs } from "@/components/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0A0A0A]">
      <NavbarPrivate />

      {/* Don't trade banner — subtle, elegant top bar */}
      <div
        className="flex-none py-2 px-6"
        style={{
          background: "linear-gradient(90deg, rgba(212,168,67,0.06) 0%, rgba(212,168,67,0.02) 100%)",
          borderBottom: "1px solid rgba(212,168,67,0.15)",
        }}
      >
        <p
          className="text-xs uppercase tracking-widest text-center"
          style={{ color: "rgba(212,168,67,0.7)" }}
        >
          Don&apos;t take any trade before checking with the AI.
        </p>
      </div>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
      <MobileChatTabs />
    </div>
  );
}
