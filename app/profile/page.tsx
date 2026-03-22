import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Prefer admin client (bypasses RLS), fall back to user-scoped client
  const db = createAdminClient() ?? supabase;

  const { data: profile } = await db
    .from("users")
    .select("email, trading_horizon, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <ProfileClient
      email={profile?.email ?? user.email ?? ""}
      tradingHorizon={profile?.trading_horizon ?? "daytrade"}
      avatarUrl={profile?.avatar_url ?? null}
    />
  );
}
