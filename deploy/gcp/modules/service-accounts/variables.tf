variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "runtime_secret_ids" {
  type        = list(string)
  description = "Secret Manager secret IDs the runtime SA must read"
  default     = []
}
