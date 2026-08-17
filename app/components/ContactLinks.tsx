import { toWhatsAppNumber } from "@/lib/whatsapp";
import {
  DEFAULT_OUTREACH_MESSAGE,
  DEFAULT_OUTREACH_SUBJECT,
  personalizeMessage,
} from "@/lib/message";

interface ContactLinksProps {
  phone: string | null;
  email: string | null;
  siret?: string | null;
  name?: string;
  address?: string | null;
  className?: string;
}

/**
 * Les données de Geoapify proviennent d'OpenStreetMap, qui manque souvent de
 * téléphone/email pour un établissement donné, même quand Google Maps les a
 * (la base de Google est propriétaire — l'utiliser exigerait l'API Places
 * payante, que ce projet évite délibérément). Plutôt que de prétendre que ce
 * manque n'existe pas, on affiche un lien de recherche Google Maps en un clic,
 * sans clé, pour que l'utilisateur vérifie lui-même et enregistre ce qu'il
 * trouve (voir l'affordance d'édition dans LeadTable).
 */

/**
 * Construit un lien mailto avec le destinataire, un objet et un message
 * pré-remplis pour la prospection.
 */
function buildMailtoHref(
  email: string,
  name?: string,
  address?: string | null,
): string {
  const subject = personalizeMessage(DEFAULT_OUTREACH_SUBJECT, { name });
  const body = [
    personalizeMessage(DEFAULT_OUTREACH_MESSAGE, { name }),
    "",
    ...[name, address].filter((v): v is string => Boolean(v)),
  ].join("\n");
  const params = new URLSearchParams({ subject, body });
  return `mailto:${email}?${params.toString()}`;
}

export default function ContactLinks({
  phone,
  email,
  siret,
  name,
  address,
  className = "",
}: ContactLinksProps) {
  const mapsQuery = [name, address].filter(Boolean).join(" ");
  const mapsUrl = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : null;
  const whatsapp = phone ? toWhatsAppNumber(phone) : null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${className}`}
    >
      {!phone && !email && (
        <p className="text-xs italic text-gray-400">Aucun contact renseigné</p>
      )}

      {phone && (
        <span className="inline-flex items-center gap-1.5">
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              title="Discuter sur WhatsApp"
              className="inline-flex items-center gap-1 text-gray-600 transition-colors hover:text-brand-700 dark:text-gray-300 dark:hover:text-brand-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-3.5 w-3.5 shrink-0"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              {phone}
            </a>
          ) : (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              title="Appeler"
              className="inline-flex items-center gap-1 text-gray-600 transition-colors hover:text-brand-700 dark:text-gray-300 dark:hover:text-brand-400"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5 shrink-0"
              >
                <path d="M3.654 1.328a.678.678 0 0 1 1.015-.063l2.223 2.222c.284.283.359.71.186 1.06l-1.15 2.3a1 1 0 0 0 .18 1.146l4.899 4.899a1 1 0 0 0 1.145.18l2.301-1.15a.678.678 0 0 1 1.06.187l2.222 2.222a.678.678 0 0 1-.063 1.015l-1.939 1.454a1.678 1.678 0 0 1-1.85.13C10.586 14.32 5.68 9.415 3.02 5.117a1.678 1.678 0 0 1 .13-1.85l1.454-1.939Z" />
              </svg>
              {phone}
            </a>
          )}
          {whatsapp && (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              title="Appeler ce numéro"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-brand-100 hover:text-brand-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-brand-900/40 dark:hover:text-brand-300"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5 shrink-0"
              >
                <path d="M3.654 1.328a.678.678 0 0 1 1.015-.063l2.223 2.222c.284.283.359.71.186 1.06l-1.15 2.3a1 1 0 0 0 .18 1.146l4.899 4.899a1 1 0 0 0 1.145.18l2.301-1.15a.678.678 0 0 1 1.06.187l2.222 2.222a.678.678 0 0 1-.063 1.015l-1.939 1.454a1.678 1.678 0 0 1-1.85.13C10.586 14.32 5.68 9.415 3.02 5.117a1.678 1.678 0 0 1 .13-1.85l1.454-1.939Z" />
              </svg>
            </a>
          )}
        </span>
      )}

      {email && (
        <a
          href={buildMailtoHref(email, name, address)}
          title="Écrire un email"
          className="inline-flex items-center gap-1 text-gray-600 transition-colors hover:text-brand-700 dark:text-gray-300 dark:hover:text-brand-400"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5 shrink-0"
          >
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
          className="inline-flex items-center gap-1 text-gray-400 transition-colors hover:text-brand-700 dark:text-gray-500 dark:hover:text-brand-400"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5 shrink-0"
          >
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
          className="inline-flex items-center gap-1 text-gray-400 transition-colors hover:text-brand-700 dark:text-gray-500 dark:hover:text-brand-400"
          title="Fiche officielle Annuaire des Entreprises (data.gouv.fr)"
        >
          SIRET {siret}
        </a>
      )}
    </div>
  );
}
