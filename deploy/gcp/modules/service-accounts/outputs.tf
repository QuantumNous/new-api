output "runtime_email" {
  value = google_service_account.runtime.email
}

output "runtime_id" {
  value = google_service_account.runtime.id
}

output "runtime_name" {
  value = google_service_account.runtime.name
}

output "deployer_email" {
  value = google_service_account.deployer.email
}

output "deployer_id" {
  value = google_service_account.deployer.id
}

output "deployer_name" {
  value = google_service_account.deployer.name
}
