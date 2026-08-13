locals {
  browser_qa_artifact_repository_id = "flatkey-staging-browser-qa"
  browser_qa_broker_service_name    = "flatkey-staging-browser-qa-broker"
  browser_qa_main_job_name          = "flatkey-staging-browser-qa"
  browser_qa_cleanup_job_name       = "flatkey-staging-browser-qa-cleanup"
  browser_qa_report_bucket_name     = "${var.project_id}-flatkey-browser-qa-reports"
  browser_qa_placeholder_image      = "us-docker.pkg.dev/cloudrun/container/hello"
  browser_qa_github_repository      = "SolveaCX/new-api"
  browser_qa_github_ref             = "refs/heads/staging"
}

resource "google_artifact_registry_repository" "browser_qa" {
  project       = var.project_id
  location      = var.region
  repository_id = local.browser_qa_artifact_repository_id
  format        = "DOCKER"
  description   = "Container images for isolated staging browser QA"

  cleanup_policies {
    id     = "keep-recent-25"
    action = "KEEP"
    most_recent_versions {
      keep_count = 25
    }
  }

  cleanup_policies {
    id     = "delete-untagged-after-7d"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s"
    }
  }
}

resource "google_service_account" "browser_qa_runtime" {
  project      = var.project_id
  account_id   = "flatkey-browser-qa-runtime"
  display_name = "Flatkey browser QA main runtime"
}

resource "google_service_account" "browser_qa_broker" {
  project      = var.project_id
  account_id   = "flatkey-browser-qa-broker"
  display_name = "Flatkey browser QA broker runtime"
}

resource "google_service_account" "browser_qa_cleanup" {
  project      = var.project_id
  account_id   = "flatkey-browser-qa-cleanup"
  display_name = "Flatkey browser QA cleanup runtime"
}

resource "google_service_account" "browser_qa_deployer" {
  project      = var.project_id
  account_id   = "flatkey-browser-qa-deployer"
  display_name = "Flatkey browser QA GitHub deployer"
}

resource "google_project_iam_member" "browser_qa_runtime_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.browser_qa_runtime.email}"
}

resource "google_project_iam_member" "browser_qa_broker_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.browser_qa_broker.email}"
}

resource "google_project_iam_member" "browser_qa_cleanup_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.browser_qa_cleanup.email}"
}

resource "google_secret_manager_secret" "browser_qa_codex_api_key" {
  project   = var.project_id
  secret_id = "flatkey-browser-qa-codex-api-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "browser_qa_identity_seed" {
  project   = var.project_id
  secret_id = "flatkey-browser-qa-identity-seed"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "browser_qa_gmail_oauth" {
  project   = var.project_id
  secret_id = "flatkey-browser-qa-gmail-oauth"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_iam_member" "browser_qa_runtime_codex_api_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.browser_qa_codex_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.browser_qa_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "browser_qa_runtime_identity_seed" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.browser_qa_identity_seed.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.browser_qa_runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "browser_qa_cleanup_identity_seed" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.browser_qa_identity_seed.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.browser_qa_cleanup.email}"
}

resource "google_secret_manager_secret_iam_member" "browser_qa_broker_gmail_oauth" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.browser_qa_gmail_oauth.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.browser_qa_broker.email}"
}

resource "google_cloud_run_v2_service" "browser_qa_broker" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  name     = local.browser_qa_broker_service_name
  location = var.region

  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account                  = google_service_account.browser_qa_broker.email
    max_instance_request_concurrency = 10
    timeout                          = "300s"

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = local.browser_qa_placeholder_image
      args  = ["broker"]

      ports {
        container_port = 8080
      }

      env {
        name = "GMAIL_OAUTH_JSON"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.browser_qa_gmail_oauth.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_secret_manager_secret_iam_member.browser_qa_broker_gmail_oauth,
    google_project_iam_member.browser_qa_broker_log_writer,
  ]
}

resource "google_cloud_run_v2_job" "browser_qa_main" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  name     = local.browser_qa_main_job_name
  location = var.region

  template {
    task_count  = 1
    parallelism = 1

    template {
      service_account = google_service_account.browser_qa_runtime.email
      max_retries     = 0
      timeout         = "1200s"

      containers {
        image = local.browser_qa_placeholder_image
        args  = ["main"]

        resources {
          limits = {
            memory = "2Gi"
          }
        }

        env {
          name = "CODEX_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.browser_qa_codex_api_key.secret_id
              version = "latest"
            }
          }
        }
        env {
          name = "FLATKEY_QA_IDENTITY_SEED_B64"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.browser_qa_identity_seed.secret_id
              version = "latest"
            }
          }
        }
        env {
          name  = "FLATKEY_QA_WEBSITE_ORIGIN"
          value = "https://staging-website.flatkey.ai"
        }
        env {
          name  = "FLATKEY_QA_CONSOLE_ORIGIN"
          value = "https://staging-console.flatkey.ai"
        }
        env {
          name  = "FLATKEY_QA_DOCS_ORIGIN"
          value = "https://docs.flatkey.ai"
        }
        env {
          name  = "FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES"
          value = "8192"
        }
        env {
          name  = "FLATKEY_BROWSER_QA_BROKER_URL"
          value = google_cloud_run_v2_service.browser_qa_broker[count.index].uri
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_cloud_run_v2_service.browser_qa_broker,
    google_secret_manager_secret_iam_member.browser_qa_runtime_codex_api_key,
    google_secret_manager_secret_iam_member.browser_qa_runtime_identity_seed,
    google_project_iam_member.browser_qa_runtime_log_writer,
  ]
}

