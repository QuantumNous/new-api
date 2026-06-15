output "service_name" {
  description = "Cloud Run service name for the website"
  value       = google_cloud_run_v2_service.web.name
}

output "service_uri" {
  description = "Default *.run.app URL of the website service (useful for direct health checks before the LB is wired)"
  value       = google_cloud_run_v2_service.web.uri
}
