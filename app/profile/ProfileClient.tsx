"use client";

import { useState } from "react";
import Navbar from "@/app/components/Navbar";
import { createClient } from "@/lib/supabase";
import type { UsageInfo } from "@/lib/types";

interface ProfileClientProps {
  email: string;
  memberSince: string | null;
  usage: UsageInfo;
}

export default function ProfileClient({ email, memberSince, usage }: ProfileClientProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const quotaPct = usage.limit > 0 ? Math.min(100, Math.round((usage.searchCount / usage.limit) * 100)) : 0;
  const quotaLow = usage.remaining <= 2;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNewPassword("");
    setConfirm("");
    setSuccess("Mot de passe mis à jour avec succès.");
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800">Mon profil</h1>
        <p className="mt-0.5 text-sm text-gray-500">Gérez vos informations de compte.</p>

        <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800">Informations du compte</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500">Email</dt>
              <dd className="mt-0.5 font-medium text-gray-800">{email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Membre depuis</dt>
              <dd className="mt-0.5 font-medium text-gray-800">{memberSinceLabel ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500">Quota de recherches ({usage.period})</p>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${quotaLow ? "bg-amber-500" : "bg-brand-500"}`}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-gray-600">
                {usage.searchCount} / {usage.limit}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-800">Changer le mot de passe</h2>
          <p className="mt-1 text-xs text-gray-500">
            Vous êtes déjà connecté : le changement est appliqué immédiatement, sans email de confirmation.
          </p>

          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nouveau mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {error && <p className="animate-fade-in-up text-sm text-red-600">{error}</p>}
            {success && <p className="animate-fade-in-up text-sm text-green-600">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 sm:w-auto"
            >
              {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
