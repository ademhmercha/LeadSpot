"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lead, LeadStatus } from "@/lib/types";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/types";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import StatusBadge from "./StatusBadge";
import ContactLinks from "./ContactLinks";
import MessageComposer from "./MessageComposer";

const PAGE_SIZE = 20;

type SortKey = "created_at" | "name" | "status";

type ContactFilter = "all" | "any" | "email" | "whatsapp";

function hasWhatsApp(lead: Lead): boolean {
  return Boolean(lead.phone && toWhatsAppNumber(lead.phone));
}

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
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const withContacts = useMemo(() => leads.filter((l) => l.phone || l.email).length, [leads]);

  const filtered = useMemo(() => {
    let rows = leads;
    if (statusFilter !== "all") rows = rows.filter((l) => l.status === statusFilter);
    if (contactFilter === "any") rows = rows.filter((l) => l.phone || l.email);
    if (contactFilter === "email") rows = rows.filter((l) => l.email);
    if (contactFilter === "whatsapp") rows = rows.filter((l) => hasWhatsApp(l));
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((l) => l.name.toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "status") return a.status.localeCompare(b.status);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [leads, statusFilter, contactFilter, search, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Réclame la page courante quand le nombre de résultats change (filtres,
  // recherche ou suppression d'un lead sur la dernière page).
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectable = useMemo(() => filtered.filter((l) => l.phone || l.email), [filtered]);
  const allSelected = selectable.length > 0 && selectable.every((l) => selectedIds.has(l.id));
  const someSelected = selectable.some((l) => selectedIds.has(l.id));
  const selectedLeads = useMemo(() => leads.filter((l) => selectedIds.has(l.id)), [leads, selectedIds]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        selectable.forEach((l) => next.delete(l.id));
      } else {
        selectable.forEach((l) => next.add(l.id));
      }
      return next;
    });
  }

  function handleSent(sentLeadIds: string[]) {
    const sentSet = new Set(sentLeadIds);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      sentSet.forEach((id) => next.delete(id));
      return next;
    });
    sentLeadIds.forEach((id) => {
      const lead = leads.find((l) => l.id === id);
      if (lead && lead.status !== "contacte") onLeadUpdated({ ...lead, status: "contacte" });
    });
  }

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
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            placeholder="Rechercher un nom ou une adresse..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-64 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as LeadStatus | "all");
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="created_at">Plus récents</option>
              <option value="name">Nom (A-Z)</option>
              <option value="status">Statut</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 transition-colors focus:ring-brand-500"
              />
              Tout sélectionner
            </label>
            <select
              value={contactFilter}
              onChange={(e) => {
                setContactFilter(e.target.value as ContactFilter);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">Tous les contacts</option>
              <option value="any">Avec un contact (tel ou email)</option>
              <option value="email">Avec email</option>
              <option value="whatsapp">Avec WhatsApp</option>
            </select>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {withContacts} / {leads.length} avec coordonnées
          </span>
        </div>
      </div>

        {selectedIds.size > 0 && (
          <div className="animate-fade-in-up flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-50 p-2 dark:bg-brand-900/30">
            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">
              {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} sélectionné{selectedIds.size > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-white/60 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                Désélectionner
              </button>
              <button
                onClick={() => setComposerOpen(true)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98]"
              >
                Envoyer un message
              </button>
            </div>
          </div>
        )}

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {filtered.length === 0 && (
          <li className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">Aucun lead à afficher.</li>
        )}

        {paginated.map((lead, i) => (
          <li
            key={lead.id}
            className="animate-fade-in-up p-4 transition-colors"
            style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(lead.id)}
                  disabled={!lead.phone && !lead.email}
                  onChange={() => toggleSelect(lead.id)}
                  title={!lead.phone && !lead.email ? "Aucune coordonnée — non sélectionnable" : "Sélectionner"}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600 transition-colors focus:ring-brand-500 disabled:opacity-40 dark:border-gray-600"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-800 dark:text-gray-100">{lead.name}</p>
                  {contactCount(lead) > 0 && (
                    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {contactCount(lead)} coordonnée{contactCount(lead) > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{lead.address}</p>
                <ContactLinks
                  phone={lead.phone}
                  email={lead.email}
                  siret={lead.siret}
                  name={lead.name}
                  address={lead.address}
                  className="mt-1"
                />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={lead.status}
                  disabled={savingId === lead.id}
                  onChange={(e) => updateLead(lead.id, { status: e.target.value as LeadStatus })}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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

            <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <span>Recherché sur : {lead.search_zone}</span>
              <button
                onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                className="font-medium text-brand-600 transition-colors hover:underline dark:text-brand-400"
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
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Téléphone {!lead.phone && "(non trouvé — complétez si connu)"}
                    </label>
                    <input
                      type="tel"
                      defaultValue={lead.phone ?? ""}
                      placeholder="ex : 04 78 00 00 00"
                      onBlur={(e) => {
                        if (e.target.value.trim() !== (lead.phone ?? "")) updateLead(lead.id, { phone: e.target.value });
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Email {!lead.email && "(non trouvé — complétez si connu)"}
                    </label>
                    <input
                      type="email"
                      defaultValue={lead.email ?? ""}
                      placeholder="ex : contact@..."
                      onBlur={(e) => {
                        if (e.target.value.trim() !== (lead.email ?? "")) updateLead(lead.id, { email: e.target.value });
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </div>
                </div>
                <textarea
                  defaultValue={lead.notes ?? ""}
                  placeholder="Notes libres..."
                  onBlur={(e) => updateLead(lead.id, { notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  rows={2}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {filtered.length} lead(s) — page {page} / {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {composerOpen && (
        <MessageComposer leads={selectedLeads} onClose={() => setComposerOpen(false)} onSent={handleSent} />
      )}
    </div>
  );
}
