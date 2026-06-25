variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Region (must match Cloud Run region for the Serverless NEG)"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for all LB resource names"
  default     = "newapi"
}

variable "cloud_run_service_name" {
  type        = string
  description = "Name of the Cloud Run service the LB sends traffic to"
}

variable "domains" {
  type        = list(string)
  description = "FQDNs covered by the Google-managed cert. DNS must point to the LB IP before the cert can provision."
}

variable "cert_rotation" {
  type        = number
  description = "Increment to force the managed SSL cert to be recreated (e.g., after a FAILED_NOT_VISIBLE stuck state)."
  default     = 1
}

variable "website_cloud_run_service_name" {
  type        = string
  description = "Name of the Next.js website Cloud Run service. When empty, no website backend/host_rule is created and the LB stays single-backend (original behavior)."
  default     = ""
}

variable "website_domains" {
  type        = list(string)
  description = "Hosts routed to the website backend (host-based split), e.g. [\"flatkey.ai\", \"www.flatkey.ai\"]. Served via Cloudflare orange-cloud, so they need NOT be added to var.domains / the managed cert."
  default     = []
}

variable "router_cloud_run_service_name" {
  type        = string
  description = "Name of the router Cloud Run service. When empty, no router backend/host_rule is created."
  default     = ""
}

variable "router_domains" {
  type        = list(string)
  description = "Hosts routed to the router backend, e.g. [\"router.flatkey.ai\"]."
  default     = []
}

variable "console_cloud_run_service_name" {
  type        = string
  description = "Name of the console Cloud Run service. When empty, no console backend/host_rule is created."
  default     = ""
}

variable "console_domains" {
  type        = list(string)
  description = "Hosts routed to the console backend, e.g. [\"console.flatkey.ai\"]."
  default     = []
}

variable "console_domains_require_managed_cert" {
  type        = bool
  description = "Require console_domains to be covered by the GCP managed cert. Keep true unless every console domain is Cloudflare proxied and origin TLS behavior has been explicitly verified."
  default     = true
}
