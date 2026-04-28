import { redirect } from "next/navigation";
import WaitlistLanding from "@/components/WaitlistLanding";

// Force dynamic rendering so WAITLIST_MODE is read at request time, not build time.
export const dynamic = "force-dynamic";

export default function Home() {
  if (process.env.WAITLIST_MODE?.trim() === "true") {
    return <WaitlistLanding />;
  }
  redirect("/chat");
}
