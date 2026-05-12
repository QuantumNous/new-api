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

module "service_accounts" {
  source     = "../../modules/service-accounts"
  project_id = var.project_id

  runtime_secret_ids = concat(
    module.secrets.all_managed_secret_ids,
    [
      google_secret_manager_secret.sql_dsn.secret_id,
      google_secret_manager_secret.redis_url.secret_id,
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

  frontend_base_url = var.frontend_base_url
  custom_domains    = var.custom_domains

  depends_on = [
    module.apis,
    google_secret_manager_secret_version.sql_dsn,
    google_secret_manager_secret_version.redis_url,
  ]
}

// External HTTPS LB sitting in front of Cloud Run, used when the operator lacks
// run.domainmappings.create permission.
module "cloud_lb" {
  count = var.enable_load_balancer ? 1 : 0

  source                 = "../../modules/cloud-lb"
  project_id             = var.project_id
  region                 = var.region
  cloud_run_service_name = module.cloud_run.service_name
  domains                = var.lb_domains

  depends_on = [module.apis, module.cloud_run]
}

// Uptime check target priority:
//   1. First lb_domain (when LB is enabled) — needs DNS pointed for SSL to work
//   2. First custom_domain (when domain mappings are enabled)
//   3. Cloud Run *.run.app URL (fallback)
locals {
  uptime_host = (
    var.enable_load_balancer && length(var.lb_domains) > 0 ? var.lb_domains[0] :
    length(var.custom_domains) > 0 ? var.custom_domains[0] :
    trimprefix(module.cloud_run.service_uri, "https://")
  )
}

module "monitoring" {
  source      = "../../modules/monitoring"
  project_id  = var.project_id
  uptime_host = local.uptime_host
  alert_email = var.alert_email

  depends_on = [module.cloud_run]
}
