# ============================================================================
# Shared provider version constraints — REFERENCE TEMPLATE.
#
# Terraform has no "root module shared across environments" mechanism: each
# environment under environments/{dev,staging,prod} is its own root module
# and needs its own copy of a `required_providers` block. This file is the
# canonical template — when adding a new environment, copy this block into
# environments/<new-env>/providers.tf rather than editing environments in
# place and letting them drift.
#
# Both providers used here have free tiers usable without a credit card:
#   - vercel/vercel   : https://registry.terraform.io/providers/vercel/vercel
#   - upstash/upstash : https://registry.terraform.io/providers/upstash/upstash
# ============================================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.9"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 1.5"
    }
  }
}
