# ============================================================================
# Backend configuration — REFERENCE TEMPLATE.
#
# We deliberately do NOT use HCP Terraform (Terraform Cloud) as the backend:
# its free tier is now gated by number of *resources under management*
# rather than number of users, which is hard to predict for a small
# multi-environment hobby project that may grow. See terraform/README.md
# for the full rationale.
#
# Instead, each environment uses a LOCAL backend whose state file lives
# inside a SEPARATE, PRIVATE Git repository dedicated only to Terraform
# state (never inside this application repo). Concretely:
#
#   1. Create a private repo, e.g. `leadspot-terraform-state`.
#   2. Clone it as a sibling of this repo:
#        ../leadspot-terraform-state/
#          dev/terraform.tfstate
#          staging/terraform.tfstate
#          prod/terraform.tfstate
#   3. Each environments/<env>/backend.tf points its local backend `path` at
#      ../../../leadspot-terraform-state/<env>/terraform.tfstate
#   4. After every `terraform apply`, commit + push the updated state file
#      in that state repo.
#
# This file is not used directly by `terraform init` (each environment has
# its own backend.tf) — it exists as the canonical template and as the place
# to document the convention above in one spot.
#
# IMPORTANT — manual locking: a local backend has no automatic state
# locking across machines/CI runs. See terraform/README.md for the manual
# locking convention (announce before every `terraform apply`) that
# replaces it.
# ============================================================================
