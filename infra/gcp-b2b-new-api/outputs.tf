output "web_url" {
  description = "Public Cloud Run URL for the customer."
  value       = google_cloud_run_v2_service.web.uri
}

output "deployed_image" {
  description = "Container image currently managed by this Terraform workspace."
  value       = var.image
}

output "master_url" {
  description = "Internal Cloud Run URL for the master node."
  value       = google_cloud_run_v2_service.master.uri
}

output "cloud_run_web_service" {
  description = "Public Cloud Run service name."
  value       = google_cloud_run_v2_service.web.name
}

output "cloud_run_master_service" {
  description = "Internal master Cloud Run service name."
  value       = google_cloud_run_v2_service.master.name
}

output "cloud_sql_instance" {
  description = "Cloud SQL PostgreSQL instance name."
  value       = google_sql_database_instance.postgres.name
}

output "database_name" {
  description = "Cloud SQL database name."
  value       = google_sql_database.app.name
}

output "database_user" {
  description = "Cloud SQL application user name."
  value       = google_sql_user.app.name
}

output "redis_instance" {
  description = "Memorystore Redis instance name."
  value       = google_redis_instance.cache.name
}

output "secret_names" {
  description = "Secret Manager secret names used by Cloud Run."
  value = {
    sql_dsn        = google_secret_manager_secret.sql_dsn.secret_id
    redis_conn     = google_secret_manager_secret.redis_conn.secret_id
    session_secret = google_secret_manager_secret.session_secret.secret_id
    crypto_secret  = google_secret_manager_secret.crypto_secret.secret_id
  }
}
