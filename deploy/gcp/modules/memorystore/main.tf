// Memorystore for Redis, Basic tier (no HA). Reached from Cloud Run via Direct VPC Egress.

resource "google_redis_instance" "main" {
  project        = var.project_id
  name           = var.instance_name
  region         = var.region
  location_id    = var.zone
  tier           = "BASIC"
  memory_size_gb = var.memory_size_gb
  redis_version  = "REDIS_7_0"

  authorized_network = var.network_id
  connect_mode       = "DIRECT_PEERING"

  display_name = "new-api Redis"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 11 // 11:00 UTC = 04:00 PT
        minutes = 0
      }
    }
  }
}
