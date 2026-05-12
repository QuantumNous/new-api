output "pool_id" {
  value = google_iam_workload_identity_pool.github.workload_identity_pool_id
}

output "provider_resource_name" {
  // Paste this into the GitHub Actions auth step as `workload_identity_provider`
  value = google_iam_workload_identity_pool_provider.github.name
}
