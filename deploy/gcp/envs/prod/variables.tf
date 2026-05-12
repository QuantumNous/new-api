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
  default     = "https://new-api.app.flatkey.ai"
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

variable "cloud_run_ingress" {
  type        = string
  description = "Cloud Run ingress setting. Lock down to INTERNAL_LOAD_BALANCER once the LB is healthy."
  default     = "INGRESS_TRAFFIC_ALL"
}
