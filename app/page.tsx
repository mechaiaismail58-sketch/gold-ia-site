import WaitlistLanding from "@/components/WaitlistLanding";
import ChatPage from "@/components/ChatPage";

// Force dynamic rendering so WAITLIST_MODE is read at request time, not build time.
export const dynamic = "force-dynamic";

export default function Home() {
  if (process.env.WAITLIST_MODE?.trim() === "true") {
    return <WaitlistLanding />;
  }
  return <ChatPage />;
}
