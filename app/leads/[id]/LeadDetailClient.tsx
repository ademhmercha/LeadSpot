"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import StatusBadge from "@/app/components/StatusBadge";
import ContactLinks from "@/app/components/ContactLinks";
import type { Audit, Lead, LeadEvent, LeadStatus } from "@/lib/types";
import {
  LEAD_EVENT_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from "@/lib/types";

interface LeadDetailClientProps {
  lead: Lead;
  events: LeadEvent[];
  audit: Audit | null;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function eventDetail(event: LeadEvent): string | null {
  if (event.type === "sent") {
    const channel = event.metadata?.channel;
    return channel === "whatsapp"
      ? "Message WhatsApp ouvert/envoyé manuellement"
      : "Email de prospection envoyé";
  }
  if (event.type === "status_changed") {
    const from =
      LEAD_STATUS_LABELS[event.metadata?.from as LeadStatus] ??
      event.metadata?.from;
    const to =
      LEAD_STATUS_LABELS[event.metadata?.to as LeadStatus] ??
      event.metadata?.to;
    return `${from} → ${to}`;
  }
  return null;
}

export default function LeadDetailClient({
  lead: initialLead,
  events: initialEvents,
  audit: initialAudit,
}: LeadDetailClientProps) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [events, setEvents] = useState(initialEvents);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(initialAudit);
  const [creatingAudit, setCreatingAudit] = useState(false);
  const [copied, setCopied] = useState(false);

  async function updateLead(
    patch: Partial<Pick<Lead, "status" | "notes" | "phone" | "email">>,
  ) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.lead as Lead;
        setLead(updated);
        if (patch.status) {
          setEvents((prev) => [
            {
              id: `local-${Date.now()}`,
              user_id: updated.user_id,
              lead_id: updated.id,
              type: "status_changed",
              metadata: { from: lead.status, to: updated.status },
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function createAudit() {
    setCreatingAudit(true);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setAudit(data.audit);
      }
    } finally {
      setCreatingAudit(false);
    }
  }

  async function deleteAudit() {
    if (!audit) return;
    const res = await fetch(`/api/audits/${audit.id}`, { method: "DELETE" });
    if (res.ok) setAudit(null);
  }

  async function copyAuditLink() {
    if (!audit) return;
    const url = `${window.location.origin}/audit/${audit.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponible — l'URL reste affichée pour copie manuelle.
    }
  }

  async function deleteLead() {
    if (!confirm("Supprimer ce lead et son historique ?")) return;
    setDeleting(true);
    const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-brand-600 transition-colors hover:underline dark:text-brand-400"
        >
          ← Retour à mes leads
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {lead.name}
            </h1>
            <StatusBadge status={lead.status} />
            {lead.email_opened_at && (
              <span
                className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                title={`Ouvert le ${formatDate(lead.email_opened_at)}`}
              >
                Email ouvert
              </span>
            )}
          </div>
          <button
            onClick={deleteLead}
            disabled={deleting}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Supprimer
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {lead.address}
        </p>
        <ContactLinks
          phone={lead.phone}
          email={lead.email}
          siret={lead.siret}
          name={lead.name}
          address={lead.address}
          className="mt-2"
        />

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Infos
              </h2>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Statut
                  </label>
                  <select
                    value={lead.status}
                    disabled={saving}
                    onChange={(e) =>
                      updateLead({ status: e.target.value as LeadStatus })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    defaultValue={lead.phone ?? ""}
                    placeholder="ex : 04 78 00 00 00"
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (lead.phone ?? ""))
                        updateLead({ phone: e.target.value });
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={lead.email ?? ""}
                    placeholder="ex : contact@..."
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (lead.email ?? ""))
                        updateLead({ email: e.target.value });
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Notes
                  </label>
                  <textarea
                    defaultValue={lead.notes ?? ""}
                    placeholder="Notes libres..."
                    rows={4}
                    onBlur={(e) => {
                      if (e.target.value !== (lead.notes ?? ""))
                        updateLead({ notes: e.target.value });
                    }}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Lien d&apos;audit partageable
              </h2>
              {audit ? (
                <div className="mt-3 space-y-2">
                  <input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/audit/${audit.id}`}
                    onFocus={(e) => e.target.select()}
                    className={`${inputClass} text-xs`}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={copyAuditLink}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98]"
                    >
                      {copied ? "Copié ✓" : "Copier le lien"}
                    </button>
                    <a
                      href={`/audit/${audit.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Ouvrir la page
                    </a>
                    <button
                      onClick={deleteAudit}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={createAudit}
                  disabled={creatingAudit}
                  className="mt-3 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
                >
                  {creatingAudit ? "Création..." : "Créer le lien d'audit"}
                </button>
              )}
            </section>
          </div>

          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Historique
            </h2>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400 dark:text-gray-500">
                Aucun événement pour le moment.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {LEAD_EVENT_LABELS[event.type]}
                        {eventDetail(event) && (
                          <span className="font-normal text-gray-500 dark:text-gray-400">
                            {" "}
                            — {eventDetail(event)}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(event.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
