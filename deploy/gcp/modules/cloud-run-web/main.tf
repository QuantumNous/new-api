// Cloud Run v2 service for the standalone Next.js marketing website (website/).
//
// Differs from the main `cloud-run` module on purpose:
//   - NO Cloud SQL volume and NO Direct VPC Egress — the site only does SSR and
//     fetches public data from the console/router origin over the internet.
//   - Listens on port 4000 (see website/Dockerfile), not 3000.
//   - Runs with a dedicated minimal-privilege runtime SA (logging + monitoring only).
//   - Image starts as a placeholder; CI/CD updates it on each deploy and Terraform
//     ignores image/revision/traffic/env so CI/CD can roll forward independently.

resource "google_cloud_run_v2_service" "web" {
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

    containers {
      image = var.image_uri

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = true // marketing SSR is request-bound; allow CPU to idle to save cost
        startup_cpu_boost = true
      }

      ports {
        container_port = var.container_port
      }

      startup_probe {
        initial_delay_seconds = 5
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 30
        tcp_socket {
          port = var.container_port
        }
      }

      liveness_probe {
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3
        http_get {
          path = "/"
          port = var.container_port
        }
      }

      // Plain environment variables.
      // PORT is reserved by Cloud Run — it injects PORT=<container_port> automatically.
      // NOTE: NEXT_PUBLIC_* values are baked into the bundle at BUILD time (build-args
      // in CI), so they are NOT set here. APP_CONSOLE_ORIGIN/ROUTER_ORIGIN/SITE_ORIGIN
      // are also set at runtime so server-side route handlers and rendered examples
      // resolve the correct origins instead of falling back to image defaults.
      env {
        name  = "TZ"
        value = "UTC"
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "APP_CONSOLE_ORIGIN"
        value = var.app_console_origin
      }
      env {
        name  = "ROUTER_ORIGIN"
        value = var.router_origin
      }
      env {
        name  = "SITE_ORIGIN"
        value = var.site_origin
      }
      env {
        name  = "COOKIE_SESSION_DOMAIN"
        value = var.cookie_session_domain
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    // CI/CD owns image + revision identity + traffic + env; Terraform owns the
    // service shape. Mirror the main cloud-run module's ignore list so a plain
    // `terraform apply` never fights the deploy workflow.
    ignore_changes = [
      template[0].containers[0].env,
      template[0].containers[0].image,
      template[0].revision,
      client,
      client_version,
      scaling,
      traffic,
    ]
  }
}

// Public ingress — Cloudflare/LB sits in front; the LB Serverless NEG must be able
// to invoke the service unauthenticated.
resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
