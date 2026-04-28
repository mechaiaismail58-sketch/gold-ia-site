import WaitlistLanding from "@/components/WaitlistLanding";

// Force dynamic rendering so this is never statically cached
export const dynamic = "force-dynamic";

// / is the public waitlist landing — always shown to unauthenticated visitors.
// Admin bypass is handled by middleware (/admin?secret=xxx → sets cookie → /chat).
export default function Home() {
  return <WaitlistLanding />;
}
