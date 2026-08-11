import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUsage } from "@/lib/usage";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const usage = await getUsage(user.id);

  return (
    <ProfileClient
      email={profile?.email ?? user.email ?? ""}
      memberSince={profile?.created_at ?? user.created_at ?? null}
      usage={usage}
    />
  );
}
