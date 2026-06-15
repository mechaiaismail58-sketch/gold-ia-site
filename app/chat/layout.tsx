import NavbarPrivate from "@/components/NavbarPrivate";
import { MobileChatTabs } from "@/components/ChatSidebar";
import ChatNavSidebar from "@/components/design-system/ChatNavSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden bg-[#080810]">
      {/* Ambient animated blobs — sit behind the content */}
      <div className="fixed top-[10%] left-[10%] w-[500px] h-[500px] bg-purple-600/[0.04] rounded-full blur-[120px] pointer-events-none z-0 animate-blob-slow" />
      <div className="fixed bottom-[20%] right-[5%] w-[400px] h-[400px] bg-amber-500/[0.03] rounded-full blur-[100px] pointer-events-none z-0 animate-blob-slow-reverse" />
      <div className="fixed top-[60%] left-[40%] w-[300px] h-[300px] bg-purple-500/[0.02] rounded-full blur-[80px] pointer-events-none z-0" />

      <div className="relative z-10 flex w-full min-w-0">
        <ChatNavSidebar />

        <div className="flex-1 flex flex-col min-w-0">
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
            className="text-xs uppercase tracking-[0.1em] text-center"
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
      </div>
    </div>
  );
}
