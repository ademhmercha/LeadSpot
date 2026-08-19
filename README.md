# LeadSpot

Outil de prospection pour freelances/agences web : trouve les établissements locaux (restaurants, cafés, salons de coiffure, etc.) **sans site web** — ou avec seulement une page Facebook/Instagram — dans une zone géographique donnée.



## Contrainte de conception

**100% des services utilisés ont un free tier utilisable sans carte bancaire.** En particulier, l'app utilise **Geoapify Places API** et non Google Places API (qui exige une CB dès l'activation, même pour rester dans le free tier).

## Sommaire

- [Stack technique](#stack-technique)
- [Fonctionnement](#fonctionnement)
- [Setup local](#setup-local)
- [Docker & Kubernetes](#docker--kubernetes)
- [CI/CD](#cicd)
- [Déploiement](#déploiement)
- [Limites des free tiers (à vérifier périodiquement)](#limites-des-free-tiers-à-vérifier-périodiquement)
- [Points de vigilance](#points-de-vigilance)
- [Infrastructure Terraform](#infrastructure-terraform)

## Stack technique

| Besoin | Service | Free tier sans CB |
|---|---|---|
| Frontend/Backend | Next.js 14 (App Router) + TypeScript + Tailwind | — (auto-hébergé) |
| Auth + Base de données | [Supabase](https://supabase.com/pricing) (Postgres) | Oui |
| Recherche d'établissements | [Geoapify Places API](https://www.geoapify.com/pricing/) | Oui |
| Cache de recherche (7 jours) | [Upstash Redis](https://upstash.com/pricing) | Oui |
| Cron (rescan hebdo + keepalive) | [Upstash QStash](https://upstash.com/pricing) | Oui |
| Emails d'alerte | [Resend](https://resend.com/pricing) | Oui |
| Tuiles de carte | [MapTiler](https://www.maptiler.com/cloud/pricing/) (ou Stadia Maps) | Oui, avec clé |
| Hébergement | [Vercel Hobby](https://vercel.com/pricing) | Oui, **usage non-commercial** |
| Conteneurisation | Docker (multi-stage build) | — (auto-hébergé) |
| Orchestration locale | Minikube + Helm | — (local) |
| CD Pipeline | GitHub Actions (self-hosted runner) | — (local) |

## Fonctionnement

1. **Recherche** : l'utilisateur choisit une catégorie d'établissement + une zone (ville ou coordonnées) + un rayon (1-50 km).
2. L'app interroge **Geoapify Places API** pour lister les établissements de cette catégorie dans la zone.
3. Les résultats bruts sont **mis en cache dans Upstash Redis pendant 7 jours** (clé = catégorie + coordonnées arrondies + rayon), pour économiser le quota gratuit Geoapify (3000 requêtes/jour).
4. Pour chaque résultat, le champ `website` est examiné : un établissement est retenu comme **lead** s'il n'a **aucun site web**, ou si son seul lien est une page **facebook.com/instagram.com** (détecté par regex sur le domaine — voir `lib/geoapify.ts`).
5. Les leads sont stockés dans Postgres (Supabase), avec un statut (`nouveau` → `contacté` → `intéressé` → `converti` / `pas intéressé`), des notes libres, et peuvent être exportés en CSV.
6. Un **quota mensuel de recherches par utilisateur** (10/mois par défaut, configurable via `FREE_TIER_MONTHLY_SEARCH_LIMIT`) protège le quota gratuit Geoapify.
7. **Alertes hebdomadaires** : une tâche cron (QStash) re-scanne chaque semaine les zones sauvegardées par l'utilisateur et envoie un email (Resend) s'il trouve de nouveaux leads.
8. **Keep-alive Supabase** : une route légère (`/api/keepalive`) fait un `SELECT 1` déclenché par QStash tous les 3-4 jours, pour éviter que le projet Supabase gratuit ne soit mis en pause après ~7 jours d'inactivité.

## Setup local

### 1. Prérequis

- Node.js 18+
- Un compte gratuit sur chaque service listé ci-dessus (aucun n'exige de CB) :
  - [Supabase](https://supabase.com) — créer un projet (dashboard, ~2 min)
  - [Geoapify](https://www.geoapify.com/) — créer une clé API
  - [Upstash](https://upstash.com/) — créer une base Redis + un compte QStash
  - [Resend](https://resend.com/) — créer une clé API
  - [MapTiler](https://www.maptiler.com/) — créer une clé API (tuiles de carte)

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique (anon) Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role Supabase (⚠️ secrète, jamais exposée côté client) |
| `GEOAPIFY_API_KEY` | Clé API Geoapify Places |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Base Redis Upstash (cache de recherche) |
| `QSTASH_TOKEN` | Token QStash (cron) |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Signing keys QStash (vérification des webhooks cron — fortement recommandé en prod) |
| `RESEND_API_KEY` | Clé API Resend (emails d'alerte) |
| `NEXT_PUBLIC_MAP_TILES_API_KEY` | Clé API MapTiler (tuiles de carte) |
| `FREE_TIER_MONTHLY_SEARCH_LIMIT` | Quota de recherches par utilisateur/mois (défaut : `10`) |

### 4. Appliquer le schéma de base de données

Dans le SQL Editor du dashboard Supabase, exécuter le contenu de [`supabase/schema.sql`](supabase/schema.sql). Il crée les tables (`profiles`, `leads`, `saved_zones`, `usage`, `keepalive_pings`), les policies RLS, et les fonctions/triggers nécessaires (création auto de profil, incrément atomique du quota, `updated_at`).

### 5. Configurer l'URL du projet dans Supabase Auth

Dans le dashboard Supabase → **Authentication → URL Configuration**, renseigner :
- **Site URL** : `http://localhost:3000` (dev) ou l'URL du déploiement,
- **Redirect URLs** : ajouter `http://localhost:3000/**` (dev) ou `<URL>/auth/callback` pour l'environnement visé.

Sans cela, le lien de confirmation de l'email (envoyé par Supabase lors de l'inscription) redirige vers la Site URL par défaut du dashboard et peut afficher une erreur « localhost ne répond pas » — même si le compte est bien activé en base. L'application passe en plus `emailRedirectTo` → `/auth/callback` à l'inscription : cette page valide le compte et affiche un message de bienvenue.

### 6. Lancer l'app

```bash
npm run dev
```


## Docker & Kubernetes

### Dockerfile

Le projet utilise un **build multi-stage** (`Dockerfile`) :

- **Stage builder** : installe toutes les dépendances (dev + prod), compile l'app Next.js.
- **Stage production** : installe uniquement les dépendances prod, copie le build `.next/` et le dossier `public/`. Image finale minimale.

```bash
# Build
docker build -t leadspot:latest .

# Run
docker run -p 3000:3000 --env-file .env.local leadspot:latest
```

### Helm Chart

Le dossier `leadspot-chart/` contient le Helm chart pour déployer sur Kubernetes :

- **Deployment** : 1 replica, probes liveness/readiness, secrets injectés via `envFrom`
- **Service** : NodePort (port 30080 sur la machine hôte)
- **HPA** : Horizontal Pod Autoscaler (configurable)
- **Ressources** : limits (500m CPU, 512Mi RAM) et requests (100m CPU, 256Mi RAM)

```bash
# Déployer sur Minikube
helm install leadspot ./leadspot-chart

# Mettre à jour
helm upgrade --install leadspot ./leadspot-chart

# Supprimer
helm uninstall leadspot
```

### Minikube (Kubernetes local)

```bash
minikube start
# Pointer Docker vers Minikube
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
# Build l'image dans le daemon Minikube
docker build -t leadspot:latest .
# Déployer
helm install leadspot ./leadspot-chart
# Accéder à l'app
minikube service leadspot-leadspot-chart --url
```

## CI/CD

### CI (`.github/workflows/ci.yml`)

Lancé à chaque **push** ou **pull request** sur `main`, sur `ubuntu-latest` :

| # | Étape | Description |
|---|---|---|
| 1 | `actions/checkout@v4` | Clone du repo |
| 2 | `actions/setup-node@v4` | Node.js 20 + cache npm |
| 3 | `npm ci` | Installation des dépendances |
| 4 | `npm audit --audit-level=high` | Audit des vulnérabilités (non bloquant) |
| 5 | `npm run lint` | Linting (ESLint via Next.js) |
| 6 | `npm run format:check` | Vérification du formatage (Prettier) |
| 7 | `npm run typecheck` | Vérification des types TypeScript |
| 8 | `npm run test` | Tests unitaires/intégration |
| 9 | `npm run build` | Build de production (avec les secrets injectés comme env vars : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MAP_TILES_API_KEY`) |

### CD (`.github/workflows/cd.yml`)

Déclenché **automatiquement** quand le CI réussit sur `main` (`workflow_run`). Exécuté sur un **self-hosted runner** (machine locale Windows) :

| # | Étape | Description |
|---|---|---|
| 1 | `actions/checkout@v4` | Clone du code |
| 2 | `minikube start` | Démarrage du cluster Kubernetes local |
| 3 | `minikube docker-env` | Pointe Docker vers le daemon Minikube |
| 4 | `docker build` | Build de l'image `leadspot:latest` dans le daemon Minikube |
| 5 | `kubectl create secret` | Crée le secret `leadspot-env` avec les GitHub Actions Secrets |
| 6 | `helm upgrade --install` | Déploiement/mise à jour sur Minikube |
| 7 | `kubectl rollout status` | Vérifie que le rollout se termine |
| 8 | **Smoke test** | Port-forward + `Invoke-WebRequest` pour vérifier le status 200 |
| 9 | **Rollback** (`if: failure()`) | `helm rollback` automatique si le déploiement échoue |
| 10 | **Job Summary** (`if: always()`) | Rapport Markdown dans l'onglet Actions (repo, branch, commit, status, cluster, pods) |

### Setup du runner self-hosted

1. Aller dans **Settings → Actions → Runners** du repo GitHub
2. Créer un nouveau self-hosted runner (Windows)
3. Installer dans un dossier dédié (ex: `actions-runner-leadspot`)
4. Lancer le runner : `.\run.cmd`
5. Le runner reste ouvert et écoute les jobs

### Secrets GitHub requis

Ajouter dans **Settings → Secrets → Actions** les mêmes variables que `.env.local` (voir [Setup local](#3-configurer-les-variables-denvironnement)).

## Déploiement

Voir [`terraform/README.md`](terraform/README.md) pour le déploiement infra-as-code complet (Vercel + Upstash Redis, sur 3 environnements). En résumé :

1. Créer manuellement le projet Supabase pour l'environnement visé et appliquer `supabase/schema.sql`.
2. `cd terraform/environments/<dev|staging|prod> && terraform init && terraform plan && terraform apply` (voir le README Terraform pour la gestion du state et des secrets).
3. Lancer `scripts/setup-qstash.ts` contre l'URL de déploiement pour programmer les cron.
4. Le déploiement applicatif lui-même se fait via l'intégration Git de Vercel (push sur la branche configurée) ou `vercel deploy`.

## Limites des free tiers (à vérifier périodiquement)

Ces chiffres évoluent régulièrement — **vérifier les pages de pricing officielles avant de se fier à ces valeurs**, elles ne sont indiquées ici qu'à titre de repère (relevées à l'implémentation, août 2026).

| Service | Page pricing | Limites free tier (indicatif) |
|---|---|---|
| Supabase | https://supabase.com/pricing | 1 projet actif gratuit, 500 Mo DB, 5 Go bande passante/mois, pause auto après ~7 jours d'inactivité |
| Geoapify | https://www.geoapify.com/pricing/ | 3000 requêtes/jour, 3 requêtes/seconde |
| Upstash Redis | https://upstash.com/pricing | 10 000 commandes/jour, 256 Mo par base, 1 base gratuite |
| Upstash QStash | https://upstash.com/pricing | 500 messages/jour |
| Resend | https://resend.com/pricing | 3000 emails/mois, 100 emails/jour |
| MapTiler | https://www.maptiler.com/cloud/pricing/ | 100 000 chargements de tuiles/mois |
| Vercel Hobby | https://vercel.com/pricing | 100 Go bande passante/mois, usage **non-commercial uniquement** |

Avec un quota par défaut de **10 recherches/mois/utilisateur**, même avec plusieurs dizaines d'utilisateurs actifs, la consommation reste largement sous les 3000 req/jour de Geoapify — d'autant que le cache Redis de 7 jours évite de refaire un appel API pour une même zone/catégorie recherchée deux fois dans la semaine.

## Points de vigilance

### 1 — Vercel Hobby = usage non-commercial uniquement

Les CGU du plan Hobby de Vercel le réservent à un usage **personnel/non-commercial**. LeadSpot est actuellement un projet portfolio/démo sans client payant, donc l'usage du plan Hobby est conforme. **Le jour où l'app génère un revenu commercial réel (clients payants, abonnement, etc.), il faudra upgrader vers [Vercel Pro](https://vercel.com/pricing).** Ce point est documenté à nouveau dans `terraform/modules/app-environment/main.tf` et `terraform/README.md`, à l'endroit où le projet Vercel est provisionné.

### 2 — State Terraform via Git privé, pas HCP Terraform

Le state Terraform est géré via un repo Git **privé et séparé** plutôt que via HCP Terraform (Terraform Cloud), pour éviter la limite du free tier HCP Terraform basée sur le **nombre de ressources sous gestion** (moins prévisible qu'une limite par utilisateur pour un projet multi-environnements). Cela implique une procédure de **verrouillage manuel** (pas de locking automatique) — voir [`terraform/README.md`](terraform/README.md#pourquoi-pas-hcp-terraform-terraform-cloud--) pour la convention complète.

## Infrastructure Terraform

Voir [`terraform/README.md`](terraform/README.md) pour :
- la structure des modules et environnements (dev/staging/prod),
- la convention de state (backend local + repo Git privé) et de verrouillage manuel,
- la gestion des secrets (local via `terraform.tfvars`, CI via GitHub Actions Secrets),
- le détail des providers utilisés et leurs limites free tier,
- le workflow CI/CD (`.github/workflows/terraform.yml`) : `terraform plan` commenté sur chaque PR, `terraform apply` sur `prod` au merge sur `main`.

## Structure du projet

```
.
├── app/                      # Next.js App Router
│   ├── (auth)/login, /signup # Pages d'authentification
│   ├── api/                  # Route handlers (search, leads, keepalive, cron/rescan, ...)
│   ├── components/           # Composants UI partagés
│   ├── dashboard/            # Liste de leads (filtrable/triable) + carte
│   └── search/                # Formulaire de recherche de leads
├── lib/                      # Clients Supabase/Geoapify/Redis/Resend/QStash, quota, types
├── supabase/schema.sql       # Schéma DB complet (tables, RLS, fonctions, triggers)
├── scripts/setup-qstash.ts   # Programmation des cron QStash
├── leadspot-chart/           # Helm chart Kubernetes (deployment, service, HPA)
├── Dockerfile                # Build multi-stage pour la conteneurisation
├── terraform/                # Infra as code (voir terraform/README.md)
└── .github/workflows/        # CI (ci.yml) + CD (cd.yml) + Terraform (terraform.yml)
```
