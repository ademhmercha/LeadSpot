"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { Lead } from "@/lib/types";

// Leaflet's default marker icons reference image paths that don't resolve
// under Next.js bundling — point them at a CDN fallback instead.
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface MapViewProps {
  leads: Lead[];
}

/**
 * Uses MapTiler's raster tile endpoint (free tier, requires an API key) —
 * NOT tile.openstreetmap.org directly, whose usage policy prohibits
 * high-volume/production use without prior agreement.
 * https://www.maptiler.com/cloud/pricing/ (free tier, no credit card).
 */
export default function MapView({ leads }: MapViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_MAP_TILES_API_KEY;
  const positioned = leads.filter((l) => l.lat != null && l.lon != null);

  const center: [number, number] =
    positioned.length > 0
      ? [positioned[0].lat as number, positioned[0].lon as number]
      : [46.6034, 1.8883]; // France

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl bg-gray-100 p-6 text-center text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        Carte indisponible : définissez{" "}
        <code>NEXT_PUBLIC_MAP_TILES_API_KEY</code> (MapTiler, free tier) pour
        l&apos;activer.
      </div>
    );
  }

  const tileUrl = `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${apiKey}`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      <MapContainer
        center={center}
        zoom={positioned.length > 0 ? 12 : 5}
        scrollWheelZoom
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        />
        {positioned.map((lead) => (
          <Marker
            key={lead.id}
            position={[lead.lat as number, lead.lon as number]}
            icon={markerIcon}
          >
            <Popup>
              <strong>{lead.name}</strong>
              <br />
              {lead.address}
              {lead.phone && (
                <>
                  <br />
                  {lead.phone}
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
