variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "apis" {
  type        = list(string)
  description = "APIs to enable in the project"
}
