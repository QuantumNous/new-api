variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Region"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name"
  default     = "newapi"
}

variable "image_uri" {
  type        = string
  description = "Initial container image (will be replaced by CI/CD on every deploy)"
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "1Gi"
}

variable "min_instances" {
  type    = number
  default = 2
}

variable "max_instances" {
  type    = number
  default = 10
}

variable "concurrency" {
  type    = number
  default = 80
}

variable "request_timeout_seconds" {
  type    = number
  default = 3600
}

variable "runtime_sa_email" {
  type        = string
  description = "Service account email attached to the Cloud Run revision"
}

variable "network_id" {
  type        = string
  description = "VPC network for Direct VPC Egress"
}

variable "subnet_id" {
  type        = string
  description = "Subnetwork for Direct VPC Egress"
}

variable "cloudsql_connection_name" {
  type        = string
  description = "PROJECT:REGION:INSTANCE for the Cloud SQL Auth Proxy mount"
}

variable "db_user" {
  type = string
}

variable "db_name" {
  type = string
}

variable "sql_dsn_secret_id" {
  type        = string
  description = "Secret Manager secret ID holding the full SQL_DSN string"
}

variable "redis_url_secret_id" {
  type        = string
  description = "Secret Manager secret ID holding REDIS_CONN_STRING"
}

variable "session_secret_id" {
  type        = string
  description = "Secret Manager secret ID for SESSION_SECRET"
}

variable "crypto_secret_id" {
  type        = string
  description = "Secret Manager secret ID for CRYPTO_SECRET"
}

variable "frontend_base_url" {
  type        = string
  description = "Primary frontend URL used for OAuth callbacks and emails"
}

variable "custom_domains" {
  type        = list(string)
  description = "FQDNs to map to this Cloud Run service via Domain Mappings"
  default     = []
}

variable "allow_unauthenticated" {
  type        = bool
  description = "Allow public invocations (true since Cloudflare sits in front)"
  default     = true
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "ingress" {
  type        = string
  description = "Cloud Run ingress: INGRESS_TRAFFIC_ALL or INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  default     = "INGRESS_TRAFFIC_ALL"

  validation {
    condition     = contains(["INGRESS_TRAFFIC_ALL", "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER", "INGRESS_TRAFFIC_INTERNAL_ONLY"], var.ingress)
    error_message = "ingress must be one of: INGRESS_TRAFFIC_ALL, INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER, INGRESS_TRAFFIC_INTERNAL_ONLY."
  }
}