resource "google_cloud_run_v2_job" "browser_qa_cleanup" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  name     = local.browser_qa_cleanup_job_name
  location = var.region

  template {
    task_count  = 1
    parallelism = 1

    template {
      service_account = google_service_account.browser_qa_cleanup.email
      max_retries     = 0
      timeout         = "300s"

      containers {
        image = local.browser_qa_placeholder_image
        args  = ["cleanup"]

        env {
          name = "FLATKEY_QA_IDENTITY_SEED_B64"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.browser_qa_identity_seed.secret_id
              version = "latest"
            }
          }
        }
        env {
          name  = "FLATKEY_QA_CONSOLE_ORIGIN"
          value = "https://staging-console.flatkey.ai"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_secret_manager_secret_iam_member.browser_qa_cleanup_identity_seed,
    google_project_iam_member.browser_qa_cleanup_log_writer,
  ]
}

resource "google_storage_bucket" "browser_qa_reports" {
  project                     = var.project_id
  name                        = local.browser_qa_report_bucket_name
  location                    = upper(var.region)
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 14
    }
  }
}

resource "google_storage_bucket_iam_member" "browser_qa_runtime_report_creator" {
  bucket = google_storage_bucket.browser_qa_reports.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.browser_qa_runtime.email}"
}

resource "google_storage_bucket_iam_member" "browser_qa_cleanup_report_admin" {
  bucket = google_storage_bucket.browser_qa_reports.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.browser_qa_cleanup.email}"
}

resource "google_storage_bucket_iam_member" "browser_qa_deployer_report_viewer" {
  bucket = google_storage_bucket.browser_qa_reports.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_iam_workload_identity_pool" "browser_qa_github" {
  project                   = var.project_id
  workload_identity_pool_id = "flatkey-browser-qa-github"
  display_name              = "Flatkey browser QA GitHub"
  description               = "OIDC trust for staging branch browser QA"
}

resource "google_iam_workload_identity_pool_provider" "browser_qa_github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.browser_qa_github.workload_identity_pool_id
  workload_identity_pool_provider_id = "staging"
  display_name                       = "Staging branch browser QA"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == 'SolveaCX/new-api' && assertion.ref == 'refs/heads/staging'"
}

resource "google_service_account_iam_member" "browser_qa_wif_deployer" {
  service_account_id = google_service_account.browser_qa_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/${google_iam_workload_identity_pool.browser_qa_github.name}/subject/repo:SolveaCX/new-api:ref:refs/heads/staging"
}

resource "google_service_account_iam_member" "browser_qa_runtime_user" {
  service_account_id = google_service_account.browser_qa_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_service_account_iam_member" "browser_qa_broker_user" {
  service_account_id = google_service_account.browser_qa_broker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_service_account_iam_member" "browser_qa_cleanup_user" {
  service_account_id = google_service_account.browser_qa_cleanup.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_artifact_registry_repository_iam_member" "browser_qa_deployer_writer" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.browser_qa.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_cloud_run_v2_service_iam_member" "browser_qa_broker_invoker" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.browser_qa_broker[count.index].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.browser_qa_runtime.email}"
}

resource "google_cloud_run_v2_service_iam_member" "browser_qa_broker_deployer_developer" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.browser_qa_broker[count.index].name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_cloud_run_v2_job_iam_member" "browser_qa_main_deployer_developer" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.browser_qa_main[count.index].name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_cloud_run_v2_job_iam_member" "browser_qa_main_deployer_invoker" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.browser_qa_main[count.index].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_cloud_run_v2_job_iam_member" "browser_qa_cleanup_deployer_developer" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.browser_qa_cleanup[count.index].name
  role     = "roles/run.developer"
  member   = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}

resource "google_cloud_run_v2_job_iam_member" "browser_qa_cleanup_deployer_invoker" {
  count = var.create_workloads ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.browser_qa_cleanup[count.index].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.browser_qa_deployer.email}"
}
