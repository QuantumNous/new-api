variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Region"
}

variable "zone" {
  type        = string
  description = "Zone (location_id) for the single-zone Basic instance"
}

variable "instance_name" {
  type        = string
  description = "Redis instance name"
  default     = "newapi-redis"
}

variable "memory_size_gb" {
  type        = number
  description = "Memory size in GB"
  default     = 1
}

variable "network_id" {
  type        = string
  description = "VPC network ID (self_link) used by Cloud Run Direct VPC Egress"
}
