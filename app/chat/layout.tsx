import NavbarPrivate from "@/components/NavbarPrivate";
import { MobileChatTabs } from "@/components/ChatSidebar";
import ChatNavSidebar from "@/components/design-system/ChatNavSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden bg-[#07060D]">
      <div className="fixed top-[-5%] left-[-5%] w-[500px] h-[500px] rounded-full blur-[90px] pointer-events-none z-0" style={{ background: "radial-gradient(circle, rgba(123,79,212,0.06) 0%, transparent 70%)" }} />
      <div className="fixed top-[40%] right-[-5%] w-[400px] h-[400px] rounded-full blur-[90px] pointer-events-none z-0" style={{ background: "radial-gradient(circle, rgba(212,168,67,0.04) 0%, transparent 60%)" }} />

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
