output "browser_qa_artifact_registry_url" {
  description = "Set this as the GH Actions variable GCP_BROWSER_QA_AR_REPO_URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.browser_qa.repository_id}"
}

output "browser_qa_wif_provider" {
  description = "Set this as the GH Actions variable GCP_BROWSER_QA_WIF_PROVIDER"
  value       = google_iam_workload_identity_pool_provider.browser_qa_github.name
}

output "browser_qa_deployer_sa_email" {
  description = "Set this as the GH Actions variable GCP_BROWSER_QA_DEPLOYER_SA"
  value       = google_service_account.browser_qa_deployer.email
}

output "browser_qa_report_bucket" {
  description = "Set this as the GH Actions variable GCP_BROWSER_QA_GCS_BUCKET"
  value       = google_storage_bucket.browser_qa_reports.name
}

output "browser_qa_broker_uri" {
  description = "Private broker service URI used by the browser QA runtime"
  value       = one(google_cloud_run_v2_service.browser_qa_broker[*].uri)
}

output "browser_qa_broker_service_name" {
  description = "Cloud Run service name matching the GCP Browser QA workflow QA_BROKER_SERVICE env"
  value       = one(google_cloud_run_v2_service.browser_qa_broker[*].name)
}

output "browser_qa_main_job_name" {
  description = "Cloud Run job name matching the GCP Browser QA workflow QA_MAIN_JOB env"
  value       = one(google_cloud_run_v2_job.browser_qa_main[*].name)
}

output "browser_qa_cleanup_job_name" {
  description = "Cloud Run job name matching the GCP Browser QA workflow QA_CLEANUP_JOB env"
  value       = one(google_cloud_run_v2_job.browser_qa_cleanup[*].name)
}
