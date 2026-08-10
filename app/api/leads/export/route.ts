import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Lead } from "@/lib/types";
import { LEAD_STATUS_LABELS } from "@/lib/types";

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

  let query = supabase.from("leads").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = (data ?? []) as Lead[];
  const header = [
    "Nom",
    "Catégorie",
    "Adresse",
    "Téléphone",
    "Email",
    "SIRET",
    "Site web trouvé",
    "Statut",
    "Notes",
    "Zone recherchée",
    "Date d'ajout",
  ];

  const rows = leads.map((l) =>
    [
      csvEscape(l.name),
      csvEscape(l.category),
      csvEscape(l.address),
      csvEscape(l.phone),
      csvEscape(l.email),
      csvEscape(l.siret),
      csvEscape(l.website),
      csvEscape(LEAD_STATUS_LABELS[l.status]),
      csvEscape(l.notes),
      csvEscape(l.search_zone),
      csvEscape(new Date(l.created_at).toLocaleDateString("fr-FR")),
    ].join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  const bom = "﻿"; // keep accented characters readable in Excel

  return new NextResponse(bom + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leadspot-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
