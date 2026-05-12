variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Region"
}

variable "repository_id" {
  type        = string
  description = "Artifact Registry repo id"
  default     = "newapi"
}
