// ============================================================================
// newapi-staging — 完整 staging 测试环境（对生产零侵入，仅新增资源）
//
//   设计见 deploy/gcp/docs/2026-06-22-newapi-staging-plan.md
//
//   复用：Cloud SQL 实例 newapi-mysql、Artifact Registry、WIF
//   新增：独立 DB 用户、3 个 staging secret、2 个独立 runtime SA、
//         后端 Cloud Run (newapi-staging) + 官网 Cloud Run (newapi-web-staging)
//   不用 Redis（内存缓存）→ 后端不挂 VPC；后端固定单实例（min=max=1）
//   不配域名、不动 LB —— 用 *.run.app URL，零停机风险
//   库 newapi_staging 已手动创建，刻意不在 TF 内（避免关 staging 时误删数据）
//
//   全部资源由 var.enable_staging 的 count 控制，默认 false：
//   合并 PR 不会自动生效，必须显式 `terraform apply -var='enable_staging=true'`。
// ============================================================================

variable "enable_staging" {
  type        = bool
  description = "Create the full newapi-staging env (backend + website Cloud Run, dedicated SAs, DB user, secrets on the shared prod Cloud SQL instance). Nothing is created until true. No LB/domain/Cloudflare changes."
  default     = false
}

variable "enable_staging_domains" {
  type        = bool
  description = "Create Cloud Run domain mappings for staging-console.flatkey.ai, staging-router.flatkey.ai, and staging-website.flatkey.ai. Enable only after flatkey.ai is verified in Google Search Console and DNS is ready."
  default     = false
}

locals {
  staging_db_name      = "newapi_staging" // 手动建好的库，不由 TF 创建
  staging_db_user      = "newapi_staging_app"
  staging_backend_name = "newapi-staging"
  staging_website_name = "newapi-web-staging"
  staging_console_host = replace(replace(var.staging_console_origin, "https://", ""), "http://", "")
  staging_router_host  = replace(replace(var.staging_router_origin, "https://", ""), "http://", "")
  staging_website_host = replace(replace(var.staging_website_origin, "https://", ""), "http://", "")
  // 首次 apply 用公开占位镜像（此时 AR 里还没有 staging tag，避免"镜像不存在"创建失败）。
  // CI 首次部署会替换为真实镜像 server:staging-latest / website:staging-latest，
  // 且下方 lifecycle.ignore_changes 覆盖 image，故 TF 之后不再回退占位镜像。
  staging_placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"
}

// ---------------------------------------------------------------------------
// 独立凭证（随机生成，仅存 state，不进 plan 明文）
// ---------------------------------------------------------------------------
resource "random_password" "staging_db_password" {
  count       = var.enable_staging ? 1 : 0
  length      = 32
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

resource "random_password" "staging_session_secret" {
  count       = var.enable_staging ? 1 : 0
  length      = 48
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

resource "random_password" "staging_crypto_secret" {
  count       = var.enable_staging ? 1 : 0
  length      = 48
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

// ---------------------------------------------------------------------------
// 独立 DB 用户（建在现有生产实例 newapi-mysql 上，仅用于 staging 库）
// ---------------------------------------------------------------------------
resource "google_sql_user" "staging_app" {
  count    = var.enable_staging ? 1 : 0
  project  = var.project_id
  instance = module.cloud_sql.instance_name
  name     = local.staging_db_user
  host     = "%"
  password = random_password.staging_db_password[0].result
}

// ---------------------------------------------------------------------------
// 3 个 staging secret
// ---------------------------------------------------------------------------
resource "google_secret_manager_secret" "staging_sql_dsn" {
  count     = var.enable_staging ? 1 : 0
  project   = var.project_id
  secret_id = "newapi-staging-sql-dsn"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "staging_sql_dsn" {
  count  = var.enable_staging ? 1 : 0
  secret = google_secret_manager_secret.staging_sql_dsn[0].id
  // 用 cloud_sql 模块的 connection_name，确保 socket 路径与生产口径一致
  secret_data = format(
    "%s:%s@unix(/cloudsql/%s)/%s?parseTime=true&charset=utf8mb4&loc=UTC",
    local.staging_db_user,
    random_password.staging_db_password[0].result,
    module.cloud_sql.connection_name,
    local.staging_db_name,
  )
}

resource "google_secret_manager_secret" "staging_session_secret" {
  count     = var.enable_staging ? 1 : 0
  project   = var.project_id
  secret_id = "newapi-staging-session-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "staging_session_secret" {
  count       = var.enable_staging ? 1 : 0
  secret      = google_secret_manager_secret.staging_session_secret[0].id
  secret_data = random_password.staging_session_secret[0].result
}

resource "google_secret_manager_secret" "staging_crypto_secret" {
  count     = var.enable_staging ? 1 : 0
  project   = var.project_id
  secret_id = "newapi-staging-crypto-secret"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "staging_crypto_secret" {
  count       = var.enable_staging ? 1 : 0
  secret      = google_secret_manager_secret.staging_crypto_secret[0].id
  secret_data = random_password.staging_crypto_secret[0].result
}

// ---------------------------------------------------------------------------
// 独立 runtime SA（用户要求：与生产 newapi-runtime 身份隔离）
// ---------------------------------------------------------------------------
resource "google_service_account" "staging_runtime" {
  count        = var.enable_staging ? 1 : 0
  project      = var.project_id
  account_id   = "newapi-staging-runtime"
  display_name = "new-api STAGING Cloud Run runtime"
}

resource "google_service_account" "staging_web_runtime" {
  count        = var.enable_staging ? 1 : 0
  project      = var.project_id
  account_id   = "newapi-web-staging-runtime"
  display_name = "new-api STAGING website (Next.js) Cloud Run runtime"
}

// 后端 SA：cloudsql client + 读 3 个 staging secret + 日志/监控
resource "google_project_iam_member" "staging_runtime_cloudsql" {
  count   = var.enable_staging ? 1 : 0
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.staging_runtime[0].email}"
}

resource "google_project_iam_member" "staging_runtime_logging" {
  count   = var.enable_staging ? 1 : 0
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.staging_runtime[0].email}"
}

resource "google_project_iam_member" "staging_runtime_metrics" {
  count   = var.enable_staging ? 1 : 0
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.staging_runtime[0].email}"
}

locals {
  staging_secret_ids = var.enable_staging ? [
    google_secret_manager_secret.staging_sql_dsn[0].secret_id,
    google_secret_manager_secret.staging_session_secret[0].secret_id,
    google_secret_manager_secret.staging_crypto_secret[0].secret_id,
  ] : []
}

resource "google_secret_manager_secret_iam_member" "staging_runtime_secret_access" {
  for_each  = toset(local.staging_secret_ids)
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.staging_runtime[0].email}"
}

// 官网 SA：最小权限，仅日志/监控（无状态 SSR，不碰 DB/secret）
resource "google_project_iam_member" "staging_web_runtime_logging" {
  count   = var.enable_staging ? 1 : 0
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.staging_web_runtime[0].email}"
}

