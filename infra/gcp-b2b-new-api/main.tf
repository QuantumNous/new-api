resource "google_project_service" "required" {
  for_each = var.enable_project_services ? local.required_services : toset([])

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

resource "google_compute_network" "vpc" {
  count = var.create_network ? 1 : 0

  project                 = var.project_id
  name                    = "${local.resource_prefix}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "cloud_run" {
  count = var.create_network ? 1 : 0

  project                  = var.project_id
  name                     = "${local.resource_prefix}-subnet"
  region                   = var.region
  network                  = google_compute_network.vpc[0].id
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true
}

data "google_compute_network" "existing" {
  count = var.create_network ? 0 : 1

  project = var.project_id
  name    = var.network_name
}

data "google_compute_subnetwork" "existing" {
  count = var.create_network ? 0 : 1

  project = var.project_id
  region  = var.region
  name    = var.subnet_name
}

resource "google_compute_global_address" "private_service_range" {
  count = var.create_private_service_connection ? 1 : 0

  project       = var.project_id
  name          = "${local.resource_prefix}-psa"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = var.private_service_range_prefix_length
  network       = local.network_id

  depends_on = [google_project_service.required]
}

resource "google_service_networking_connection" "private_service_access" {
  count = var.create_private_service_connection ? 1 : 0

  network                 = local.network_id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range[0].name]
}

resource "random_password" "database" {
  length  = 32
  special = false
}

resource "random_password" "session_secret" {
  length  = 64
  special = false
}

resource "random_password" "crypto_secret" {
  length  = 64
  special = false
}

resource "google_sql_database_instance" "postgres" {
  project          = var.project_id
  name             = "${local.resource_prefix}-pg"
  region           = var.region
  database_version = var.postgres_version

  deletion_protection = var.sql_deletion_protection

  settings {
    tier              = var.sql_tier
    availability_type = var.sql_availability_type
    disk_type         = "PD_SSD"
    disk_size         = var.sql_disk_size_gb
    disk_autoresize   = true
    user_labels       = local.labels

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "18:00"
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = local.network_id
      enable_private_path_for_google_cloud_services = true
    }

    maintenance_window {
      day          = 7
      hour         = 19
      update_track = "stable"
    }
  }

  depends_on = [
    google_project_service.required,
    google_service_networking_connection.private_service_access,
  ]
}

resource "google_sql_database" "app" {
  project  = var.project_id
  name     = var.database_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app" {
  project  = var.project_id
  name     = var.database_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.database.result
}

resource "google_redis_instance" "cache" {
  project        = var.project_id
  name           = "${local.resource_prefix}-redis"
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region

  authorized_network = local.network_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  redis_version      = var.redis_version
  auth_enabled       = var.redis_auth_enabled
  labels             = local.labels

  depends_on = [
    google_project_service.required,
    google_service_networking_connection.private_service_access,
  ]

  timeouts {
    create = "30m"
    update = "30m"
    delete = "30m"
  }
}

