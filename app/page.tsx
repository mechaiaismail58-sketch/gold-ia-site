import { redirect } from "next/navigation";
// import WaitlistLanding from "@/components/WaitlistLanding"; // TEMP — re-enable with waitlist

// Force dynamic rendering so WAITLIST_MODE is read at request time, not build time.
export const dynamic = "force-dynamic";

export default function Home() {
  // TEMP BYPASS — waitlist disabled. Re-enable by uncommenting the block below.
  redirect("/chat");

  // WAITLIST — re-enable when ready
  // if (process.env.WAITLIST_MODE?.trim() === "true") {
  //   return <WaitlistLanding />;
  // }
  // redirect("/chat");
}