resource "google_project_iam_member" "staging_web_runtime_metrics" {
  count   = var.enable_staging ? 1 : 0
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.staging_web_runtime[0].email}"
}

// ---------------------------------------------------------------------------
// 后端 Cloud Run: newapi-staging（精简版，不挂 VPC / 不连 Redis / 固定单实例）
// ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "staging" {
  count    = var.enable_staging ? 1 : 0
  project  = var.project_id
  name     = local.staging_backend_name
  location = var.region

  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.staging_runtime[0].email

    scaling {
      min_instance_count = 1 // 常驻 1 避免冷启动
      max_instance_count = 1 // 固定单实例：dev/test 无需扩容，且内存缓存模式下单实例无一致性问题
    }
    max_instance_request_concurrency = 80
    timeout                          = "3600s"

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [module.cloud_sql.connection_name]
      }
    }

    containers {
      image = local.staging_placeholder_image // 占位；CI 首次部署替换为 server:staging-latest

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        cpu_idle          = true // 空闲 throttle CPU 省钱；请求处理期间 CPU 正常分配
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
        name  = "SQL_MAX_OPEN_CONNS" // 压低，保护共享生产实例
        value = "5"
      }
      env {
        name  = "SQL_MAX_IDLE_CONNS"
        value = "2"
      }
      env {
        name  = "SQL_MAX_LIFETIME"
        value = "60"
      }
      env {
        name  = "STREAMING_TIMEOUT"
        value = "300"
      }
      // FRONTEND_BASE_URL 在首次 apply 后用真实 run.app URL 回填（见方案 §4）。
      // staging console 需要由后端服务自身承载 dashboard，因此默认留空。
      env {
        name  = "FRONTEND_BASE_URL"
        value = var.staging_backend_frontend_base_url
      }
      env {
        name  = "OFFICIAL_WEBSITE_ORIGIN"
        value = var.staging_website_origin
      }
      env {
        name  = "APP_CONSOLE_ORIGIN"
        value = var.staging_console_origin
      }
      // Live staging env is owned by CI because env is lifecycle-ignored below; keep deploy workflows mirrored.
      env {
        name  = "COOKIE_SESSION_DOMAIN"
        value = local.staging_console_host == "flatkey.ai" || endswith(local.staging_console_host, ".flatkey.ai") ? ".flatkey.ai" : ""
      }
      env {
        name  = "SESSION_COOKIE_SECURE"
        value = "true"
      }

      env {
        name = "SQL_DSN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.staging_sql_dsn[0].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.staging_session_secret[0].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "CRYPTO_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.staging_crypto_secret[0].secret_id
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
    // CI/CD 独立滚镜像；与生产模块同款 ignore 约定
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

  depends_on = [
    google_secret_manager_secret_version.staging_sql_dsn,
    google_secret_manager_secret_iam_member.staging_runtime_secret_access,
    google_project_iam_member.staging_runtime_cloudsql,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "staging_public" {
  count    = var.enable_staging ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.staging[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

// ---------------------------------------------------------------------------
// 官网 Cloud Run: newapi-web-staging（复刻 cloud-run-web 范式，端口 4000）
// ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "staging_web" {
  count    = var.enable_staging ? 1 : 0
  project  = var.project_id
  name     = local.staging_website_name
  location = var.region

  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.staging_web_runtime[0].email

    scaling {
      min_instance_count = 1 // 避免冷启动
      max_instance_count = 1 // dev/test 单实例
    }
    max_instance_request_concurrency = 80
    timeout                          = "60s"

    containers {
      image = local.staging_placeholder_image // 占位；CI 首次部署替换为 website:staging-latest

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 4000
      }

      startup_probe {
        initial_delay_seconds = 5
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 30
        tcp_socket {
          port = 4000
        }
      }

      liveness_probe {
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3
        http_get {
          path = "/"
          port = 4000
        }
      }

      env {
        name  = "TZ"
        value = "UTC"
      }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      // 官网 staging 指向后端 staging（不串生产）；首次 apply 后回填真实 URL
      env {
        name  = "APP_CONSOLE_ORIGIN"
        value = var.staging_console_origin
      }
      env {
        name  = "SITE_ORIGIN"
        value = var.staging_website_origin
      }
      // Live staging env is owned by CI because env is lifecycle-ignored below; keep deploy workflows mirrored.
      env {
        name  = "COOKIE_SESSION_DOMAIN"
        value = local.staging_website_host == "flatkey.ai" || endswith(local.staging_website_host, ".flatkey.ai") ? ".flatkey.ai" : ""
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
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

resource "google_cloud_run_v2_service_iam_member" "staging_web_public" {
  count    = var.enable_staging ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.staging_web[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

// ---------------------------------------------------------------------------
// 独立 Cloud Run 域名映射：不加入生产 LB / lb_domains，避免生产证书轮换风险。
// DNS 需配置：
//   staging-console.flatkey.ai  CNAME  ghs.googlehosted.com
//   staging-router.flatkey.ai   CNAME  ghs.googlehosted.com
//   staging-website.flatkey.ai  CNAME  ghs.googlehosted.com
// ---------------------------------------------------------------------------
resource "google_cloud_run_domain_mapping" "staging_console_domain" {
  count    = var.enable_staging && var.enable_staging_domains ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = local.staging_console_host

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name       = google_cloud_run_v2_service.staging[0].name
    certificate_mode = "AUTOMATIC"
  }
}

resource "google_cloud_run_domain_mapping" "staging_router_domain" {
  count    = var.enable_staging && var.enable_staging_domains ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = local.staging_router_host

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name       = google_cloud_run_v2_service.staging[0].name
    certificate_mode = "AUTOMATIC"
  }
}

resource "google_cloud_run_domain_mapping" "staging_website_domain" {
  count    = var.enable_staging && var.enable_staging_domains ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = local.staging_website_host

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name       = google_cloud_run_v2_service.staging_web[0].name
    certificate_mode = "AUTOMATIC"
  }
}

// ---------------------------------------------------------------------------
// origin 变量（首次 apply 后用真实 run.app URL 回填，见方案 §4）
// ---------------------------------------------------------------------------
variable "staging_backend_frontend_base_url" {
  type        = string
  description = "Backend staging FRONTEND_BASE_URL. Keep empty so staging-console.flatkey.ai serves the embedded dashboard instead of redirecting NoRoute traffic."
  default     = ""
}

variable "staging_console_origin" {
  type        = string
  description = "Staging console/backend public origin."
  default     = "https://staging-console.flatkey.ai"
}

variable "staging_router_origin" {
  type        = string
  description = "Staging API router public origin."
  default     = "https://staging-router.flatkey.ai"
}

variable "staging_website_origin" {
  type        = string
  description = "Staging website public origin."
  default     = "https://staging-website.flatkey.ai"
}

// ---------------------------------------------------------------------------
// 输出：首次 apply 后从这里取真实 URL 回填上面三个 var
// ---------------------------------------------------------------------------
output "staging_backend_url" {
  value = var.enable_staging ? google_cloud_run_v2_service.staging[0].uri : ""
}

output "staging_website_url" {
  value = var.enable_staging ? google_cloud_run_v2_service.staging_web[0].uri : ""
}

output "staging_console_domain" {
  value = var.enable_staging ? var.staging_console_origin : ""
}

output "staging_router_domain" {
  value = var.enable_staging ? var.staging_router_origin : ""
}

output "staging_website_domain" {
  value = var.enable_staging ? var.staging_website_origin : ""
}
