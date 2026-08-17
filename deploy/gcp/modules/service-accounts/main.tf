// Two SAs:
//   runtime  — attached to Cloud Run service; reads secrets and connects to Cloud SQL
//   deployer — used by GitHub Actions (via WIF) to push images and deploy Cloud Run

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "newapi-runtime"
  display_name = "new-api Cloud Run runtime"
}

resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = "newapi-ci-deployer"
  display_name = "new-api CI/CD deployer (GitHub Actions via WIF)"
}

// Runtime SA permissions
resource "google_project_iam_member" "runtime_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

// Per-secret accessor grant for runtime SA
resource "google_secret_manager_secret_iam_member" "runtime_secret_access" {
  for_each = toset(var.runtime_secret_ids)

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_metrics" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_trace" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

// Deployer SA permissions (least-privilege CI/CD)
resource "google_project_iam_member" "deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "deployer_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "deployer_sa_user" {
  // Required so deployer can deploy a Cloud Run revision that runs as the runtime SA
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}
