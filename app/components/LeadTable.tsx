"use client";

import { useMemo, useState } from "react";
import type { Lead, LeadStatus } from "@/lib/types";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import ContactLinks from "./ContactLinks";

type SortKey = "created_at" | "name" | "status";

function contactCount(lead: Lead): number {
  return [lead.phone, lead.email].filter(Boolean).length;
}

interface LeadTableProps {
  leads: Lead[];
  onLeadUpdated: (lead: Lead) => void;
  onLeadDeleted: (id: string) => void;
}

export default function LeadTable({ leads, onLeadUpdated, onLeadDeleted }: LeadTableProps) {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [contactOnly, setContactOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const withContacts = useMemo(() => leads.filter((l) => l.phone || l.email).length, [leads]);

  const filtered = useMemo(() => {
    let rows = leads;
    if (statusFilter !== "all") rows = rows.filter((l) => l.status === statusFilter);
    if (contactOnly) rows = rows.filter((l) => l.phone || l.email);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((l) => l.name.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "status") return a.status.localeCompare(b.status);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [leads, statusFilter, contactOnly, search, sortKey]);

  async function updateLead(id: string, patch: Partial<Pick<Lead, "status" | "notes" | "phone" | "email">>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok) onLeadUpdated(data.lead as Lead);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteLead(id: string) {
    if (!confirm("Supprimer ce lead ?")) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) onLeadDeleted(id);
  }

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Rechercher un nom ou une adresse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-64"
          />
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="all">Tous les statuts</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="created_at">Plus récents</option>
              <option value="name">Nom (A-Z)</option>
              <option value="status">Statut</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={contactOnly}
              onChange={(e) => setContactOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 transition-colors focus:ring-brand-500"
            />
            Coordonnées disponibles uniquement (téléphone ou email)
          </label>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {withContacts} / {leads.length} avec coordonnées
          </span>
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {filtered.length === 0 && <li className="p-6 text-center text-sm text-gray-400">Aucun lead à afficher.</li>}

        {filtered.map((lead, i) => (
          <li
            key={lead.id}
            className="animate-fade-in-up p-4 transition-colors"
            style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-800">{lead.name}</p>
                  {contactCount(lead) > 0 && (
                    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      {contactCount(lead)} coordonnée{contactCount(lead) > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{lead.address}</p>
                <ContactLinks
                  phone={lead.phone}
                  email={lead.email}
                  siret={lead.siret}
                  name={lead.name}
                  address={lead.address}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={lead.status}
                  disabled={savingId === lead.id}
                  onChange={(e) => updateLead(lead.id, { status: e.target.value as LeadStatus })}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs transition-colors"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <StatusBadge status={lead.status} />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
              <span>Recherché sur : {lead.search_zone}</span>
              <button
                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                className="font-medium text-brand-600 transition-colors hover:underline"
              >
                {expandedId === lead.id ? "Masquer les détails" : "Détails / contact"}
              </button>
              <button
                onClick={() => deleteLead(lead.id)}
                className="font-medium text-red-500 transition-colors hover:underline"
              >
                Supprimer
              </button>
            </div>

            {expandedId === lead.id && (
              <div className="animate-fade-in-up mt-2 space-y-2">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Téléphone {!lead.phone && "(non trouvé — complétez si connu)"}
                    </label>
                    <input
                      type="tel"
                      defaultValue={lead.phone ?? ""}
                      placeholder="ex : 04 78 00 00 00"
                      onBlur={(e) => {
                        if (e.target.value.trim() !== (lead.phone ?? "")) updateLead(lead.id, { phone: e.target.value });
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      Email {!lead.email && "(non trouvé — complétez si connu)"}
                    </label>
                    <input
                      type="email"
                      defaultValue={lead.email ?? ""}
                      placeholder="ex : contact@..."
                      onBlur={(e) => {
                        if (e.target.value.trim() !== (lead.email ?? "")) updateLead(lead.id, { email: e.target.value });
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <textarea
                  defaultValue={lead.notes ?? ""}
                  placeholder="Notes libres..."
                  onBlur={(e) => updateLead(lead.id, { notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={2}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
