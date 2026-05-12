// Custom VPC for Cloud Run Direct VPC Egress.
// Cloud Run reaches Memorystore (private-IP only) through this VPC.
// Cloud SQL connects via Cloud SQL Auth Proxy Unix socket (no VPC needed).

resource "google_compute_network" "main" {
  name                    = "${var.name_prefix}-vpc"
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "main" {
  name          = "${var.name_prefix}-subnet-${var.region}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.main.id
  ip_cidr_range = var.subnet_cidr
  // Direct VPC Egress for Cloud Run allocates from this range.
  private_ip_google_access = true
}

// Cloud SQL is reached via Cloud SQL Auth Proxy (Unix socket) — no PSA peering needed.
// Memorystore Basic uses authorized_network field, also no PSA needed.
