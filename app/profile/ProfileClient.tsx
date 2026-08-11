"use client";

import { useState } from "react";
import Navbar from "@/app/components/Navbar";
import PushSetup from "@/app/components/PushSetup";
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
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

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
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirm) {
      setPasswordError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setPasswordLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);

    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }

    setNewPassword("");
    setConfirm("");
    setPasswordSuccess("Mot de passe mis à jour avec succès.");
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (newEmail === email) {
      setEmailError("Le nouvel email est identique à l'actuel.");
      return;
    }

    setEmailLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/profile` }
    );
    setEmailLoading(false);

    if (updateError) {
      setEmailError(updateError.message);
      return;
    }

    setNewEmail("");
    setEmailSuccess(`Un email de confirmation a été envoyé à ${newEmail}. Cliquez sur le lien pour valider le changement.`);
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Mon profil</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Gérez vos informations de compte.</p>

        <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Informations du compte</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="mt-0.5 font-medium text-gray-800 dark:text-gray-100">{email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Membre depuis</dt>
              <dd className="mt-0.5 font-medium text-gray-800 dark:text-gray-100">{memberSinceLabel ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Quota de recherches ({usage.period})</p>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all ${quotaLow ? "bg-amber-500" : "bg-brand-500"}`}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs text-gray-600 dark:text-gray-300">
                {usage.searchCount} / {usage.limit}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Changer l&apos;adresse email</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Un email de confirmation vous sera envoyé à la nouvelle adresse pour valider le changement.
          </p>

          <form onSubmit={handleEmailSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nouvelle adresse email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {emailError && <p className="animate-fade-in-up text-sm text-red-600 dark:text-red-400">{emailError}</p>}
            {emailSuccess && (
              <p className="animate-fade-in-up text-sm text-green-600 dark:text-green-400">{emailSuccess}</p>
            )}

            <button
              type="submit"
              disabled={emailLoading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 sm:w-auto"
            >
              {emailLoading ? "Envoi de la confirmation..." : "Mettre à jour l'email"}
            </button>
          </form>
        </section>

        <PushSetup />

        <section className="mt-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6 dark:bg-gray-900 dark:ring-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Changer le mot de passe</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Vous êtes déjà connecté : le changement est appliqué immédiatement, sans email de confirmation.
          </p>

          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {passwordError && <p className="animate-fade-in-up text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
            {passwordSuccess && (
              <p className="animate-fade-in-up text-sm text-green-600 dark:text-green-400">{passwordSuccess}</p>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 sm:w-auto"
            >
              {passwordLoading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
