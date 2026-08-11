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
3. Cron QStash (optionnel en local) : `QSTASH_TOKEN=... NEXT_PUBLIC_APP_URL=<URL publique> npx tsx scripts/setup-qstash.ts`. Nécessite une URL publique (ngrok ok) ; inutile contre `localhost`.

## Architecture
- `app/` — App Router : pages (`(auth)`, `search`, `dashboard`) + route handlers dans `app/api/*` (search, leads, saved-zones, usage, keepalive, cron/rescan).
- `lib/` — toute la logique métier et les clients externes : `supabase.ts` (client navigateur), `supabase-server.ts` (client serveur anon + service role), `geoapify.ts`, `redis.ts`, `usage.ts`, `resend.ts`, `qstash.ts`, `qstash-verify.ts`, `types.ts`.
- `supabase/schema.sql` — schéma DB (tables, RLS, fonctions/triggers).
- `scripts/setup-qstash.ts` — enregistre les 2 schedules QStash.
- `terraform/` — infra dev/staging/prod (voir section ci-dessous).

## Conventions critiques
- **Détection de lead** : un établissement est un lead si `isSocialOnlyOrMissing(website)` est vrai (pas de site, ou domaine facebook.com/instagram.com uniquement) — `lib/geoapify.ts:15`. C'est la règle métier centrale.
- **Deux clients Supabase serveur** : le client anon (RLS appliquée, session de l'utilisateur) pour tout ce qui est lié à la requête ; le **service role** (`createServiceRoleClient`) contourne RLS — uniquement depuis des contextes serveur de confiance (cron, quota, upsert des leads) et toujours en filtrant explicitement par `user_id`.
- **Quota utilisateur** : par défaut 10 recherches/mois (`FREE_TIER_MONTHLY_SEARCH_LIMIT`), incrémenté atomiquement via le RPC Postgres `increment_usage` (`lib/usage.ts`, `supabase/schema.sql:178`). Vérifié **avant** tout appel Geoapify dans `app/api/search/route.ts`.
- **Cache de recherche** : Upstash Redis, TTL 7 jours, clé = `leadspot:search:<categorie>:<lat,lon arrondis à 3 décimales>:<rayon>` (`lib/redis.ts`). Les résultats bruts sont cachés **avant** le filtrage lead pour maximiser le cache.
- **Status des leads** : enum Postgres + `lib/types.ts`, en français **sans accents** : `nouveau`, `contacte`, `interesse`, `converti`, `pas_interesse` (les libellés affichés ont les accents).
- **Tuiles carte** : jamais de tuiles OSM directes en prod — utiliser la clé `NEXT_PUBLIC_MAP_TILES_API_KEY` (MapTiler/Stadia).
- **Vérification QStash** (`lib/qstash-verify.ts`) : désactivée si les signing keys ne sont pas configurées (dev local) — **ne pas les laisser absentes en prod**.
- **Contrainte de conception** : tous les services ont un free tier **sans carte bancaire** (Geoapify, pas Google Places). Ne pas introduire de service qui en exige un.
- Middleware (`middleware.ts`) : pages protégées par session ; routes publiques = `/login`, `/signup`, `/api/keepalive`, `/api/cron/rescan`. Les routes API vérifient elles-mêmes l'auth.

## Terraform
- `terraform/environments/{dev,staging,prod}/` : **root modules indépendants** (chacun son `init`, sa state). Les `providers.tf` / `backend.tf` à la racine de `terraform/` sont des **templates de référence**, pas exécutés — à copier quand on ajoute un environnement.
- **State** : backend local dans un repo Git privé **séparé** (`leadspot-terraform-state`, dossier voisin), jamais commité ici. Après chaque `apply` réussi, committer/pousser le state dans ce repo séparé.
- **Verrouillage manuel** : pas de locking auto — ne jamais lancer deux `apply` en parallèle sur le même environnement ; faire un `git pull` du repo de state avant chaque plan/apply.
- `environments/<env>/terraform.tfvars` est gitignoré (copier depuis `.tfvars.example`). En CI, les secrets sont des GitHub Actions Secrets préfixés par environnement (ex. `PROD_SUPABASE_SERVICE_ROLE_KEY`).
- **QStash n'est pas géré par Terraform** (pas de ressource provider) : les schedules sont créés via `scripts/setup-qstash.ts`. Supabase n'est pas créé par Terraform non plus (dashboard manuel).
- CI (`.github/workflows/terraform.yml`) : `plan` commenté sur chaque PR (dev/staging/prod), `apply` sur `prod` au merge sur `main`.

## Déploiement
Appli déployée via l'intégration Git Vercel ; l'infra (projet Vercel, env vars, Redis) via Terraform. Le schéma Supabase est appliqué manuellement pour chaque environnement cible. Détails dans `README.md` et `terraform/README.md`.
