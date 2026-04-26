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

  const isAdmin =
    typeof document !== "undefined" &&
    document.cookie.split(";").some((c) => c.trim().startsWith("admin_bypass="));

  // Dashboard has its own navigation rail — never show the header there
  if (pathname === "/dashboard") return null;
  if ((pathname === "/" || pathname === "/partners") && !isAdmin) return null;

  return <Header initialEmail={initialEmail} initialAvatarUrl={initialAvatarUrl} />;
}
