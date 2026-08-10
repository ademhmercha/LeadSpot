variable "environment" {
  description = "Environment name: dev, staging or prod. Used as a suffix/prefix for all resource names."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "vercel_project_name" {
  description = "Vercel project name for this environment (must be unique in the Vercel team/account)."
  type        = string
}

variable "vercel_team_id" {
  description = "Optional Vercel team ID. Leave empty to use the personal account (Hobby plan)."
  type        = string
  default     = null
}

variable "git_repository" {
  description = "GitHub repo to link to the Vercel project, in \"owner/repo\" form. Leave null to manage deployments outside Terraform."
  type        = string
  default     = null
}

variable "upstash_redis_region" {
  description = "Upstash Redis region (free tier, global or a single region such as eu-west-1)."
  type        = string
  default     = "eu-west-1"
}

# --- Application secrets -----------------------------------------------
# All marked sensitive = true so their values never appear in `plan`/`apply`
# console output or get logged. Real values are injected via
# terraform.tfvars (gitignored) locally, or GitHub Actions Secrets in CI.
# See ../../README.md.

variable "supabase_url" {
  description = "Supabase project URL (project created manually — see README)."
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  type      = string
  sensitive = true
}

variable "supabase_service_role_key" {
  type      = string
  sensitive = true
}

variable "geoapify_api_key" {
  description = "Geoapify Places API key (free tier, no credit card)."
  type        = string
  sensitive   = true
}

variable "resend_api_key" {
  type      = string
  sensitive = true
}

variable "map_tiles_api_key" {
  description = "MapTiler (or Stadia Maps) API key for map tiles — never raw tile.openstreetmap.org in production."
  type        = string
  sensitive   = true
}

variable "free_tier_monthly_search_limit" {
  description = "Max searches per user per month, to stay well within Geoapify's free daily quota."
  type        = number
  default     = 10
}

variable "qstash_token" {
  description = "QStash token (account-wide, from the Upstash console — QStash has no per-project Terraform resource)."
  type        = string
  sensitive   = true
}

variable "qstash_current_signing_key" {
  type      = string
  sensitive = true
}

variable "qstash_next_signing_key" {
  type      = string
  sensitive = true
}
