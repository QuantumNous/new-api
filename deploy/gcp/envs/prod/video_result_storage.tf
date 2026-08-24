locals {
  video_result_bucket_name         = "vocai-gemini-prod-video-results"
  video_result_staging_bucket_name = "vocai-gemini-prod-video-results-staging"
}

resource "google_storage_bucket" "video_results" {
  project  = var.project_id
  name     = local.video_result_bucket_name
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = false
  }

  soft_delete_policy {
    retention_duration_seconds = 0
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age = 1
    }
  }

  labels = {
    app         = "newapi"
    environment = "prod"
    data_class  = "generated-video-results"
  }

  depends_on = [module.apis]
}

resource "google_storage_bucket" "video_results_staging" {
  count = var.enable_staging ? 1 : 0

  project  = var.project_id
  name     = local.video_result_staging_bucket_name
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = false
  }

  soft_delete_policy {
    retention_duration_seconds = 0
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age = 1
    }
  }

  labels = {
    app         = "newapi"
    environment = "staging"
    data_class  = "generated-video-results"
  }

  depends_on = [module.apis]
}

resource "google_storage_bucket_iam_member" "runtime_video_results_object_user" {
  bucket = google_storage_bucket.video_results.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${module.service_accounts.runtime_email}"
}

resource "google_storage_bucket_iam_member" "staging_runtime_video_results_object_user" {
  count = var.enable_staging ? 1 : 0

  bucket = google_storage_bucket.video_results_staging[0].name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.staging_runtime[0].email}"
}
