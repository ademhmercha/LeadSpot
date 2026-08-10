interface ContactLinksProps {
  phone: string | null;
  email: string | null;
  siret?: string | null;
  name?: string;
  address?: string | null;
  className?: string;
}

/**
 * Geoapify's data comes from OpenStreetMap, which is often missing phone/
 * email for a given establishment even when Google Maps has it (Google's
 * database is proprietary — pulling from it would require the paid Places
 * API, which this project deliberately avoids). Rather than pretend the gap
 * doesn't exist, we surface a one-click, key-free Google Maps search link so
 * the user can check themselves and save what they find (see the edit
 * affordance in LeadTable).
 */
export default function ContactLinks({ phone, email, siret, name, address, className = "" }: ContactLinksProps) {
  const mapsQuery = [name, address].filter(Boolean).join(" ");
  const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : null;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${className}`}>
      {!phone && !email && <p className="text-xs italic text-gray-400">Aucun contact renseigné</p>}

      {phone && (
        <a
          href={`tel:${phone.replace(/\s+/g, "")}`}
          className="inline-flex items-center gap-1 text-gray-600 transition-colors hover:text-brand-700"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path d="M3.654 1.328a.678.678 0 0 1 1.015-.063l2.223 2.222c.284.283.359.71.186 1.06l-1.15 2.3a1 1 0 0 0 .18 1.146l4.899 4.899a1 1 0 0 0 1.145.18l2.301-1.15a.678.678 0 0 1 1.06.187l2.222 2.222a.678.678 0 0 1-.063 1.015l-1.939 1.454a1.678 1.678 0 0 1-1.85.13C10.586 14.32 5.68 9.415 3.02 5.117a1.678 1.678 0 0 1 .13-1.85l1.454-1.939Z" />
          </svg>
          {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1 text-gray-600 transition-colors hover:text-brand-700"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path d="M3 4a2 2 0 0 0-2 2v.217l9 5.4 9-5.4V6a2 2 0 0 0-2-2H3Z" />
            <path d="M18 8.383l-7.447 4.468a1 1 0 0 1-1.03 0L2 8.383V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.383Z" />
          </svg>
          {email}
        </a>
      )}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-gray-400 transition-colors hover:text-brand-700"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
            <path
              fillRule="evenodd"
              d="M9.69 18.933a.375.375 0 0 0 .62 0c2.798-3.936 6.19-8.94 6.19-11.808A6.5 6.5 0 0 0 3 7.125c0 2.868 3.392 7.872 6.69 11.808ZM10 9.5a2.375 2.375 0 1 0 0-4.75 2.375 2.375 0 0 0 0 4.75Z"
              clipRule="evenodd"
            />
          </svg>
          Vérifier sur Maps
        </a>
      )}
      {siret && (
        <a
          href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${siret}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-gray-400 transition-colors hover:text-brand-700"
          title="Fiche officielle Annuaire des Entreprises (data.gouv.fr)"
        >
          SIRET {siret}
        </a>
      )}
    </div>
  );
}
