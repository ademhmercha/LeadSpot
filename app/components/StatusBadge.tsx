import type { LeadStatus } from "@/lib/types";
import { LEAD_STATUS_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<LeadStatus, string> = {
  nouveau: "bg-blue-100 text-blue-800",
  contacte: "bg-amber-100 text-amber-800",
  interesse: "bg-purple-100 text-purple-800",
  converti: "bg-green-100 text-green-800",
  pas_interesse: "bg-gray-200 text-gray-600",
};

export default function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}
