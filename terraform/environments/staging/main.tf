module "app_environment" {
  source = "../../modules/app-environment"

  environment          = "staging"
  vercel_project_name  = "leadspot-staging"
  vercel_team_id       = var.vercel_team_id
  git_repository       = var.git_repository
  upstash_redis_region = "eu-west-1"

  supabase_url                   = var.supabase_url
  supabase_anon_key              = var.supabase_anon_key
  supabase_service_role_key      = var.supabase_service_role_key
  geoapify_api_key               = var.geoapify_api_key
  resend_api_key                 = var.resend_api_key
  map_tiles_api_key              = var.map_tiles_api_key
  qstash_token                   = var.qstash_token
  qstash_current_signing_key     = var.qstash_current_signing_key
  qstash_next_signing_key        = var.qstash_next_signing_key
  free_tier_monthly_search_limit = var.free_tier_monthly_search_limit
}
