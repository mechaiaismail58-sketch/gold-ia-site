import WaitlistLanding from "@/components/WaitlistLanding";
import ChatPage from "@/components/ChatPage";

/**
 * Root page — switches between waitlist landing and the full chat app
 * based on the WAITLIST_MODE environment variable.
 *
 * Flip WAITLIST_MODE=true/false in Vercel → takes effect instantly,
 * no redeploy required (env var is read server-side at request time).
 */
export default function Home() {
  if (process.env.WAITLIST_MODE === "true") {
    return <WaitlistLanding />;
  }
  return <ChatPage />;
}
