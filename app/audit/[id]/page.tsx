import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { isSocialOnlyOrMissing } from "@/lib/geoapify";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export default async function AuditPage({ params }: RouteParams) {
  const admin = createServiceRoleClient();

  const { data: audit } = await admin
    .from("audits")
    .select("id, lead_id, user_id, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!audit) notFound();

  const { data: lead } = await admin
    .from("leads")
    .select("*")
    .eq("id", audit.lead_id)
    .maybeSingle();
  if (!lead) notFound();

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", audit.user_id)
    .maybeSingle();

  const l = lead as Lead;
  const socialOnly = isSocialOnlyOrMissing(l.website);
  const whatsapp = l.phone ? toWhatsAppNumber(l.phone) : null;
  const contactEmail = profile?.email ?? null;
  const createdLabel = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
  }).format(new Date(audit.created_at));
  const mailto = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(`Site web — ${l.name}`)}&body=${encodeURIComponent(
        `Bonjour,\n\nJ'ai vu votre audit LeadSpot : vous n'avez pas encore de site web alors que vos clients vous cherchent en ligne.\n\nSouhaitez-vous en discuter ?\n\n— ${l.name}`,
      )}`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <img
              src="/icons/logo-small.png"
              alt="Logo LeadSpot"
              width={28}
              height={28}
              className="h-7 w-7 rounded-md"
            />
            <span className="text-base font-bold text-brand-700 dark:text-brand-400">
              LeadSpot
            </span>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {createdLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {l.name}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                socialOnly
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {l.website
                ? "Présence uniquement sur les réseaux sociaux"
                : "Pas encore de site web"}
            </span>
          </div>

          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {l.category} — {l.address}
          </p>

          <div className="mt-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {l.website ? (
                <>
                  Sa présence en ligne se limite à sa page{" "}
                  <a
                    href={l.website}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-600 underline underline-offset-2 dark:text-brand-400"
                  >
                    {l.website}
                  </a>
                  . Quand un client cherche « {l.name} » sur Google, il ne
                  trouve ni menu, ni horaires à jour, ni moyen de réserver.
                </>
              ) : (
                <>
                  Aujourd&apos;hui, {l.name} n&apos;est pas trouvable sur
                  internet. Quand un client cherche ce type d&apos;établissement
                  à proximité, il ne trouve pas {l.name} — et il va chez le
                  concurrent qui a un site web.
                </>
              )}
            </p>
          </div>

          {(l.phone || l.email) && (
            <div className="mt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Coordonnées
              </h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 dark:text-gray-300">
                {whatsapp && (
                  <a
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    WhatsApp
                  </a>
                )}
                {l.phone && <span>{l.phone}</span>}
                {l.email && <span>{l.email}</span>}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-xl bg-brand-50 p-5 ring-1 ring-brand-100 dark:bg-brand-950/40 dark:ring-brand-900/50">
            <h2 className="font-semibold text-gray-900 dark:text-gray-50">
              Un site web, ça change tout
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Un site simple et local peut être en ligne en quelques jours. Vous
              souhaitez être visible, vous aussi ?
            </p>
            {mailto && (
              <a
                href={mailto}
                className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98]"
              >
                Demander un devis gratuit
              </a>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
          Audit de présence en ligne généré par LeadSpot.
        </p>
      </main>
    </div>
  );
}
