import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type TemplateChannel = "email" | "whatsapp";

function isChannel(value: unknown): value is TemplateChannel {
  return value === "email" || value === "whatsapp";
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const channel = new URL(req.url).searchParams.get("channel");
  let query = supabase
    .from("message_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (channel === "email" || channel === "whatsapp")
    query = query.eq("channel", channel);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ templates: data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const { name, channel, subject, message } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Le nom du modèle est requis" },
      { status: 400 },
    );
  }
  if (!isChannel(channel)) {
    return NextResponse.json({ error: "Canal invalide" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json(
      { error: "Le message est requis" },
      { status: 400 },
    );
  }

  const insert = {
    user_id: user.id,
    name: name.trim().slice(0, 120),
    channel,
    subject:
      channel === "email" && typeof subject === "string"
        ? subject.trim().slice(0, 200) || null
        : null,
    message: message.trim().slice(0, 10000),
  };

  const { data, error } = await supabase
    .from("message_templates")
    .insert(insert)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ template: data }, { status: 201 });
}
