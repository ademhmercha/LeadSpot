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

provider "vercel" {
  api_token = var.vercel_api_token
}

provider "upstash" {
  email   = var.upstash_email
  api_key = var.upstash_api_key
}
