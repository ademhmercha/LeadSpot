"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/app/components/Navbar";
import LeadTable from "@/app/components/LeadTable";
import UsageMeter from "@/app/components/UsageMeter";
import type { Lead } from "@/lib/types";

const MapView = dynamic(() => import("@/app/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Chargement de la carte...
    </div>
  ),
});

export default function DashboardClient({
  initialLeads,
}: {
  initialLeads: Lead[];
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [showMap, setShowMap] = useState(false);

  function handleLeadUpdated(updated: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  function handleLeadDeleted(id: string) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Mes leads
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {leads.length} lead(s) enregistré(s)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMap((v) => !v)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 active:scale-[0.98] dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {showMap ? "Masquer la carte" : "Voir la carte"}
            </button>
            <a
              href="/api/leads/export"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98]"
            >
              Exporter CSV
            </a>
          </div>
        </div>

        <div className="mb-4">
          <UsageMeter />
        </div>

        {showMap && (
          <div className="animate-fade-in-up mb-4 h-96 overflow-hidden rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
            <MapView leads={leads} />
          </div>
        )}

        <LeadTable
          leads={leads}
          onLeadUpdated={handleLeadUpdated}
          onLeadDeleted={handleLeadDeleted}
        />
      </main>
    </div>
  );
}
