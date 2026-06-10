import { MobileChatTabs } from "@/components/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0A0A0A]">
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
      <MobileChatTabs />
    </div>
  );
}
