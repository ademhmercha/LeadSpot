"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lead, MessageTemplate } from "@/lib/types";
import { MESSAGE_PLACEHOLDERS, personalizeMessage } from "@/lib/message";
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

const DEFAULT_EMAIL_SUBJECT = "Proposition de site web";
const DEFAULT_MESSAGE =
  "Bonjour,\n\nNous accompagnons les entreprises locales comme {{name}} dans la création de leur site web.\n\nSouhaitez-vous en discuter ?";

export default function MessageComposer({ leads, onClose, onSent }: MessageComposerProps) {
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateSel, setTemplateSel] = useState<string>("new");
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

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

  const overrideCount = Object.keys(overrides).length;
  const hasNamePlaceholder = /\{\{\s*name\s*\}\}/.test(message);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      try {
        const res = await fetch(`/api/templates?channel=${channel}`);
        const data = await res.json();
        if (!cancelled && res.ok) setTemplates(data.templates ?? []);
      } catch {
        // La liste des modèles est optionnelle — on ne bloque pas le composeur.
      }
    }
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [channel]);

  function leadVars(lead: Lead): Record<string, string | null> {
    return {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      website: lead.website,
      siret: lead.siret,
      category: lead.category,
    };
  }

  function baseMessageFor(lead: Lead): string {
    return personalizeMessage(message, leadVars(lead));
  }

  /** Message final d'un lead : version personnalisée, ou son édition manuelle. */
  function finalMessageFor(lead: Lead): string {
    return overrides[lead.id] ?? baseMessageFor(lead);
  }

  function switchChannel(next: Channel) {
    setChannel(next);
    setOverrides({});
    setEditingId(null);
    setTemplateSel("new");
  }

  function applyTemplate(id: string) {
    setTemplateSel(id);
    setOverrides({});
    setEditingId(null);
    if (id === "new") {
      setMessage("");
      if (channel === "email") setSubject(DEFAULT_EMAIL_SUBJECT);
      return;
    }
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setMessage(tpl.message);
    if (channel === "email") setSubject(tpl.subject ?? "");
  }

  async function saveTemplate() {
    if (!templateName.trim() || !message.trim()) return;
    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          channel,
          subject: channel === "email" ? subject : undefined,
          message,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates((prev) => [data.template, ...prev]);
        setTemplateSel(data.template.id);
        setShowTemplateSave(false);
        setTemplateName("");
      } else {
        setTemplateError(data.error ?? "Erreur lors de la sauvegarde");
      }
    } catch {
      setTemplateError("Impossible de contacter le serveur");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Supprimer ce modèle ?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (templateSel === id) setTemplateSel("new");
    }
  }

  function insertPlaceholder(token: string) {
    const el = textareaRef.current;
    if (!el) {
      setMessage((prev) => (prev ? `${prev} ${token}` : token));
      return;
    }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? start;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
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
          ...(channel === "email" ? { subject } : {}),
          recipients: recipients.map((r) => {
            const lead = leads.find((l) => l.id === r.id)!;
            return { leadId: r.id, message: finalMessageFor(lead) };
          }),
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
        className="animate-fade-in-up max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
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
                onClick={() => switchChannel("email")}
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
                onClick={() => switchChannel("whatsapp")}
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
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Modèle</label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={templateSel}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="new">— Nouveau message —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateSave((v) => !v);
                    setTemplateError(null);
                  }}
                  className="rounded-lg border border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 transition-all duration-150 hover:bg-brand-50 dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-900/30"
                >
                  {showTemplateSave ? "Annuler" : "Sauvegarder comme modèle"}
                </button>
                {templateSel !== "new" && (
                  <button
                    type="button"
                    onClick={() => deleteTemplate(templateSel)}
                    className="text-sm font-medium text-red-500 transition-colors hover:underline"
                  >
                    Supprimer
                  </button>
                )}
              </div>
              {showTemplateSave && (
                <div className="animate-fade-in-up mt-2 flex gap-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nom du modèle (ex : Premier contact)"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={saveTemplate}
                    disabled={savingTemplate || !templateName.trim() || !message.trim()}
                    className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 disabled:opacity-60"
                  >
                    {savingTemplate ? "Sauvegarde..." : "Enregistrer"}
                  </button>
                </div>
              )}
              {templateError && (
                <p className="animate-fade-in-up mt-1.5 text-xs text-red-600 dark:text-red-400">{templateError}</p>
              )}
            </div>

            <div className="mb-1">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className={inputClass}
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">Insérer :</span>
                {MESSAGE_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.token}
                    type="button"
                    onClick={() => insertPlaceholder(p.token)}
                    title={`Insérer ${p.token}`}
                    className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500 dark:hover:bg-brand-900/30 dark:hover:text-brand-300"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Les coordonnées ({MESSAGE_PLACEHOLDERS[1].token}, {MESSAGE_PLACEHOLDERS[2].token}...) sont remplacées
                automatiquement par celles de chaque destinataire — rien à écrire manuellement.
              </p>
            </div>

            {channel === "email" && (
              <p className="mb-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                Chaque destinataire recevra un email individuel (jamais d&apos;envoi groupé).
              </p>
            )}

            {recipients.length > 0 && (
              <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Relecture — {recipients.length} destinataire{recipients.length > 1 ? "s" : ""} (message
                    personnalisé)
                  </p>
                  {overrideCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOverrides({});
                        setEditingId(null);
                      }}
                      className="text-xs font-medium text-brand-600 transition-colors hover:underline dark:text-brand-400"
                    >
                      Réinitialiser les modifications
                    </button>
                  )}
                </div>
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {recipients.map((r) => {
                    const lead = leads.find((l) => l.id === r.id)!;
                    const isEditing = editingId === lead.id;
                    const final = finalMessageFor(lead);
                    const waNumber = channel === "whatsapp" ? toWhatsAppNumber(r.value) : null;
                    return (
                      <li
                        key={r.id}
                        className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                            {lead.name}
                            <span className="ml-1 font-normal text-gray-400 dark:text-gray-500">({r.value})</span>
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            {channel === "whatsapp" && waNumber && (
                              <a
                                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(final)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-brand-600 underline underline-offset-2 dark:text-brand-400"
                              >
                                Ouvrir
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingId(isEditing ? null : lead.id)}
                              className="text-xs font-medium text-gray-500 transition-colors hover:text-brand-700 dark:text-gray-400 dark:hover:text-brand-400"
                            >
                              {isEditing ? "Fermer" : "Éditer"}
                            </button>
                          </div>
                        </div>
                        {isEditing ? (
                          <textarea
                            value={final}
                            onChange={(e) => setOverrides((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            rows={4}
                            className={`${inputClass} mt-2`}
                          />
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">{final}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {channel === "whatsapp" && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    WhatsApp n&apos;a pas d&apos;API gratuite d&apos;envoi automatique : ouvrez chaque lien, le message
                    est déjà pré-rempli avec les données du lead.
                  </p>
                )}
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
