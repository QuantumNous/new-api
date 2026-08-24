output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "max_connections" {
  value = var.max_connections
}

output "connection_name" {
  value       = google_sql_database_instance.main.connection_name
  description = "PROJECT:REGION:INSTANCE — used by Cloud SQL Auth Proxy / Cloud Run --add-cloudsql-instances"
}

output "database_name" {
  value = google_sql_database.newapi.name
}

output "app_user" {
  value = google_sql_user.app.name
}