resource "google_secret_manager_secret" "sql_dsn" {
  project   = var.project_id
  secret_id = "${local.resource_prefix}-sql-dsn"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "sql_dsn" {
  secret      = google_secret_manager_secret.sql_dsn.id
  secret_data = local.sql_dsn
}

resource "google_secret_manager_secret" "redis_conn" {
  project   = var.project_id
  secret_id = "${local.resource_prefix}-redis-conn"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "redis_conn" {
  secret      = google_secret_manager_secret.redis_conn.id
  secret_data = local.redis_conn_string
}

resource "google_secret_manager_secret" "session_secret" {
  project   = var.project_id
  secret_id = "${local.resource_prefix}-session-secret"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "session_secret" {
  secret      = google_secret_manager_secret.session_secret.id
  secret_data = random_password.session_secret.result
}

resource "google_secret_manager_secret" "crypto_secret" {
  project   = var.project_id
  secret_id = "${local.resource_prefix}-crypto-secret"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "crypto_secret" {
  secret      = google_secret_manager_secret.crypto_secret.id
  secret_data = random_password.crypto_secret.result
}

resource "google_service_account" "run" {
  project      = var.project_id
  account_id   = local.service_account_id
  display_name = "${local.resource_prefix} Cloud Run"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "run_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_sql_dsn" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.sql_dsn.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_redis_conn" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.redis_conn.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_session_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.session_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_crypto_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.crypto_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}

resource "google_cloud_run_v2_service" "master" {
  project  = var.project_id
  name     = "${local.resource_prefix}-master"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  deletion_protection = false

  template {
    service_account                  = google_service_account.run.email
    timeout                          = "${var.request_timeout_seconds}s"
    max_instance_request_concurrency = var.master_concurrency

    scaling {
      min_instance_count = 1
      max_instance_count = 1
    }

    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"

      network_interfaces {
        network    = local.network_id
        subnetwork = local.subnet_id
      }
    }

    containers {
      image = var.image
      args  = ["--log-dir="]

      ports {
        container_port = 3000
      }

      dynamic "env" {
        for_each = local.common_env
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name  = "NODE_TYPE"
        value = "master"
      }

      env {
        name  = "NODE_NAME"
        value = "${local.resource_prefix}-master"
      }

      env {
        name = "SQL_DSN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.sql_dsn.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "REDIS_CONN_STRING"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_conn.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "CRYPTO_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.crypto_secret.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle          = false
        startup_cpu_boost = true
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.run_sql_dsn,
    google_secret_manager_secret_iam_member.run_redis_conn,
    google_secret_manager_secret_iam_member.run_session_secret,
    google_secret_manager_secret_iam_member.run_crypto_secret,
    google_secret_manager_secret_version.sql_dsn,
    google_secret_manager_secret_version.redis_conn,
    google_secret_manager_secret_version.session_secret,
    google_secret_manager_secret_version.crypto_secret,
    google_project_iam_member.run_cloudsql_client,
    google_sql_database.app,
    google_sql_user.app,
    google_redis_instance.cache,
  ]
}

resource "google_cloud_run_v2_service" "web" {
  project  = var.project_id
  name     = "${local.resource_prefix}-web"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    service_account                  = google_service_account.run.email
    timeout                          = "${var.request_timeout_seconds}s"
    max_instance_request_concurrency = var.web_concurrency

    scaling {
      min_instance_count = var.web_min_instances
      max_instance_count = var.web_max_instances
    }

    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"

      network_interfaces {
        network    = local.network_id
        subnetwork = local.subnet_id
      }
    }

    containers {
      image = var.image
      args  = ["--log-dir="]

      ports {
        container_port = 3000
      }

      dynamic "env" {
        for_each = local.common_env
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name  = "NODE_TYPE"
        value = "slave"
      }

      env {
        name  = "NODE_NAME"
        value = "${local.resource_prefix}-web"
      }

      dynamic "env" {
        for_each = var.trusted_redirect_domains == "" ? [] : [var.trusted_redirect_domains]
        content {
          name  = "TRUSTED_REDIRECT_DOMAINS"
          value = env.value
        }
      }

      env {
        name = "SQL_DSN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.sql_dsn.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "REDIS_CONN_STRING"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_conn.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "CRYPTO_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.crypto_secret.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
        cpu_idle          = false
        startup_cpu_boost = true
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.run_sql_dsn,
    google_secret_manager_secret_iam_member.run_redis_conn,
    google_secret_manager_secret_iam_member.run_session_secret,
    google_secret_manager_secret_iam_member.run_crypto_secret,
    google_secret_manager_secret_version.sql_dsn,
    google_secret_manager_secret_version.redis_conn,
    google_secret_manager_secret_version.session_secret,
    google_secret_manager_secret_version.crypto_secret,
    google_project_iam_member.run_cloudsql_client,
    google_sql_database.app,
    google_sql_user.app,
    google_redis_instance.cache,
    google_cloud_run_v2_service.master,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
