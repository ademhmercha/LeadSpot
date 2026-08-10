output "vercel_project_id" {
  description = "Vercel project ID."
  value       = vercel_project.this.id
}

output "vercel_project_url" {
  description = "Default *.vercel.app domain assigned to the project."
  value       = try(vercel_project.this.domains[0], null)
}

output "upstash_redis_endpoint" {
  description = "Upstash Redis REST endpoint."
  value       = upstash_redis_database.cache.endpoint
}

output "upstash_redis_rest_token" {
  description = "Upstash Redis REST token."
  value       = upstash_redis_database.cache.rest_token
  sensitive   = true
}
