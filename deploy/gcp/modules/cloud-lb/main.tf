// External HTTPS Load Balancer fronting the Cloud Run service.
// Used in place of Cloud Run Domain Mappings when the caller lacks
// run.domainmappings.create permission.
//
// Cloudflare points an A record at the static IP. SSL is terminated at the LB
// using a Google-managed certificate covering all configured domains.

resource "google_compute_global_address" "main" {
  project    = var.project_id
  name       = "${var.name_prefix}-lb-ip"
  ip_version = "IPV4"
}

resource "google_compute_region_network_endpoint_group" "cloud_run" {
  project               = var.project_id
  name                  = "${var.name_prefix}-cr-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.cloud_run_service_name
  }
}

resource "google_compute_backend_service" "main" {
  project               = var.project_id
  name                  = "${var.name_prefix}-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  // No health checks for serverless NEG (managed by GCP)

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  backend {
    group = google_compute_region_network_endpoint_group.cloud_run.id
  }

  enable_cdn = false
}

// Random suffix tied to domain list + a manual rotation counter.
// Bumping `cert_rotation` (a variable, default 1) forces a fresh provisioning
// attempt — useful when Google probed before DNS was in place and got stuck on
// FAILED_NOT_VISIBLE. With create_before_destroy, the new cert is attached
// before the old one is removed, so there is no HTTPS downtime.
resource "random_id" "cert_suffix" {
  byte_length = 3

  keepers = {
    domains  = join(",", var.domains)
    rotation = tostring(var.cert_rotation)
  }
}

resource "google_compute_managed_ssl_certificate" "main" {
  project = var.project_id
  name    = "${var.name_prefix}-cert-${random_id.cert_suffix.hex}"

  managed {
    domains = var.domains
  }

  lifecycle {
    create_before_destroy = true
  }
}

// URL map — single backend, accept any host so direct IP access also works
// (Cloudflare proxied or DNS-only both forward Host header unchanged).
resource "google_compute_url_map" "https" {
  project         = var.project_id
  name            = "${var.name_prefix}-urlmap"
  default_service = google_compute_backend_service.main.id
}

resource "google_compute_target_https_proxy" "https" {
  project          = var.project_id
  name             = "${var.name_prefix}-https-proxy"
  url_map          = google_compute_url_map.https.id
  ssl_certificates = [google_compute_managed_ssl_certificate.main.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  project               = var.project_id
  name                  = "${var.name_prefix}-https-fwd"
  ip_address            = google_compute_global_address.main.address
  port_range            = "443"
  target                = google_compute_target_https_proxy.https.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

// HTTP -> HTTPS redirect on port 80.
resource "google_compute_url_map" "http_redirect" {
  project = var.project_id
  name    = "${var.name_prefix}-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http" {
  project = var.project_id
  name    = "${var.name_prefix}-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  project               = var.project_id
  name                  = "${var.name_prefix}-http-fwd"
  ip_address            = google_compute_global_address.main.address
  port_range            = "80"
  target                = google_compute_target_http_proxy.http.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
