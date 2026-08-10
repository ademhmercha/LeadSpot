# LeadSpot — Infrastructure Terraform

Infra as code pour LeadSpot, sur 3 environnements (`dev`, `staging`, `prod`), en n'utilisant que des services avec un **free tier utilisable sans carte bancaire**.

## Structure

```
terraform/
├── modules/
│   └── app-environment/     # projet Vercel + env vars + Redis Upstash (module réutilisable)
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   ├── dev/                 # root module dev — sa propre state, ses propres providers
│   ├── staging/
│   └── prod/
├── providers.tf              # template de référence (versions des providers)
├── backend.tf                # template de référence + doc de la convention de state
└── README.md                 # ce fichier
```

Chaque dossier sous `environments/` est un **root module Terraform indépendant** (son propre `terraform init`, sa propre state, ses propres providers). `providers.tf` et `backend.tf` à la racine de `terraform/` ne sont **pas exécutés directement** — ce sont les templates canoniques à copier quand on ajoute un nouvel environnement, et l'endroit où la convention est documentée une seule fois.

## Pourquoi pas HCP Terraform (Terraform Cloud) ?

Le free tier de HCP Terraform est désormais limité par un **nombre de ressources sous gestion** plutôt que par un nombre d'utilisateurs. Pour un projet multi-environnements dont le nombre de ressources peut grandir (nouvelles env vars, nouveaux modules, etc.), cette limite est moins prévisible qu'une limite par utilisateur. On évite donc ce risque.

## Gestion du state : backend local + repo Git privé séparé

**Le state Terraform n'est jamais commité dans ce repo applicatif.** À la place :

1. Créer un repo Git **privé**, dédié uniquement au state, par ex. `leadspot-terraform-state` (gratuit sur GitHub/GitLab).
2. Le cloner en tant que **dossier voisin** de ce repo :
   ```
   mes-projets/
   ├── leadspot/                      (ce repo)
   └── leadspot-terraform-state/
       ├── dev/terraform.tfstate
       ├── staging/terraform.tfstate
       └── prod/terraform.tfstate
   ```
3. Chaque `environments/<env>/backend.tf` pointe son backend `local` vers
   `../../../../leadspot-terraform-state/<env>/terraform.tfstate` (chemin relatif depuis `environments/<env>/`).
4. **Après chaque `terraform apply` réussi**, committer et pousser le fichier de state mis à jour dans le repo `leadspot-terraform-state`.

### Verrouillage manuel (IMPORTANT)

Un backend `local` n'a **aucun verrouillage automatique** entre plusieurs machines ou exécutions CI simultanées (contrairement à un backend S3+DynamoDB ou à HCP Terraform). Convention à respecter strictement :

- **Avant tout `terraform apply`** (local ou déclenché depuis la CI), annoncer l'intention dans le canal d'équipe (ou, en solo, s'assurer qu'aucun autre `apply` n'est en cours).
- Toujours faire un `git pull` sur `leadspot-terraform-state` juste avant `terraform plan`/`apply`, pour partir de la dernière state connue.
- Ne jamais lancer deux `apply` en parallèle sur le même environnement.
- En CI (voir `.github/workflows/terraform.yml`), les jobs `apply` sont configurés pour s'exécuter dans un `concurrency group` par environnement, ce qui empêche deux runs GitHub Actions de s'exécuter en parallèle sur le même environnement — mais ne protège pas contre un `apply` lancé manuellement en local en même temps.

### Alternative future : backend S3-compatible

Si un backend objet avec locking automatique est nécessaire plus tard (équipe plus grande, applies plus fréquents), une option à évaluer *au moment de l'implémentation* (les offres changent) : un bucket compatible S3 avec free tier sans CB (par ex. Cloudflare R2 — 10 Go gratuits, pas de carte bancaire requise pour le free tier au moment de la rédaction) combiné à un mécanisme de lock applicatif, ou un backend Terraform qui supporte le locking natif sur ce type de stockage. **À vérifier manuellement avant d'implémenter**, les conditions des free tiers évoluent.

## Providers utilisés

| Provider | Ressources gérées | Free tier | CB requise ? |
|---|---|---|---|
| [`vercel/vercel`](https://registry.terraform.io/providers/vercel/vercel/latest) | Projet Vercel, variables d'environnement | Hobby plan | Non |
| [`upstash/upstash`](https://registry.terraform.io/providers/upstash/upstash/latest) | Base Redis (cache de recherche) | Free tier Redis | Non |

**Supabase** : pas de provider Terraform officiel capable de créer un projet complet gratuitement de bout en bout sans étape manuelle. Le projet est donc créé **manuellement** une fois via le dashboard Supabase (~2 minutes, gratuit, sans CB), puis :
- le schéma SQL (`../supabase/schema.sql`) est appliqué manuellement ou via un script de migration,
- seules l'URL et les clés résultantes sont injectées dans Terraform comme variables sensibles (`supabase_url`, `supabase_anon_key`, `supabase_service_role_key`), pour être poussées vers les variables d'environnement Vercel.

**QStash** (Upstash) : le provider Terraform `upstash/upstash` gère Redis (et Kafka), mais n'expose pas de ressource pour les *schedules* QStash — QStash est un service au niveau du compte, pas une ressource par projet. Les deux schedules récurrents de LeadSpot (rescan hebdomadaire, keepalive) sont donc créés/mis à jour via `../scripts/setup-qstash.ts` après chaque déploiement, pas via Terraform. Seul le `QSTASH_TOKEN` (et les signing keys) transite par Terraform vers les variables d'environnement Vercel.

## Points de vigilance

1. **Vercel Hobby = usage non-commercial uniquement.** Les CGU du plan Hobby de Vercel réservent son usage à des projets personnels/non-commerciaux. Ce projet est actuellement un portfolio/démo sans client payant, donc c'est conforme. **Le jour où LeadSpot génère un revenu commercial réel, il faudra upgrader vers Vercel Pro** (voir la note dans `modules/app-environment/main.tf` et le README racine).
2. **State Terraform via Git privé, pas HCP Terraform**, pour éviter toute limite de ressources sous gestion imprévisible — voir section ci-dessus.

## Gestion des secrets

- Toutes les variables sensibles ont `sensitive = true` (jamais affichées dans `plan`/`apply`, ni loguées).
- `environments/<env>/terraform.tfvars.example` liste les variables attendues, **sans valeurs réelles** — à copier en `terraform.tfvars` (gitignored) pour un usage local.
- En CI (GitHub Actions), les secrets sont injectés via **GitHub Actions Secrets** (gratuit), un par variable sensible, préfixés par environnement (ex. `PROD_SUPABASE_SERVICE_ROLE_KEY`). Voir `.github/workflows/terraform.yml`.

## Utilisation locale

```bash
cd terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars   # puis remplir les vraies valeurs
terraform init
terraform plan
terraform apply
# puis, dans le repo leadspot-terraform-state :
git add dev/terraform.tfstate && git commit -m "dev: terraform apply" && git push
```

Répéter pour `staging` et `prod` (avec la vigilance de verrouillage manuel décrite plus haut).
