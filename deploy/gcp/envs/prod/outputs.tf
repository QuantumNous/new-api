output "cloud_run_uri" {
  description = "Direct Cloud Run *.run.app URL (used by GHA smoke test)"
  value       = var.enable_legacy_runtime ? module.cloud_run.service_uri : null
}

output "artifact_registry_url" {
  description = "Push docker images to this URL"
  value       = module.artifact_registry.repository_url
}

output "cloudsql_connection_name" {
  value = module.cloud_sql.connection_name
}

output "domain_mappings" {
  description = "Cloudflare DNS targets — create one CNAME per host, pointing to ghs.googlehosted.com"
  value       = var.enable_legacy_runtime ? module.cloud_run.domain_mappings : {}
}

output "github_wif_provider" {
  description = "Set this as the GH Actions variable GCP_WIF_PROVIDER"
  value       = module.github_wif.provider_resource_name
}

output "github_deployer_sa_email" {
  description = "Set this as the GH Actions variable GCP_DEPLOYER_SA"
  value       = module.service_accounts.deployer_email
}

output "runtime_sa_email" {
  value = module.service_accounts.runtime_email
}

output "flatkey_asset_bucket" {
  description = "Private production GCS bucket for Flatkey source assets."
  value       = google_storage_bucket.flatkey_assets.name
}

output "flatkey_asset_staging_bucket" {
  description = "Private staging GCS bucket for Flatkey source assets. Empty unless enable_staging=true."
  value       = var.enable_staging ? google_storage_bucket.flatkey_assets_staging[0].name : ""
}

output "video_result_bucket" {
  description = "Private production GCS bucket for generated video results."
  value       = google_storage_bucket.video_results.name
}

output "video_result_staging_bucket" {
  description = "Private staging GCS bucket for generated video results. Empty unless enable_staging=true."
  value       = var.enable_staging ? google_storage_bucket.video_results_staging[0].name : ""
}

output "lb_ip" {
  description = "Static IPv4 to A-record in Cloudflare for every domain in lb_domains. Null if LB disabled."
  value       = var.enable_load_balancer ? module.cloud_lb[0].ip_address : null
}

output "lb_ssl_certificate_status_hint" {
  value = var.enable_load_balancer ? module.cloud_lb[0].ssl_certificate_status_hint : null
}

output "placeholder_secrets_to_fill" {
  description = "These secrets were created empty — set their values via 'gcloud secrets versions add' before the features that need them are used"
  value = [
    "newapi-github-client-id",
    "newapi-github-client-secret",
    "newapi-stripe-secret-key",
  ]
}
