variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Region for the subnetwork"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for VPC and subnet names"
  default     = "newapi"
}

variable "subnet_cidr" {
  type        = string
  description = "CIDR for the regional subnet (Cloud Run Direct VPC Egress reads from this)"
  default     = "10.20.0.0/24"
}
