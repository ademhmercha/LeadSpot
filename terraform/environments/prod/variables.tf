# --- Provider credentials -----------------------------------------------

variable "vercel_api_token" {
  description = "Vercel personal access token (Vercel dashboard > Settings > Tokens). Free Hobby plan."
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Optional Vercel team ID. Leave null for a personal Hobby account."
  type        = string
  default     = null
}

variable "upstash_email" {
  description = "Upstash account email (used with upstash_api_key for provider auth)."
  type        = string
  sensitive   = true
}

variable "upstash_api_key" {
  description = "Upstash API key (Upstash console > Account > API Keys). Free tier."
  type        = string
  sensitive   = true
}

# --- App configuration ----------------------------------------------------

variable "git_repository" {
  description = "\"owner/repo\" of the app's GitHub repository, for Vercel's git integration."
  type        = string
  default     = null
}

# --- App secrets (see ../../modules/app-environment/variables.tf) --------

variable "supabase_url" {
  type      = string
  sensitive = true
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
  type      = string
  sensitive = true
}
variable "resend_api_key" {
  type      = string
  sensitive = true
}
variable "map_tiles_api_key" {
  type      = string
  sensitive = true
}
variable "qstash_token" {
  type      = string
  sensitive = true
}
variable "qstash_current_signing_key" {
  type      = string
  sensitive = true
}
variable "qstash_next_signing_key" {
  type      = string
  sensitive = true
}

variable "free_tier_monthly_search_limit" {
  type    = number
  default = 10
}
