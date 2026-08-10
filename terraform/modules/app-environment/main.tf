# ============================================================================
# app-environment module
#
# Provisions, per environment (dev/staging/prod):
#   - a Vercel project (Hobby plan — free, NON-COMMERCIAL usage only; see the
#     vigilance note in ../../README.md and the root README)
#   - the app's environment variables on that Vercel project
#   - an Upstash Redis database (free tier) used for the 7-day search cache
#
# NOT provisioned here (documented, not automated):
#   - The Supabase project itself. The official Supabase Terraform provider
#     cannot fully provision a free-tier project end-to-end without extra
#     paid setup, so the project is created manually once via the Supabase
#     dashboard (~2 minutes, free, no credit card) and its schema is applied
#     via supabase/schema.sql. Only the resulting URL/keys are threaded
#     through Terraform as sensitive variables.
#   - QStash schedules. Upstash's Terraform provider only manages Redis
#     (and Kafka), not QStash — QStash is account-wide, not a per-project
#     resource. Schedules are created/updated with `scripts/setup-qstash.ts`
#     after each deploy (see that script and ../../README.md).
# ============================================================================

resource "vercel_project" "this" {
  name      = var.vercel_project_name
  team_id   = var.vercel_team_id
  framework = "nextjs"

  dynamic "git_repository" {
    for_each = var.git_repository == null ? [] : [var.git_repository]
    content {
      type = "github"
      repo = git_repository.value
    }
  }
}

locals {
  # Vercel target environment(s) each app env variable should apply to.
  # dev -> Preview deployments, staging -> Preview, prod -> Production.
  vercel_targets = var.environment == "prod" ? ["production"] : ["preview", "development"]

  env_vars = {
    NEXT_PUBLIC_SUPABASE_URL       = var.supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY  = var.supabase_anon_key
    SUPABASE_SERVICE_ROLE_KEY      = var.supabase_service_role_key
    GEOAPIFY_API_KEY               = var.geoapify_api_key
    UPSTASH_REDIS_REST_URL         = upstash_redis_database.cache.endpoint
    UPSTASH_REDIS_REST_TOKEN       = upstash_redis_database.cache.rest_token
    QSTASH_TOKEN                   = var.qstash_token
    QSTASH_CURRENT_SIGNING_KEY     = var.qstash_current_signing_key
    QSTASH_NEXT_SIGNING_KEY        = var.qstash_next_signing_key
    RESEND_API_KEY                 = var.resend_api_key
    NEXT_PUBLIC_MAP_TILES_API_KEY  = var.map_tiles_api_key
    FREE_TIER_MONTHLY_SEARCH_LIMIT = tostring(var.free_tier_monthly_search_limit)
  }
}

resource "vercel_project_environment_variable" "this" {
  for_each = local.env_vars

  project_id = vercel_project.this.id
  team_id    = var.vercel_team_id
  key        = each.key
  value      = each.value
  target     = local.vercel_targets
  sensitive  = true
}

resource "upstash_redis_database" "cache" {
  database_name = "leadspot-${var.environment}-cache"
  region        = var.upstash_redis_region
  tls           = true
  # Upstash free tier: 1 database included, 10k commands/day, 256MB — plenty
  # for a 7-day search-results cache. https://upstash.com/pricing
}
