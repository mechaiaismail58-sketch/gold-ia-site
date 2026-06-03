"use client";

import Header from "@/components/Header";

interface Props {
  initialEmail: string | null;
  initialAvatarUrl: string | null;
}

export default function ConditionalHeader({ initialEmail, initialAvatarUrl }: Props) {
  return <Header initialEmail={initialEmail} initialAvatarUrl={initialAvatarUrl} />;
}
