locals {
  resource_prefix    = "${var.name_prefix}-new-api"
  service_account_id = "${var.name_prefix}-na-run"

  labels = {
    app      = "new-api"
    customer = var.name_prefix
    managed  = "terraform"
  }

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
  ])

  network_id = var.create_network ? google_compute_network.vpc[0].id : data.google_compute_network.existing[0].id
  subnet_id  = var.create_network ? google_compute_subnetwork.cloud_run[0].id : data.google_compute_subnetwork.existing[0].id

  sql_dsn = "postgresql://${var.database_user}:${urlencode(random_password.database.result)}@${google_sql_database_instance.postgres.private_ip_address}:5432/${google_sql_database.app.name}?sslmode=disable"

  redis_conn_string = var.redis_auth_enabled ? "redis://:${urlencode(google_redis_instance.cache.auth_string)}@${google_redis_instance.cache.host}:${google_redis_instance.cache.port}/0" : "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}/0"

  common_env = merge({
    TZ                   = var.timezone
    GIN_MODE             = "release"
    ERROR_LOG_ENABLED    = "true"
    BATCH_UPDATE_ENABLED = "true"
    SYNC_FREQUENCY       = "60"
    SQL_MAX_OPEN_CONNS   = "80"
    SQL_MAX_IDLE_CONNS   = "20"
    REDIS_POOL_SIZE      = "20"
    STREAMING_TIMEOUT    = "3500"
  }, var.extra_env)
}
