locals {
  flatkey_asset_bucket_name         = "vocai-gemini-prod-flatkey-assets"
  flatkey_asset_staging_bucket_name = "vocai-gemini-prod-flatkey-assets-staging"
}

resource "google_storage_bucket" "flatkey_assets" {
  project  = var.project_id
  name     = local.flatkey_asset_bucket_name
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age        = 30
      with_state = "ARCHIVED"
    }
  }

  labels = {
    app         = "newapi"
    environment = "prod"
    data_class  = "flatkey-assets"
  }

  depends_on = [module.apis]
}

resource "google_storage_bucket" "flatkey_assets_staging" {
  count = var.enable_staging ? 1 : 0

  project  = var.project_id
  name     = local.flatkey_asset_staging_bucket_name
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age        = 30
      with_state = "ARCHIVED"
    }
  }

  labels = {
    app         = "newapi"
    environment = "staging"
    data_class  = "flatkey-assets"
  }

  depends_on = [module.apis]
}

resource "google_storage_bucket_iam_member" "runtime_flatkey_assets_object_user" {
  bucket = google_storage_bucket.flatkey_assets.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${module.service_accounts.runtime_email}"
}

resource "google_service_account_iam_member" "runtime_flatkey_assets_url_signer" {
  service_account_id = module.service_accounts.runtime_name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${module.service_accounts.runtime_email}"
}

resource "google_storage_bucket_iam_member" "staging_runtime_flatkey_assets_object_user" {
  count = var.enable_staging ? 1 : 0

  bucket = google_storage_bucket.flatkey_assets_staging[0].name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.staging_runtime[0].email}"
}

resource "google_service_account_iam_member" "staging_runtime_flatkey_assets_url_signer" {
  count = var.enable_staging ? 1 : 0

  service_account_id = google_service_account.staging_runtime[0].name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.staging_runtime[0].email}"
}
