variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "placeholder_secrets" {
  type        = list(string)
  description = "Secret IDs to create as empty placeholders (operator fills the value)"
  default     = []
}
