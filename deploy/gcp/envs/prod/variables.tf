variable "project_id" {
  type    = string
  default = "vocai-gemini-prod"
}

variable "region" {
  type    = string
  default = "us-west1"
}

variable "zone" {
  type    = string
  default = "us-west1-a"
}

variable "service_name" {
  type    = string
  default = "newapi"
}

variable "enable_legacy_runtime" {
  type        = bool
  description = "Keep the legacy monolithic newapi Cloud Run service/resources alive. Flip to false only when ready to destroy legacy newapi."
  default     = true
}

variable "github_repository" {
  type        = string
  description = "OWNER/REPO that is allowed to deploy via WIF"
  default     = "SolveaCX/new-api"
}

variable "custom_domains" {
  type = list(string)
  default = [
    "new-api.app.flatkey.ai",
    "new-api.api.flatkey.ai",
  ]
}

variable "frontend_base_url" {
  type        = string
  description = "Primary user-facing URL (used by new-api for OAuth callbacks / mails)"
  default     = "https://console.flatkey.ai"
}

variable "alert_email" {
  type        = string
  description = "Email to receive uptime alerts. Empty disables the alert policy."
  default     = ""
}

variable "enable_load_balancer" {
  type        = bool
  description = "Create a GCP HTTPS LB in front of Cloud Run (use this when domain mappings aren't available)."
  default     = false
}

variable "lb_domains" {
  type        = list(string)
  description = "Domains for the managed SSL cert on the LB. DNS in Cloudflare must point to the LB IP first."
  default     = []
}

variable "lb_default_backend" {
  type        = string
  description = "Default LB backend for hosts that do not match an explicit host_rule."
  default     = "primary"

  validation {
    condition     = contains(["primary", "console", "router"], var.lb_default_backend)
    error_message = "lb_default_backend must be one of: primary, console, router."
  }
}

variable "cloud_run_ingress" {
  type        = string
  description = "Cloud Run ingress setting. Lock down to INTERNAL_LOAD_BALANCER once the LB is healthy."
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "enable_usage_recon_token" {
  type        = bool
  description = "Inject BLOCKRUN_USAGE_SUMMARY_TOKEN into Cloud Run from Secret Manager. Flip to true ONLY after the secret value has been added (`gcloud secrets versions add newapi-blockrun-usage-summary-token ...`); otherwise the revision fails to start because the secret has no version."
  default     = false
}

// --- Go app runtime split (router.flatkey.ai / console.flatkey.ai) ---

variable "enable_runtime_split" {
  type        = bool
  description = "Create separate Cloud Run services for router and console traffic. Defaults false so existing newapi remains the only runtime until explicitly enabled."
  default     = false
}

variable "router_service_name" {
  type        = string
  description = "Cloud Run service name for model invocation traffic."
  default     = "newapi-router"
}

variable "console_service_name" {
  type        = string
  description = "Cloud Run service name for console/API traffic."
  default     = "newapi-console"
}

variable "router_domains" {
  type        = list(string)
  description = "Hosts the LB routes to the router backend. Keep [] during service bring-up; add [\"router.flatkey.ai\"] only when cutting router traffic over."
  default     = []
}

variable "console_domains" {
  type        = list(string)
  description = "Hosts the LB routes to the console backend. Keep [] during service bring-up; add [\"console.flatkey.ai\"] only after Cloudflare/LB TLS behavior is confirmed."
  default     = []
}

variable "console_domains_require_managed_cert" {
  type        = bool
  description = "Require console_domains to be covered by the GCP managed cert. Set false only for Cloudflare-proxied console domains after origin routing has been verified."
  default     = true
}

variable "router_min_instances" {
  type        = number
  description = "Minimum Cloud Run instances for the router service."
  default     = 4
}

variable "router_max_instances" {
  type        = number
  description = "Maximum Cloud Run instances for the router service."
  default     = 10
}

variable "router_concurrency" {
  type        = number
  description = "Cloud Run request concurrency for the router service."
  default     = 50
}

variable "console_min_instances" {
  type        = number
  description = "Minimum Cloud Run instances for the console service."
  default     = 1
}

variable "console_max_instances" {
  type        = number
  description = "Maximum Cloud Run instances for the console service."
  default     = 5
}

variable "console_concurrency" {
  type        = number
  description = "Cloud Run request concurrency for the console service."
  default     = 80
}

// --- Standalone Next.js website (website/) ---

variable "enable_website" {
  type        = bool
  description = "Create the separate Next.js website Cloud Run service + minimal SA and enable the LB host-based split. Safe to leave false; nothing website-related is created until true."
  default     = false
}

variable "website_service_name" {
  type        = string
  description = "Cloud Run service name for the Next.js website."
  default     = "newapi-web"
}

variable "website_domains" {
  type        = list(string)
  description = "Hosts the LB routes to the website backend (host-based split). Served via Cloudflare orange-cloud, so they do NOT need to be in lb_domains / the managed cert (no cert rotation, no downtime)."
  default     = []
}

variable "website_app_console_origin" {
  type        = string
  description = "Origin of the Go console/app the website links to and proxies (sign-in, /dashboard, /api/perf-metrics). e.g. https://console.flatkey.ai"
  default     = "https://console.flatkey.ai"
}

variable "website_router_origin" {
  type        = string
  description = "Origin of the router/API service used in public model invocation examples. e.g. https://router.flatkey.ai"
  default     = "https://router.flatkey.ai"
}

variable "website_site_origin" {
  type        = string
  description = "Public origin of the marketing site itself."
  default     = "https://flatkey.ai"
}
