"use client";

import { useMemo, useState } from "react";
import type { Lead } from "@/lib/types";
import { personalizeMessage } from "@/lib/message";
import { toWhatsAppNumber } from "@/lib/whatsapp";

type Channel = "email" | "whatsapp";

interface MessageComposerProps {
  leads: Lead[];
  onClose: () => void;
  onSent: (sentLeadIds: string[]) => void;
}

interface SendResponse {
  sent: number;
  skipped: number;
  sentLeadIds: string[];
  error?: string;
}

const DEFAULT_MESSAGE =
  "Bonjour,\n\nNous accompagnons les entreprises locales comme {{name}} dans la création de leur site web.\n\nSouhaitez-vous en discuter ?";

export default function MessageComposer({ leads, onClose, onSent }: MessageComposerProps) {
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("Proposition de site web");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResponse | null>(null);

  const recipients = useMemo(() => {
    if (channel === "email") {
      return leads
        .filter((l) => l.email)
        .map((l) => ({ id: l.id, name: l.name, value: l.email! }));
    }
    return leads
      .filter((l) => l.phone && toWhatsAppNumber(l.phone))
      .map((l) => ({ id: l.id, name: l.name, value: l.phone! }));
  }, [channel, leads]);

  const hasNamePlaceholder = /\{\{\s*name\s*\}\}/.test(message);

  function previewFor(lead: Lead): string {
    return personalizeMessage(message, { name: lead.name, address: lead.address });
  }

  async function handleSend() {
    if (recipients.length === 0) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          leadIds: recipients.map((r) => r.id),
          ...(channel === "email" ? { subject, message } : { message }),
        }),
      });
      const data = (await res.json()) as SendResponse;
      if (!res.ok && data.error) setError(data.error);
      setResult(data);
      if (data.sentLeadIds?.length) onSent(data.sentLeadIds);
    } catch {
      setError("Impossible de contacter le serveur");
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-fade-in-up max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Contacter {recipients.length} lead{recipients.length > 1 ? "s" : ""}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {!result ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                  channel === "email"
                    ? "bg-white text-brand-700 shadow-sm dark:bg-gray-600 dark:text-brand-300"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                Par email
              </button>
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                  channel === "whatsapp"
                    ? "bg-white text-brand-700 shadow-sm dark:bg-gray-600 dark:text-brand-300"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                WhatsApp
              </button>
            </div>

            {channel === "email" && (
              <div className="mb-3">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Objet</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
              </div>
            )}

            <div className="mb-1">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Personnalisez avec <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{"{{name}}"}</code> (nom
                du lead) et <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{"{{address}}"}</code> (adresse).
              </p>
            </div>

            {channel === "email" && (
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                Chaque destinataire recevra un email individuel (jamais d&apos;envoi groupé).
              </p>
            )}

            {channel === "whatsapp" && (
              <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                  Aperçu des messages — ouvrez chaque lien pour l&apos;envoyer depuis votre WhatsApp :
                </p>
                <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                  {recipients.map((r) => {
                    const lead = leads.find((l) => l.id === r.id)!;
                    const waNumber = toWhatsAppNumber(r.value);
                    const text = previewFor(lead);
                    return waNumber ? (
                      <li key={r.id} className="text-xs text-gray-600 dark:text-gray-400">
                        <a
                          href={`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-brand-600 underline underline-offset-2 dark:text-brand-400"
                        >
                          {r.name}
                        </a>
                        <span className="ml-1 text-gray-400 dark:text-gray-500">({r.value})</span>
                      </li>
                    ) : null;
                  })}
                </ul>
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  WhatsApp n&apos;a pas d&apos;API gratuite d&apos;envoi automatique : les liens s&apos;ouvrent un par un,
                  le message est déjà pré-rempli.
                </p>
              </div>
            )}

            {error && <p className="animate-fade-in-up mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {recipients.length === 0 && (
              <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">
                Aucun lead sélectionné ne dispose{" "}
                {channel === "email" ? "d'une adresse email" : "d'un numéro WhatsApp"}.
              </p>
            )}
            {!hasNamePlaceholder && (
              <p className="mb-3 text-xs text-gray-400 dark:text-gray-500">
                Astuce : ajoutez {"{{name}}"} dans le message pour le personnaliser avec le nom de chaque lead.
              </p>
            )}

            <button
              onClick={handleSend}
              disabled={sending || recipients.length === 0}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            >
              {sending
                ? "Envoi en cours..."
                : channel === "email"
                  ? `Envoyer ${recipients.length} email${recipients.length > 1 ? "s" : ""} individuel${recipients.length > 1 ? "s" : ""}`
                  : "J'ai envoyé les messages — marquer comme contactés"}
            </button>
          </>
        ) : (
          <div className="animate-fade-in-up space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {result.sent} envoi{result.sent > 1 ? "s" : ""} réussi{result.sent > 1 ? "s" : ""}
              </span>
              {result.skipped > 0 && (
                <span className="text-gray-500"> — {result.skipped} sans coordonnée ou en échec</span>
              )}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Les leads envoyés ont été marqués comme « Contactés ».
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98]"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
