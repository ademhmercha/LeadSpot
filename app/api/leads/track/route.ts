import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { recordLeadEvent } from "@/lib/lead-events";
import {
  trackingPixelBody,
  TRACKING_PIXEL_CONTENT_TYPE,
  verifyLeadToken,
} from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Pixel de suivi d'ouverture des emails de prospection. Route publique (le
 * destinataire de l'email n'a pas de session) : la signature HMAC dans
 * l'URL garantit que seule l'application peut générer des liens valides.
 * Première ouverture → `email_opened_at` renseigné, statut passé à
 * « intéressé » si le lead était « contacté », et événement `opened`.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("lead") ?? "";
  const sig = searchParams.get("sig") ?? "";

  if (!leadId || !verifyLeadToken(leadId, sig)) {
    return new NextResponse(trackingPixelBody(), {
      status: 400,
      headers: { "Content-Type": TRACKING_PIXEL_CONTENT_TYPE },
    });
  }

  const admin = createServiceRoleClient();
  const { data: lead } = await admin
    .from("leads")
    .select("id, user_id, status, email_opened_at")
    .eq("id", leadId)
    .maybeSingle();

  if (lead && !lead.email_opened_at) {
    const patch: Record<string, unknown> = {
      email_opened_at: new Date().toISOString(),
    };
    if (lead.status === "contacte") patch.status = "interesse";
    await admin.from("leads").update(patch).eq("id", leadId);
    await recordLeadEvent(admin, {
      userId: lead.user_id,
      leadId,
      type: "opened",
    });
  }

  return new NextResponse(trackingPixelBody(), {
    status: 200,
    headers: {
      "Content-Type": TRACKING_PIXEL_CONTENT_TYPE,
      "Cache-Control": "no-store",
    },
  });
}
