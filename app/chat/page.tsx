import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// /chat is the legacy route — redirect to the dashboard where the chat overlay lives
export default function ChatPage() {
  redirect("/dashboard");
}
