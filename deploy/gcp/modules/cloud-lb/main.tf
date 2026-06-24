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

// --- Website (Next.js) backend — only created when a website service is supplied ---
// Host-based split: requests whose Host is in var.website_domains go to this
// backend; everything else falls through to the Go backend above. When
// website_cloud_run_service_name == "" none of this is created and the url map
// stays single-backend (original behavior, fully backward compatible).

resource "google_compute_region_network_endpoint_group" "website" {
  count = var.website_cloud_run_service_name != "" ? 1 : 0

  project               = var.project_id
  name                  = "${var.name_prefix}-web-cr-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.website_cloud_run_service_name
  }
}

resource "google_compute_backend_service" "website" {
  count = var.website_cloud_run_service_name != "" ? 1 : 0

  project               = var.project_id
  name                  = "${var.name_prefix}-web-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  backend {
    group = google_compute_region_network_endpoint_group.website[0].id
  }

  enable_cdn = false
}

// --- Router Go backend — optional runtime split target for model invocation traffic ---

resource "google_compute_region_network_endpoint_group" "router" {
  count = var.router_cloud_run_service_name != "" ? 1 : 0

  project               = var.project_id
  name                  = "${var.name_prefix}-router-cr-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.router_cloud_run_service_name
  }
}

resource "google_compute_backend_service" "router" {
  count = var.router_cloud_run_service_name != "" ? 1 : 0

  project               = var.project_id
  name                  = "${var.name_prefix}-router-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  backend {
    group = google_compute_region_network_endpoint_group.router[0].id
  }

  enable_cdn = false
}

// --- Console Go backend — optional runtime split target for console/API traffic ---

resource "google_compute_region_network_endpoint_group" "console" {
  count = var.console_cloud_run_service_name != "" ? 1 : 0

  project               = var.project_id
  name                  = "${var.name_prefix}-console-cr-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = var.console_cloud_run_service_name
  }
}

resource "google_compute_backend_service" "console" {
  count = var.console_cloud_run_service_name != "" ? 1 : 0

  project               = var.project_id
  name                  = "${var.name_prefix}-console-backend"
  protocol              = "HTTPS"
  port_name             = "http"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  backend {
    group = google_compute_region_network_endpoint_group.console[0].id
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

// URL map — default_service is the Go backend (any host / direct IP / Cloudflare
// proxied all land here = original behavior). When a website backend exists, a
// host_rule peels off var.website_domains (e.g. flatkey.ai, www.flatkey.ai) to
// the Next.js backend. No path rules: the marketing hosts go 100% to Node.
resource "google_compute_url_map" "https" {
  project         = var.project_id
  name            = "${var.name_prefix}-urlmap"
  default_service = google_compute_backend_service.main.id

  // Gated on website_domains being non-empty (not just the service existing) so
  // the rollout can be two-phase: apply once with website_domains=[] to create the
  // service/backend (apex stays on Go), verify via the *.run.app URL, then add the
  // domains to flip apex+www to Node. Removing the domains instantly reverts.
  dynamic "host_rule" {
    for_each = var.website_cloud_run_service_name != "" && length(var.website_domains) > 0 ? [1] : []
    content {
      hosts        = var.website_domains
      path_matcher = "website"
    }
  }

  dynamic "path_matcher" {
    for_each = var.website_cloud_run_service_name != "" && length(var.website_domains) > 0 ? [1] : []
    content {
      name            = "website"
      default_service = google_compute_backend_service.website[0].id
    }
  }

  dynamic "host_rule" {
    for_each = var.router_cloud_run_service_name != "" && length(var.router_domains) > 0 ? [1] : []
    content {
      hosts        = var.router_domains
      path_matcher = "router"
    }
  }

  dynamic "path_matcher" {
    for_each = var.router_cloud_run_service_name != "" && length(var.router_domains) > 0 ? [1] : []
    content {
      name            = "router"
      default_service = google_compute_backend_service.router[0].id
    }
  }

  dynamic "host_rule" {
    for_each = var.console_cloud_run_service_name != "" && length(var.console_domains) > 0 ? [1] : []
    content {
      hosts        = var.console_domains
      path_matcher = "console"
    }
  }

  dynamic "path_matcher" {
    for_each = var.console_cloud_run_service_name != "" && length(var.console_domains) > 0 ? [1] : []
    content {
      name            = "console"
      default_service = google_compute_backend_service.console[0].id
    }
  }

  lifecycle {
    precondition {
      condition = length(distinct(concat(
        var.website_domains,
        var.router_domains,
        var.console_domains,
      ))) == length(concat(
        var.website_domains,
        var.router_domains,
        var.console_domains,
      ))
      error_message = "website_domains, router_domains, and console_domains must not overlap."
    }

    precondition {
      condition     = length(var.website_domains) == 0 || var.website_cloud_run_service_name != ""
      error_message = "website_domains must not be set unless website_cloud_run_service_name is also set."
    }

    precondition {
      condition     = length(var.router_domains) == 0 || var.router_cloud_run_service_name != ""
      error_message = "router_domains must not be set unless router_cloud_run_service_name is also set."
    }

    precondition {
      condition     = length(var.console_domains) == 0 || var.console_cloud_run_service_name != ""
      error_message = "console_domains must not be set unless console_cloud_run_service_name is also set."
    }

    precondition {
      condition     = length(setsubtract(toset(var.router_domains), toset(var.domains))) == 0
      error_message = "router_domains must also be included in domains so the GCP HTTPS certificate covers them."
    }

    precondition {
      condition     = !var.console_domains_require_managed_cert || length(setsubtract(toset(var.console_domains), toset(var.domains))) == 0
      error_message = "console_domains must also be included in domains so the GCP HTTPS certificate covers them, unless console_domains_require_managed_cert is false for explicitly verified Cloudflare-proxied domains."
    }
  }
}

resource "google_compute_target_https_proxy" "https" {
  project          = var.project_id
  name             = "${var.name_prefix}-https-proxy"
  url_map          = google_compute_url_map.https.id
  ssl_certificates = [google_compute_managed_ssl_certificate.main.id]

  // Advertise HTTP/3 (QUIC over UDP/443). Clients that don't negotiate QUIC fall
  // back to HTTP/2 over TCP automatically, so this is a zero-risk, in-place update
  // (GCP setQuicOverride — does not recreate the proxy or touch the cert).
  // Motivation: cross-border (mainland China) clients pay a ~500ms TCP+TLS 2-RTT
  // handshake on the ~185ms-RTT path to the LB; QUIC collapses it to 1-RTT (0-RTT
  // on resumption) and tolerates jitter on the China Telecom 163 egress better.
  quic_override = "ENABLE"
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
