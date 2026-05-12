// Cloud SQL for MySQL 8.0 — single zone (no HA), accessed via Cloud SQL Auth Proxy.
// Public IP is enabled but no authorized networks: connections must go through the proxy.

resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = var.instance_name
  region           = var.region
  database_version = "MYSQL_8_0"

  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    availability_type = "ZONAL" // single zone per current cost target
    disk_type         = "PD_SSD"
    disk_size         = var.disk_size_gb
    disk_autoresize   = true
    edition           = "ENTERPRISE"

    location_preference {
      zone = var.zone
    }

    backup_configuration {
      enabled                        = true
      binary_log_enabled             = true    // required for PITR on MySQL
      start_time                     = "11:00" // 11:00 UTC = 04:00 PT (low traffic)
      point_in_time_recovery_enabled = false   // MySQL uses binlog instead
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7  // Sunday (1=Mon … 7=Sun)
      hour         = 11 // 11:00 UTC = 04:00 PT
      update_track = "stable"
    }

    ip_configuration {
      ipv4_enabled = true // needed for Cloud SQL Auth Proxy
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    database_flags {
      name  = "max_connections"
      value = "300"
    }
    database_flags {
      name  = "character_set_server"
      value = "utf8mb4"
    }
    database_flags {
      name  = "collation_server"
      value = "utf8mb4_unicode_ci"
    }
    database_flags {
      name  = "transaction_isolation"
      value = "READ-COMMITTED"
    }
    database_flags {
      name  = "slow_query_log"
      value = "on"
    }
    database_flags {
      name  = "long_query_time"
      value = "1"
    }
    database_flags {
      name  = "default_time_zone"
      value = "+00:00"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
      record_client_address   = false
      query_string_length     = 1024
    }
  }
}

resource "google_sql_database" "newapi" {
  project   = var.project_id
  instance  = google_sql_database_instance.main.name
  name      = var.database_name
  charset   = "utf8mb4"
  collation = "utf8mb4_unicode_ci"
}

resource "google_sql_user" "app" {
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = var.app_user
  host     = "%"
  password = var.app_password
}
