"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";

interface Props {
  initialEmail: string | null;
  initialAvatarUrl: string | null;
}

// Hides the navbar on the landing page ("/") unless the user has the admin_bypass cookie.
// On all other routes the navbar is always visible.
export default function ConditionalHeader({ initialEmail, initialAvatarUrl }: Props) {
  const pathname = usePathname();

  // Never show header on the landing page — it has its own design
  if (pathname === "/") return null;

  return <Header initialEmail={initialEmail} initialAvatarUrl={initialAvatarUrl} />;
}
