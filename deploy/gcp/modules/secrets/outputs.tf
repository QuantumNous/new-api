output "db_app_password" {
  value     = random_password.db_app_password.result
  sensitive = true
}

output "db_app_password_secret_id" {
  value = google_secret_manager_secret.managed["newapi-db-app-password"].secret_id
}

output "session_secret_id" {
  value = google_secret_manager_secret.managed["newapi-session-secret"].secret_id
}

output "crypto_secret_id" {
  value = google_secret_manager_secret.managed["newapi-crypto-secret"].secret_id
}

output "initial_token_secret_id" {
  value = google_secret_manager_secret.managed["newapi-initial-token"].secret_id
}

output "all_managed_secret_ids" {
  value = [for s in google_secret_manager_secret.managed : s.secret_id]
}
