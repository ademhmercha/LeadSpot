export type LeadStatus =
  | "nouveau"
  | "contacte"
  | "interesse"
  | "converti"
  | "pas_interesse";

export const LEAD_STATUSES: LeadStatus[] = [
  "nouveau",
  "contacte",
  "interesse",
  "converti",
  "pas_interesse",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  interesse: "Intéressé",
  converti: "Converti",
  pas_interesse: "Pas intéressé",
};

export interface Lead {
  id: string;
  user_id: string;
  place_id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number | null;
  lon: number | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  website: string | null;
  search_category: string;
  search_zone: string;
  search_radius_km: number;
  status: LeadStatus;
  notes: string | null;
  email_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedZone {
  id: string;
  user_id: string;
  category: string;
  zone_label: string;
  lat: number;
  lon: number;
  radius_km: number;
  alerts_enabled: boolean;
  last_scanned_at: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  channel: "email" | "whatsapp";
  subject: string | null;
  message: string;
  created_at: string;
  updated_at: string;
}

export type LeadEventType = "created" | "status_changed" | "sent" | "opened" | "merged";

export interface LeadEvent {
  id: string;
  user_id: string;
  lead_id: string;
  type: LeadEventType;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const LEAD_EVENT_LABELS: Record<LeadEventType, string> = {
  created: "Lead créé",
  status_changed: "Statut modifié",
  sent: "Message envoyé",
  opened: "Email ouvert",
  merged: "Doublon fusionné",
};

export interface Audit {
  id: string;
  user_id: string;
  lead_id: string;
  created_at: string;
}

export interface GeoapifyPlace {
  place_id: string;
  name: string;
  category: string;
  address: string | null;
  lat: number;
  lon: number;
  phone: string | null;
  email: string | null;
  siret: string | null;
  website: string | null;
}

export interface SearchParams {
  category: string;
  zoneLabel: string;
  lat: number;
  lon: number;
  radiusKm: number;
}

export interface UsageInfo {
  period: string;
  searchCount: number;
  limit: number;
  remaining: number;
}
