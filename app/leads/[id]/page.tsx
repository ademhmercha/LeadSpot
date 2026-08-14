import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Audit, Lead, LeadEvent } from "@/lib/types";
import LeadDetailClient from "./LeadDetailClient";

interface RouteParams {
  params: { id: string };
}

export default async function LeadDetailPage({ params }: RouteParams) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!lead) notFound();

  const { data: events } = await supabase
    .from("lead_events")
    .select("*")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false });

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("lead_id", lead.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <LeadDetailClient
      lead={lead as Lead}
      events={(events ?? []) as LeadEvent[]}
      audit={(audit ?? null) as Audit | null}
    />
  );
}
