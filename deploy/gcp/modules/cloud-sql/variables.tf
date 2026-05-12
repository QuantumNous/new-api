variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Region (must match Cloud Run region for free intra-region traffic)"
}

variable "zone" {
  type        = string
  description = "Zone for the single-zone instance"
}

variable "instance_name" {
  type        = string
  description = "Cloud SQL instance name"
  default     = "newapi-mysql"
}

variable "tier" {
  type        = string
  description = "Machine tier"
  default     = "db-custom-2-4096"
}

variable "disk_size_gb" {
  type        = number
  description = "Initial disk size in GB (auto-resizes upwards)"
  default     = 100
}

variable "database_name" {
  type        = string
  description = "Application database name"
  default     = "newapi"
}

variable "app_user" {
  type        = string
  description = "Application DB user"
  default     = "newapi_app"
}

variable "app_password" {
  type        = string
  description = "Application DB password (from secrets module)"
  sensitive   = true
}

variable "deletion_protection" {
  type        = bool
  description = "Prevent accidental terraform destroy of the DB"
  default     = true
}
