// Generates strong random values once and stores them in Secret Manager.
// Subsequent terraform applies will NOT re-generate (random_password is stable in state).

resource "random_password" "db_app_password" {
  length      = 32
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

resource "random_password" "session_secret" {
  length      = 48
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

resource "random_password" "crypto_secret" {
  length      = 48
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

resource "random_password" "initial_root_token" {
  length      = 48
  special     = false
  min_lower   = 4
  min_upper   = 4
  min_numeric = 4
}

locals {
  managed_secrets = {
    "newapi-db-app-password" = random_password.db_app_password.result
    "newapi-session-secret"  = random_password.session_secret.result
    "newapi-crypto-secret"   = random_password.crypto_secret.result
    "newapi-initial-token"   = random_password.initial_root_token.result
  }
}

resource "google_secret_manager_secret" "managed" {
  for_each = local.managed_secrets

  project   = var.project_id
  secret_id = each.key

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "managed" {
  for_each = local.managed_secrets

  secret      = google_secret_manager_secret.managed[each.key].id
  secret_data = each.value
}

// Placeholders for secrets the operator fills in manually after first apply
// (OAuth client ids, Stripe keys, etc.). We just create the empty secret resources here.
resource "google_secret_manager_secret" "placeholders" {
  for_each = toset(var.placeholder_secrets)

  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }
}
