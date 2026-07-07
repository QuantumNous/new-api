// Root composition for the prod environment.
// Dependency order: apis → (network | artifact-registry | secrets) → cloud-sql / memorystore
// → derived secrets (SQL_DSN, REDIS_URL) → service-accounts → wif → cloud-run → monitoring.

locals {
  required_apis = [
    "serviceusage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "compute.googleapis.com",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "sts.googleapis.com",
    "servicenetworking.googleapis.com",
    "vpcaccess.googleapis.com",
  ]
}

module "apis" {
  source     = "../../modules/apis"
  project_id = var.project_id
  apis       = local.required_apis
}

module "network" {
  source     = "../../modules/network"
  project_id = var.project_id
  region     = var.region

  depends_on = [module.apis]
}

module "artifact_registry" {
  source     = "../../modules/artifact-registry"
  project_id = var.project_id
  region     = var.region

  depends_on = [module.apis]
}

module "secrets" {
  source     = "../../modules/secrets"
  project_id = var.project_id

  // Placeholders for values the operator fills in manually after first apply.
  placeholder_secrets = [
    "newapi-github-client-id",
    "newapi-github-client-secret",
    "newapi-stripe-secret-key",
  ]

  depends_on = [module.apis]
}

module "cloud_sql" {
  source       = "../../modules/cloud-sql"
  project_id   = var.project_id
  region       = var.region
  zone         = var.zone
  app_password = module.secrets.db_app_password

  # 2c/4GB -> 4c/16GB (2026-06-12): logs analytics queries thrash the buffer
  # pool; changing tier restarts the ZONAL instance (~2-5 min downtime).
  tier = "db-custom-4-16384"

  depends_on = [module.apis]
}

module "memorystore" {
  source     = "../../modules/memorystore"
  project_id = var.project_id
  region     = var.region
  zone       = var.zone
  network_id = module.network.network_id

  depends_on = [module.apis]
}

// SQL_DSN — the full DSN string for new-api, including resolved password and
// the Cloud SQL Auth Proxy socket path. Stored as a secret so the Cloud Run
// revision injects it as an env var without it ever appearing in plan output.
resource "google_secret_manager_secret" "sql_dsn" {
  project   = var.project_id
  secret_id = "newapi-sql-dsn"

  replication {
    auto {}
  }

  depends_on = [module.apis]
}

resource "google_secret_manager_secret_version" "sql_dsn" {
  secret = google_secret_manager_secret.sql_dsn.id
  secret_data = format(
    "%s:%s@unix(/cloudsql/%s)/%s?parseTime=true&charset=utf8mb4&loc=UTC",
    module.cloud_sql.app_user,
    module.secrets.db_app_password,
    module.cloud_sql.connection_name,
    module.cloud_sql.database_name,
  )
}

resource "google_secret_manager_secret" "redis_url" {
  project   = var.project_id
  secret_id = "newapi-redis-url"

  replication {
    auto {}
  }

  depends_on = [module.apis]
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = module.memorystore.redis_url
}

// Static shared token for the BlockRun usage reconciliation endpoints
// (BLOCKRUN_USAGE_SUMMARY_TOKEN, consumed by GET /usage/summary + /usage/transactions).
// Created empty here — the operator adds the value out-of-band:
//   printf '%s' '<token>' | gcloud secrets versions add newapi-blockrun-usage-summary-token \
//     --project=vocai-gemini-prod --data-file=-
// then flips var.enable_usage_recon_token to wire it into Cloud Run (see cloud_run below).
resource "google_secret_manager_secret" "blockrun_usage_summary_token" {
  project   = var.project_id
  secret_id = "newapi-blockrun-usage-summary-token"

  replication {
    auto {}
  }

  depends_on = [module.apis]
}

module "service_accounts" {
  source     = "../../modules/service-accounts"
  project_id = var.project_id

  runtime_secret_ids = concat(
    module.secrets.all_managed_secret_ids,
    [
      google_secret_manager_secret.sql_dsn.secret_id,
      google_secret_manager_secret.redis_url.secret_id,
      google_secret_manager_secret.blockrun_usage_summary_token.secret_id,
    ],
  )

  depends_on = [module.apis]
}

module "github_wif" {
  source            = "../../modules/github-wif"
  project_id        = var.project_id
  github_repository = var.github_repository
  deployer_sa_name  = module.service_accounts.deployer_name

  depends_on = [module.apis]
}

module "cloud_run" {
  source           = "../../modules/cloud-run"
  enabled          = var.enable_legacy_runtime
  project_id       = var.project_id
  region           = var.region
  service_name     = var.service_name
  runtime_sa_email = module.service_accounts.runtime_email
  ingress          = var.cloud_run_ingress

