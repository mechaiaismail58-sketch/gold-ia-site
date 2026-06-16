import NavbarPrivate from "@/components/NavbarPrivate";
import { MobileChatTabs } from "@/components/ChatSidebar";
import ChatNavSidebar from "@/components/design-system/ChatNavSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden bg-[#07060D]">
      {/* ── Ambient violet atmosphere ── */}
      {/* Large top-left purple wash */}
      <div className="fixed top-[-5%] left-[-5%] w-[800px] h-[800px] rounded-full blur-[180px] pointer-events-none z-0 animate-blob-slow" style={{ background: "radial-gradient(circle, rgba(123,79,212,0.07) 0%, rgba(88,40,180,0.03) 50%, transparent 70%)" }} />
      {/* Center-right gold accent */}
      <div className="fixed top-[40%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none z-0 animate-blob-slow-reverse" style={{ background: "radial-gradient(circle, rgba(212,168,67,0.04) 0%, transparent 60%)" }} />
      {/* Bottom-center purple vignette */}
      <div className="fixed bottom-[-10%] left-[30%] w-[700px] h-[500px] rounded-full blur-[150px] pointer-events-none z-0" style={{ background: "radial-gradient(circle, rgba(109,40,217,0.05) 0%, rgba(88,40,180,0.02) 40%, transparent 65%)" }} />
      {/* Subtle overall purple tint via gradient overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "linear-gradient(160deg, rgba(123,79,212,0.03) 0%, transparent 40%, rgba(109,40,217,0.02) 100%)" }} />

      <div className="relative z-10 flex w-full min-w-0">
        <ChatNavSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <NavbarPrivate />

          <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {children}
          </main>
          <MobileChatTabs />
        </div>
      </div>
    </div>
  );
}
