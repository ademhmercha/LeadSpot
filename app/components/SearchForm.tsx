"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BUSINESS_CATEGORIES } from "@/lib/geoapify";
import type { Lead } from "@/lib/types";
import ContactLinks from "./ContactLinks";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">
      Chargement de la carte...
    </div>
  ),
});

interface SearchResult {
  leads: Lead[];
  mergedCount: number;
  totalFound: number;
  withoutWebsiteCount: number;
  fromCache: boolean;
  zoneLabel: string;
  lat: number;
  lon: number;
  usage: { searchCount: number; limit: number; remaining: number };
}

type ZoneMode = "ville" | "gps";

// "Locate me" searches are precise (GPS), so a tight walking/driving radius
// makes sense; a typed city name is an imprecise center, so it defaults
// wider. Switching modes re-clamps the current radius into the new range.
const RADIUS_BOUNDS: Record<
  ZoneMode,
  { min: number; max: number; default: number }
> = {
  ville: { min: 1, max: 50, default: 5 },
  gps: { min: 1, max: 15, default: 3 },
};

export default function SearchForm() {
  const router = useRouter();
  const [category, setCategory] = useState(BUSINESS_CATEGORIES[0].value);
  const [zoneMode, setZoneMode] = useState<ZoneMode>("ville");
  const [zoneQuery, setZoneQuery] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(RADIUS_BOUNDS.ville.default);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [savingZone, setSavingZone] = useState(false);
  const [zoneSaved, setZoneSaved] = useState(false);

  function selectMode(mode: ZoneMode) {
    setZoneMode(mode);
    setRadiusKm(RADIUS_BOUNDS[mode].default);
    setLocateError(null);
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      setLocateError(
        "La géolocalisation n'est pas disponible sur cet appareil.",
      );
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLocating(false);
      },
      (err) => {
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Localisation refusée. Autorisez l'accès à votre position, ou passez en recherche par ville."
            : "Impossible de récupérer votre position.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setZoneSaved(false);

    try {
      const body =
        zoneMode === "gps" && gpsCoords
          ? { category, lat: gpsCoords.lat, lon: gpsCoords.lon, radiusKm }
          : { category, zoneQuery, radiusKm };

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue");
        return;
      }
      setResult(data);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveZone() {
    if (!result) return;
    setSavingZone(true);
    try {
      const res = await fetch("/api/saved-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          zoneLabel: result.zoneLabel,
          lat: result.lat,
          lon: result.lon,
          radiusKm,
        }),
      });
      if (res.ok) setZoneSaved(true);
    } finally {
      setSavingZone(false);
    }
  }

  const bounds = RADIUS_BOUNDS[zoneMode];
  const canSubmit =
    zoneMode === "ville" ? zoneQuery.trim().length > 0 : gpsCoords !== null;

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type d&apos;établissement
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Zone de recherche
          </label>
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => selectMode("ville")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                zoneMode === "ville"
                  ? "bg-white text-brand-700 shadow-sm dark:bg-gray-600 dark:text-brand-300"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Ville
            </button>
            <button
              type="button"
              onClick={() => selectMode("gps")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                zoneMode === "gps"
                  ? "bg-white text-brand-700 shadow-sm dark:bg-gray-600 dark:text-brand-300"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Autour de moi
            </button>
          </div>

          {zoneMode === "ville" ? (
            <input
              type="text"
              required
              placeholder="ex : Lyon, France"
              value={zoneQuery}
              onChange={(e) => setZoneQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          ) : (
            <div className="animate-fade-in-up">
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={locating}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-150 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:border-brand-400 dark:hover:bg-brand-900/30"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-4 w-4 ${locating ? "animate-pulse" : ""}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M10 2a1 1 0 0 1 1 1v.06a7.003 7.003 0 0 1 5.94 5.94H17a1 1 0 1 1 0 2h-.06a7.003 7.003 0 0 1-5.94 5.94V17a1 1 0 1 1-2 0v-.06A7.003 7.003 0 0 1 3.06 11H3a1 1 0 1 1 0-2h.06A7.003 7.003 0 0 1 9 3.06V3a1 1 0 0 1 1-1Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
                    clipRule="evenodd"
                  />
                </svg>
                {locating
                  ? "Localisation en cours..."
                  : gpsCoords
                    ? "Position détectée ✓ — relocaliser"
                    : "Me localiser"}
              </button>
              {locateError && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  {locateError}
                </p>
              )}
              {gpsCoords && !locateError && (
                <p className="mt-1.5 text-xs text-green-700 dark:text-green-400">
                  Position : {gpsCoords.lat.toFixed(4)},{" "}
                  {gpsCoords.lon.toFixed(4)}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Rayon : {radiusKm} km
          </label>
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-full accent-brand-600 transition-opacity"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{bounds.min} km</span>
            <span>{bounds.max} km</span>
          </div>
        </div>

        {error && (
          <p className="animate-fade-in-up text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
        >
          {loading ? "Recherche en cours..." : "Rechercher des leads"}
        </button>
      </form>

      {result && (
        <div className="animate-fade-in-up space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">
              {result.leads.length} lead{result.leads.length > 1 ? "s" : ""}{" "}
              avec un contact trouvé{result.leads.length > 1 ? "s" : ""}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sur {result.withoutWebsiteCount} établissement(s) sans site web
              dans un rayon de {radiusKm} km autour de{" "}
              <strong>{result.zoneLabel}</strong>
              {result.fromCache && " (résultats en cache, < 7 jours)"}.
            </p>
            {result.mergedCount > 0 && (
              <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
                {result.mergedCount} doublon{result.mergedCount > 1 ? "s" : ""}{" "}
                fusionné{result.mergedCount > 1 ? "s" : ""} avec un lead
                existant.
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleSaveZone}
                disabled={savingZone || zoneSaved}
                className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 transition-all duration-150 hover:bg-brand-50 disabled:opacity-60 dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-900/30"
              >
                {zoneSaved
                  ? "Zone sauvegardée pour les alertes ✓"
                  : savingZone
                    ? "Sauvegarde..."
                    : "Suivre cette zone (alerte hebdo)"}
              </button>
            </div>
          </div>

          {result.leads.length > 0 && (
            <div className="h-72 overflow-hidden rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
              <MapView leads={result.leads} />
            </div>
          )}

          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {result.leads.slice(0, 15).map((lead, i) => (
                <li
                  key={lead.id}
                  className="animate-fade-in-up p-3 text-sm"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    {lead.name}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {lead.address}
                  </p>
                  <ContactLinks
                    phone={lead.phone}
                    email={lead.email}
                    siret={lead.siret}
                    name={lead.name}
                    address={lead.address}
                    className="mt-1"
                  />
                </li>
              ))}
            </ul>
            {result.leads.length > 15 && (
              <p className="border-t border-gray-100 p-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                +{result.leads.length - 15} autres — voir la liste complète dans
                « Mes leads ».
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
