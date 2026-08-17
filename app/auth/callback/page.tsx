"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

type CallbackState =
  | { status: "processing" }
  | { status: "success" }
  | { status: "error"; message: string };

/**
 * Page d'atterrissage du lien de confirmation envoyé par Supabase Auth.
 * Échange le code (flow PKCE) — ou les jetons du fragment (flow implicite) —
 * pour activer la session, puis affiche une confirmation de vérification du
 * compte avec un message de bienvenue.
 */
function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>({ status: "processing" });

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const supabase = createClient();

      const urlError = searchParams.get("error");
      const urlErrorDescription = searchParams.get("error_description");
      if (urlError) {
        setState({
          status: "error",
          message: urlErrorDescription ?? "La vérification du compte a échoué.",
        });
        return;
      }

      try {
        // Flow PKCE (défaut avec @supabase/ssr) : la confirmation redirige vers
        // /auth/callback?code=...
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          // Fallback flow implicite : jetons dans le fragment d'URL
          // (#access_token=...&refresh_token=...&type=signup).
          const hash = window.location.hash.replace(/^#/, "");
          const params = new URLSearchParams(hash);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (!accessToken || !refreshToken) {
            setState({
              status: "error",
              message: "Lien de vérification invalide ou expiré.",
            });
            return;
          }
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        if (!cancelled) setState({ status: "success" });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Erreur lors de la vérification du compte. Veuillez réessayer.",
          });
        }
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  function goToDashboard() {
    router.refresh();
    router.push("/dashboard");
  }

  useEffect(() => {
    if (state.status !== "success") return;
    const timer = setTimeout(goToDashboard, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
        <img
          src="/icons/logo-small.png"
          alt="Logo LeadSpot"
          width={48}
          height={48}
          className="mx-auto h-12 w-12 rounded-xl"
        />

        {state.status === "processing" && (
          <>
            <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <h1 className="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-100">
              Vérification de votre compte
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Un instant, nous activons votre accès...
            </p>
          </>
        )}

        {state.status === "success" && (
          <>
            <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-lg font-semibold text-brand-700 dark:text-brand-400">
              Vérification terminée !
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Bienvenue sur <strong>LeadSpot</strong>. Votre compte est activé :
              vous pouvez maintenant explorer les établissements locaux sans
              site web et lancer vos prospections.
            </p>
            <button
              onClick={goToDashboard}
              className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Accéder à mon espace
            </button>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Redirection automatique dans quelques secondes...
            </p>
          </>
        )}

        {state.status === "error" && (
          <>
            <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-6 w-6 text-red-600 dark:text-red-400"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-800 dark:text-gray-100">
              Vérification impossible
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {state.message}
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block w-full rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50 dark:border-brand-500 dark:text-brand-300 dark:hover:bg-brand-900/30"
            >
              Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackContent />
    </Suspense>
  );
}
