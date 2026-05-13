// Cloud Run v2 service:
//   - Image starts as a placeholder; CI/CD updates it on each deploy.
//     Terraform ignores image changes so CI/CD can roll forward independently.
//   - Cloud SQL is reached via Auth Proxy Unix socket (/cloudsql/<conn-name>).
//   - Redis is reached via Direct VPC Egress (private-ranges-only).
//   - Sensitive values are injected from Secret Manager, not stored in env state.

resource "google_cloud_run_v2_service" "main" {
  project  = var.project_id
  name     = var.service_name
  location = var.region

  ingress             = var.ingress
  deletion_protection = var.deletion_protection

  template {
    service_account = var.runtime_sa_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    max_instance_request_concurrency = var.concurrency
    timeout                          = "${var.request_timeout_seconds}s"

    vpc_access {
      network_interfaces {
        network    = var.network_id
        subnetwork = var.subnet_id
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [var.cloudsql_connection_name]
      }
    }

    containers {
      image = var.image_uri

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = false // keep CPU on during streaming responses
        startup_cpu_boost = true
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      ports {
        container_port = 3000
      }

      startup_probe {
        initial_delay_seconds = 5
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 30
        tcp_socket {
          port = 3000
        }
      }

      liveness_probe {
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3
        http_get {
          path = "/api/status"
          port = 3000
        }
      }

      // Plain environment variables
      // PORT is reserved by Cloud Run — it injects PORT=<container_port> automatically.
      env {
        name  = "TZ"
        value = "UTC"
      }
      env {
        name  = "GIN_MODE"
        value = "release"
      }
      env {
        name  = "MEMORY_CACHE_ENABLED"
        value = "true"
      }
      env {
        name  = "SYNC_FREQUENCY"
        value = "60"
      }
      env {
        name  = "BATCH_UPDATE_ENABLED"
        value = "true"
      }
      env {
        name  = "BATCH_UPDATE_INTERVAL"
        value = "5"
      }
      env {
        name  = "SQL_MAX_OPEN_CONNS"
        value = "20"
      }
      env {
        name  = "SQL_MAX_IDLE_CONNS"
        value = "5"
      }
      env {
        name  = "SQL_MAX_LIFETIME"
        value = "60"
      }
      env {
        name  = "STREAMING_TIMEOUT"
        value = "300"
      }
      env {
        name  = "FRONTEND_BASE_URL"
        value = var.frontend_base_url
      }

      // Rate limits — defaults (60/180s) are far too tight behind a load
      // balancer that funnels real client IPs through proxy headers. Until
      // Cloud Armor handles edge throttling, bump these so the admin SPA and
      // OAuth flows don't trip 429.
      env {
        name  = "GLOBAL_WEB_RATE_LIMIT"
        value = "600"
      }
      env {
        name  = "GLOBAL_WEB_RATE_LIMIT_DURATION"
        value = "60"
      }
      env {
        name  = "GLOBAL_API_RATE_LIMIT"
        value = "1800"
      }
      env {
        name  = "GLOBAL_API_RATE_LIMIT_DURATION"
        value = "60"
      }

      // Secrets — referenced from Secret Manager, not stored in TF state.
      env {
        name = "SQL_DSN"
        value_source {
          secret_key_ref {
            secret  = var.sql_dsn_secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "REDIS_CONN_STRING"
        value_source {
          secret_key_ref {
            secret  = var.redis_url_secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.session_secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "CRYPTO_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.crypto_secret_id
            version = "latest"
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    // CI/CD owns image + revision identity; Terraform owns the service shape.
    // The top-level service `scaling` block is populated with zero values by
    // gcloud run services update operations during deploys — that drift is
    // harmless but pollutes every plan, so ignore it.
    ignore_changes = [
      template[0].containers[0].image,
      template[0].revision,
      client,
      client_version,
      scaling,
    ]
  }
}

// Allow unauthenticated invocations (Cloudflare will sit in front).
resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = google_cloud_run_v2_service.main.location
  name     = google_cloud_run_v2_service.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

// Custom domain mappings (one per FQDN). Cloud Run Domain Mapping = free, auto-cert via Google.
// Cloudflare DNS points each host as CNAME → ghs.googlehosted.com.
resource "google_cloud_run_domain_mapping" "domains" {
  for_each = toset(var.custom_domains)

  project  = var.project_id
  location = var.region
  name     = each.value

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name       = google_cloud_run_v2_service.main.name
    certificate_mode = "AUTOMATIC"
  }
}
