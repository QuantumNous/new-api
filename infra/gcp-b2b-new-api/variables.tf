variable "project_id" {
  description = "GCP project ID that owns the per-customer deployment."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Cloud SQL, Redis, and Artifact Registry."
  type        = string
  default     = "us-east1"
}

variable "name_prefix" {
  description = "Lowercase customer prefix used to name all resources. Example: acme."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,19}[a-z0-9]$", var.name_prefix))
    error_message = "name_prefix must be 3-21 lowercase letters/numbers/hyphens, start with a letter, and end with a letter or number."
  }
}

variable "image" {
  description = "Container image to deploy to Cloud Run."
  type        = string
}

variable "enable_project_services" {
  description = "Enable required GCP APIs from Terraform. Disable if org policy manages APIs elsewhere."
  type        = bool
  default     = true
}

variable "create_network" {
  description = "Create a dedicated VPC/subnet for this customer. Set false to reuse an existing VPC."
  type        = bool
  default     = true
}

variable "network_name" {
  description = "Existing VPC name when create_network is false."
  type        = string
  default     = null
}

variable "subnet_name" {
  description = "Existing subnet name in region when create_network is false."
  type        = string
  default     = null
}

variable "subnet_cidr" {
  description = "CIDR for the generated Cloud Run subnet."
  type        = string
  default     = "10.80.0.0/24"
}

variable "create_private_service_connection" {
  description = "Create Private Service Access for Cloud SQL and Redis. Disable only when the chosen VPC already has PSA configured."
  type        = bool
  default     = true
}

variable "private_service_range_prefix_length" {
  description = "Prefix length for the PSA reserved internal range."
  type        = number
  default     = 20
}

variable "database_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "new_api"
}

variable "database_user" {
  description = "PostgreSQL application user name."
  type        = string
  default     = "newapi_app"
}

variable "postgres_version" {
  description = "Cloud SQL PostgreSQL version."
  type        = string
  default     = "POSTGRES_15"
}

variable "sql_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-custom-1-3840"
}

variable "sql_disk_size_gb" {
  description = "Initial Cloud SQL disk size."
  type        = number
  default     = 20
}

variable "sql_availability_type" {
  description = "Cloud SQL availability type: ZONAL or REGIONAL."
  type        = string
  default     = "ZONAL"
}

variable "sql_deletion_protection" {
  description = "Protect the Cloud SQL instance from accidental Terraform destroy."
  type        = bool
  default     = true
}

variable "redis_tier" {
  description = "Memorystore tier: BASIC or STANDARD_HA."
  type        = string
  default     = "BASIC"
}

variable "redis_memory_size_gb" {
  description = "Memorystore Redis memory size."
  type        = number
  default     = 1
}

variable "redis_version" {
  description = "Memorystore Redis version. Leave null to let GCP choose the latest supported version."
  type        = string
  default     = null
}

variable "redis_auth_enabled" {
  description = "Enable Redis AUTH and store the connection string in Secret Manager."
  type        = bool
  default     = true
}

variable "timezone" {
  description = "Application timezone."
  type        = string
  default     = "Asia/Shanghai"
}

variable "web_min_instances" {
  description = "Minimum Cloud Run web instances."
  type        = number
  default     = 1
}

variable "web_max_instances" {
  description = "Maximum Cloud Run web instances."
  type        = number
  default     = 5
}

variable "web_concurrency" {
  description = "Cloud Run web request concurrency."
  type        = number
  default     = 40
}

variable "master_concurrency" {
  description = "Cloud Run master request concurrency."
  type        = number
  default     = 80
}

variable "request_timeout_seconds" {
  description = "Cloud Run request timeout."
  type        = number
  default     = 3600
}

variable "cloud_run_cpu" {
  description = "Cloud Run container CPU limit."
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Cloud Run container memory limit."
  type        = string
  default     = "2Gi"
}

variable "trusted_redirect_domains" {
  description = "Optional comma-separated trusted redirect domains for OAuth/payment callbacks."
  type        = string
  default     = ""
}

variable "extra_env" {
  description = "Extra plaintext environment variables for both Cloud Run services."
  type        = map(string)
  default     = {}
}
