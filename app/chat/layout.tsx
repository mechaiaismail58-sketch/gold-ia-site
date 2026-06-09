import { DesktopChatSidebar, MobileChatTabs } from "@/components/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden bg-[#0A0A0A]">
      <DesktopChatSidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {children}
        </main>
        <MobileChatTabs />
      </div>
    </div>
  );
}
