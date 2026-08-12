variable "project_id" {
  type = string

  validation {
    condition     = var.project_id == "vocai-gemini-prod"
    error_message = "project_id must be exactly vocai-gemini-prod."
  }
}

variable "region" {
  type = string

  validation {
    condition     = var.region == "us-west1"
    error_message = "region must be exactly us-west1."
  }
}

variable "create_workloads" {
  description = "Create the Secret-dependent Browser QA Cloud Run service, jobs, and their resource IAM"
  type        = bool
  default     = true
}
