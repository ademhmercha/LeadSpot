# Local backend — state file lives in the separate private
# `leadspot-terraform-state` repo, cloned as a sibling of this repo.
# See ../../backend.tf and ../../README.md for the full convention,
# including the manual-locking procedure (no automatic locking with a
# local backend).
terraform {
  backend "local" {
    path = "../../../../leadspot-terraform-state/dev/terraform.tfstate"
  }
}