  network_id = module.network.network_id
  subnet_id  = module.network.subnet_id

  cloudsql_connection_name = module.cloud_sql.connection_name
  db_user                  = module.cloud_sql.app_user
  db_name                  = module.cloud_sql.database_name

  sql_dsn_secret_id   = google_secret_manager_secret.sql_dsn.secret_id
  redis_url_secret_id = google_secret_manager_secret.redis_url.secret_id
  session_secret_id   = module.secrets.session_secret_id
  crypto_secret_id    = module.secrets.crypto_secret_id

  // Only wired once the operator has added the token value and flipped the flag,
  // so a plain `terraform apply` before then never injects a versionless secret.
  usage_recon_token_secret_id = var.enable_usage_recon_token ? google_secret_manager_secret.blockrun_usage_summary_token.secret_id : ""

  frontend_base_url = var.frontend_base_url
  custom_domains    = var.custom_domains

  // Scaling override（2026-05-25）：
  //   - 当前 ~2% 5xx 基线，监控显示高峰仅 2 个实例运行（远低于 maxScale=10）
  //   - 503 是 autoscaler 反应不够快 + 流式 LLM 单实例瞬时并发饱和导致
  //   - 提高 min_instances 让突发到来时已有更多温实例；
  //   - 降低 concurrency 让 autoscaler 在更低阈值触发扩容
  //   - max_instances 保持 10（峰值远未及）
  min_instances = 4
  concurrency   = 50

  depends_on = [
    module.apis,
    google_secret_manager_secret_version.sql_dsn,
    google_secret_manager_secret_version.redis_url,
  ]
}

module "cloud_run_router" {
  count = var.enable_runtime_split ? 1 : 0

  source           = "../../modules/cloud-run"
  project_id       = var.project_id
  region           = var.region
  service_name     = var.router_service_name
  runtime_sa_email = module.service_accounts.runtime_email
  ingress          = var.cloud_run_ingress

  network_id = module.network.network_id
  subnet_id  = module.network.subnet_id

  cloudsql_connection_name = module.cloud_sql.connection_name
  db_user                  = module.cloud_sql.app_user
  db_name                  = module.cloud_sql.database_name

  sql_dsn_secret_id   = google_secret_manager_secret.sql_dsn.secret_id
  redis_url_secret_id = google_secret_manager_secret.redis_url.secret_id
  session_secret_id   = module.secrets.session_secret_id
  crypto_secret_id    = module.secrets.crypto_secret_id

  usage_recon_token_secret_id = var.enable_usage_recon_token ? google_secret_manager_secret.blockrun_usage_summary_token.secret_id : ""

  frontend_base_url = var.frontend_base_url
  custom_domains    = []
  min_instances     = var.router_min_instances
  max_instances     = var.router_max_instances
  concurrency       = var.router_concurrency
  memory            = var.router_memory
  node_type         = "slave"

  depends_on = [
    module.apis,
    google_secret_manager_secret_version.sql_dsn,
    google_secret_manager_secret_version.redis_url,
  ]
}

module "cloud_run_console" {
  count = var.enable_runtime_split ? 1 : 0

  source           = "../../modules/cloud-run"
  project_id       = var.project_id
  region           = var.region
  service_name     = var.console_service_name
  runtime_sa_email = module.service_accounts.runtime_email
  ingress          = var.cloud_run_ingress

  network_id = module.network.network_id
  subnet_id  = module.network.subnet_id

  cloudsql_connection_name = module.cloud_sql.connection_name
  db_user                  = module.cloud_sql.app_user
  db_name                  = module.cloud_sql.database_name

  sql_dsn_secret_id   = google_secret_manager_secret.sql_dsn.secret_id
  redis_url_secret_id = google_secret_manager_secret.redis_url.secret_id
  session_secret_id   = module.secrets.session_secret_id
  crypto_secret_id    = module.secrets.crypto_secret_id

  usage_recon_token_secret_id = var.enable_usage_recon_token ? google_secret_manager_secret.blockrun_usage_summary_token.secret_id : ""

  frontend_base_url = ""
  custom_domains    = []
  min_instances     = var.console_min_instances
  max_instances     = var.console_max_instances
  concurrency       = var.console_concurrency
  node_type         = "master"

  depends_on = [
    module.apis,
    google_secret_manager_secret_version.sql_dsn,
    google_secret_manager_secret_version.redis_url,
  ]
}

