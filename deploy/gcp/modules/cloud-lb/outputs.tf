output "ip_address" {
  description = "Static IPv4 to set as A record in Cloudflare for every configured domain"
  value       = google_compute_global_address.main.address
}

output "ssl_certificate_id" {
  value = var.certificate_map_name == "" ? google_compute_managed_ssl_certificate.main[0].id : null
}

output "ssl_certificate_status_hint" {
  description = "Check provisioning with: gcloud compute ssl-certificates describe newapi-cert --global"
  value       = "Cert provisions only after all listed domains' DNS resolves to the LB IP. Allow 10–60 min."
}
