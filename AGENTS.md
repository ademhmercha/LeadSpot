# AGENTS.md — LeadSpot

Outil de prospection : trouve les établissements locaux **sans site web** (ou avec une page Facebook/Instagram seule). Next.js 14 App Router + TypeScript + Tailwind.

## Langue du projet
Commentaires de code, UI, messages d'erreur, statuts et README sont **en français** — respecter cette convention (y compris dans les nouveaux code).

## Commandes
- `npm run dev` — serveur local (port 3000). Aucun test dans le repo ; aucune commande de test.
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `next lint`
- `npm run build`
- Alias d'import `@/*` → racine du projet (ex. `@/lib/supabase-server`).

## Setup local
1. `npm install`, puis `cp .env.example .env.local` et remplir. `.env.local` est gitignoré — **toute nouvelle variable d'env doit être documentée dans `.env.example`**.
2. Créer le projet Supabase manuellement via le dashboard (jamais via Terraform), puis exécuter `supabase/schema.sql` dans le SQL Editor. Le schéma est **idempotent** (re-runnable sans danger) ; il n'y a pas de CLI Supabase ni de dossier migrations — c'est le seul fichier de schéma.
3. Notifications push (optionnel) : clés VAPID générées localement via `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (`lib/webpush.ts`).
4. Cron QStash (optionnel en local) : `QSTASH_TOKEN=... NEXT_PUBLIC_APP_URL=<URL publique> npx tsx scripts/setup-qstash.ts`. Nécessite une URL publique (ngrok ok) ; inutile contre `localhost`.

## Architecture
- `app/` — App Router : pages `(auth)` (login/signup), `search`, `dashboard`, `leads/[id]` (fiche + historique), `profile`, et **`audit/[id]` (publique)** + route handlers dans `app/api/*` (search, leads, leads/export, leads/track, campaigns, templates, saved-zones, audits, push, usage, keepalive, cron/rescan).
- `lib/` — logique métier et clients externes : `supabase.ts` (client navigateur), `supabase-server.ts` (clients serveur anon + service role), `geoapify.ts`, `redis.ts`, `usage.ts`, `leads-store.ts`, `lead-events.ts`, `message.ts`, `tracking.ts`, `resend.ts`, `whatsapp.ts`, `webpush.ts`, `qstash.ts`, `qstash-verify.ts`, `types.ts`.
- `supabase/schema.sql` — schéma DB (tables, RLS, fonctions/triggers).
- `scripts/setup-qstash.ts` — enregistre les 2 schedules QStash (rescan hebdo + keepalive ; cadence dans `lib/qstash.ts`).
- `terraform/` — infra dev/staging/prod (voir section ci-dessous).

## Conventions critiques
- **Détection de lead** : un établissement est un lead si `isSocialOnlyOrMissing(website)` est vrai (pas de site, ou domaine facebook.com/instagram.com uniquement) — `lib/geoapify.ts`. C'est la règle métier centrale.
- **Stockage des leads** (`lib/leads-store.ts`) : seuls les établissements **contactables (téléphone OU email)** sont enregistrés. Déduplication : même `place_id` → complétion des seuls champs manquants (statut/notes/zone d'origine conservés) ; même nom + même ville avec un autre `place_id` → fusion. Insertions et fusions loggées dans `lead_events` (`created`/`merged`).
- **Deux clients Supabase serveur** : le client anon (RLS appliquée, session de l'utilisateur) pour tout ce qui est lié à la requête ; le **service role** (`createServiceRoleClient`) contourne RLS — uniquement depuis des contextes serveur de confiance (cron, quota, upsert/events des leads, pixel de tracking) et toujours en filtrant explicitement par `user_id`.
- **Quota utilisateur** : 10 recherches/mois par défaut (`FREE_TIER_MONTHLY_SEARCH_LIMIT`), incrémenté atomiquement via le RPC Postgres `increment_usage` (`lib/usage.ts`, `supabase/schema.sql`). Vérifié **avant** tout appel Geoapify dans `app/api/search/route.ts`. Le cron de rescan (`app/api/cron/rescan/route.ts`) **contourne ce quota** (job de fond) mais pas le cache Redis.
- **Cache de recherche** : Upstash Redis, TTL 7 jours, clé = `leadspot:search:<categorie>:<lat,lon arrondis à 3 décimales>:<rayon>` (`lib/redis.ts`). Les résultats bruts sont cachés **avant** le filtrage lead pour maximiser le cache.
- **Envoi de campagne** (`app/api/campaigns/route.ts`) : un email **individuel par destinataire via Resend, jamais de CCI**, max 50 destinataires, passage au statut `contacte` + événement `sent`. Canal WhatsApp = passage au statut `contacte` uniquement (liens `wa.me` ouverts par l'utilisateur, `lib/whatsapp.ts`).
- **Suivi d'ouverture** : pixel auto-hébergé à `/api/leads/track` (route publique, signée HMAC-SHA256 avec `SUPABASE_SERVICE_ROLE_KEY` comme clé — `lib/tracking.ts`). Première ouverture → `email_opened_at` + passage à `interesse` si le lead était `contacte`. Sans `NEXT_PUBLIC_APP_URL`, aucun pixel n'est ajouté aux emails.
- **Modèles de messages** : placeholders `{{name}}`, `{{email}}`, `{{phone}}`, `{{address}}`, `{{website}}`, `{{siret}}`, `{{category}}` remplacés automatiquement par les données du lead (`lib/message.ts`).
- **Status des leads** : enum Postgres + `lib/types.ts`, en français **sans accents** : `nouveau`, `contacte`, `interesse`, `converti`, `pas_interesse` (les libellés affichés ont les accents).
- **Tuiles carte** : jamais de tuiles OSM directes en prod — utiliser la clé `NEXT_PUBLIC_MAP_TILES_API_KEY` (MapTiler/Stadia).
- **Vérification QStash** (`lib/qstash-verify.ts`) : désactivée si les signing keys ne sont pas configurées (dev local) — **ne pas les laisser absentes en prod**.
- **Contrainte de conception** : tous les services ont un free tier **sans carte bancaire** (Geoapify, pas Google Places). Ne pas introduire de service qui en exige un.
- Middleware (`middleware.ts`) : pages protégées par session ; routes publiques = `/login`, `/signup`, `/audit` (lien d'audit public — l'uuid du lien sert de token non devinable), `/api/keepalive`, `/api/cron/rescan`. Les routes API vérifient elles-mêmes l'auth.

## Terraform
- `terraform/environments/{dev,staging,prod}/` : **root modules indépendants** (chacun son `init`, sa state). Les `providers.tf` / `backend.tf` à la racine de `terraform/` sont des **templates de référence**, pas exécutés — à copier quand on ajoute un environnement.
- **State** : backend local dans un repo Git privé **séparé** (`leadspot-terraform-state`, dossier voisin), jamais commité ici. Après chaque `apply` réussi, committer/pousser le state dans ce repo séparé.
- **Verrouillage manuel** : pas de locking auto — ne jamais lancer deux `apply` en parallèle sur le même environnement ; faire un `git pull` du repo de state avant chaque plan/apply.
- `environments/<env>/terraform.tfvars` est gitignoré (copier depuis `.tfvars.example`). En CI, les secrets sont des GitHub Actions Secrets préfixés par environnement (ex. `PROD_SUPABASE_SERVICE_ROLE_KEY`).
- **QStash n'est pas géré par Terraform** (pas de ressource provider) : les schedules sont créés via `scripts/setup-qstash.ts`. Supabase n'est pas créé par Terraform non plus (dashboard manuel).
- CI (`.github/workflows/terraform.yml`) : `plan` commenté sur chaque PR (dev/staging/prod), `apply` sur `prod` au merge sur `main`.

## Déploiement
Appli déployée via l'intégration Git Vercel ; l'infra (projet Vercel, env vars, Redis) via Terraform. Le schéma Supabase est appliqué manuellement pour chaque environnement cible. Détails dans `README.md` et `terraform/README.md`.