// External HTTPS LB sitting in front of Cloud Run, used when the operator lacks
// run.domainmappings.create permission.
// --- Standalone Next.js marketing website (apex flatkey.ai + www) ---
// A SEPARATE Cloud Run service (port 4000, no VPC/SQL) with a minimal runtime SA.
// Everything here is gated by var.enable_website, so the existing stack is
// untouched until the operator opts in. The LB host-based split (below) sends
// var.website_domains to this service and leaves all other hosts on the Go app.

resource "google_service_account" "web_runtime" {
  count = var.enable_website ? 1 : 0

  project      = var.project_id
  account_id   = "newapi-web-runtime"
  display_name = "new-api website (Next.js) Cloud Run runtime"
}

resource "google_project_iam_member" "web_runtime_log_writer" {
  count = var.enable_website ? 1 : 0

  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.web_runtime[0].email}"
}

resource "google_project_iam_member" "web_runtime_metric_writer" {
  count = var.enable_website ? 1 : 0

  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.web_runtime[0].email}"
}

module "cloud_run_web" {
  count = var.enable_website ? 1 : 0

  source                = "../../modules/cloud-run-web"
  project_id            = var.project_id
  region                = var.region
  service_name          = var.website_service_name
  runtime_sa_email      = google_service_account.web_runtime[0].email
  app_console_origin    = var.website_app_console_origin
  router_origin         = var.website_router_origin
  site_origin           = var.website_site_origin
  cookie_session_domain = var.website_cookie_session_domain

  depends_on = [module.apis]
}

module "cloud_lb" {
  count = var.enable_load_balancer ? 1 : 0

  source                 = "../../modules/cloud-lb"
  project_id             = var.project_id
  region                 = var.region
  cloud_run_service_name = var.enable_legacy_runtime ? module.cloud_run.service_name : ""
  default_backend        = var.lb_default_backend
  domains                = var.lb_domains

  // Host-based split: when the website is enabled, route var.website_domains to
  // the Next.js backend; all other hosts stay on the Go backend. Empty otherwise.
  website_cloud_run_service_name = var.enable_website ? module.cloud_run_web[0].service_name : ""
  website_domains                = var.website_domains

  // Runtime split: create optional backend services first with domains=[], then
  // add host rules in a later apply to cut traffic over without cert/DNS churn.
  router_cloud_run_service_name        = var.enable_runtime_split ? module.cloud_run_router[0].service_name : ""
  router_domains                       = var.router_domains
  console_cloud_run_service_name       = var.enable_runtime_split ? module.cloud_run_console[0].service_name : ""
  console_domains                      = var.console_domains
  console_domains_require_managed_cert = var.console_domains_require_managed_cert

  depends_on = [
    module.apis,
    module.cloud_run,
    module.cloud_run_web,
    module.cloud_run_router,
    module.cloud_run_console,
  ]
}

// Uptime check target priority:
//   1. First lb_domain (when LB is enabled) — needs DNS pointed for SSL to work
//   2. First custom_domain (when domain mappings are enabled)
//   3. Cloud Run *.run.app URL (fallback)
locals {
  legacy_service_uri  = var.enable_legacy_runtime ? trimprefix(module.cloud_run.service_uri, "https://") : ""
  console_service_uri = var.enable_runtime_split ? trimprefix(module.cloud_run_console[0].service_uri, "https://") : ""
  router_service_uri  = var.enable_runtime_split ? trimprefix(module.cloud_run_router[0].service_uri, "https://") : ""
  uptime_host = (
    var.enable_load_balancer && var.lb_default_backend == "console" && length(var.console_domains) > 0 ? var.console_domains[0] :
    var.enable_load_balancer && var.lb_default_backend == "router" && length(var.router_domains) > 0 ? var.router_domains[0] :
    var.enable_load_balancer && length(var.lb_domains) > 0 ? var.lb_domains[0] :
    var.enable_legacy_runtime && length(var.custom_domains) > 0 ? var.custom_domains[0] :
    var.enable_legacy_runtime ? local.legacy_service_uri :
    var.enable_runtime_split && var.lb_default_backend == "console" ? local.console_service_uri :
    var.enable_runtime_split && var.lb_default_backend == "router" ? local.router_service_uri :
    local.console_service_uri
  )
}

module "monitoring" {
  source               = "../../modules/monitoring"
  project_id           = var.project_id
  region               = var.region
  uptime_host          = local.uptime_host
  alert_email          = var.alert_email
  alert_emails         = var.alert_emails
  router_service_name  = var.router_service_name
  router_max_instances = var.router_max_instances
  redis_instance_id = format(
    "projects/%s/locations/%s/instances/newapi-redis",
    var.project_id,
    var.region,
  )

  depends_on = [module.cloud_run, module.cloud_run_console, module.cloud_run_router]
}
