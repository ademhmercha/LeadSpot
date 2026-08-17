import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const search = searchParams.get("q");

  let query = supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (category) query = query.eq("search_category", category);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data });
}
