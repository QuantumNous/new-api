variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Region (must match Cloud Run region for the Serverless NEG)"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for all LB resource names"
  default     = "newapi"
}

variable "cloud_run_service_name" {
  type        = string
  description = "Name of the Cloud Run service the LB sends traffic to"
}

variable "domains" {
  type        = list(string)
  description = "FQDNs covered by the Google-managed cert. DNS must point to the LB IP before the cert can provision."
}

variable "cert_rotation" {
  type        = number
  description = "Increment to force the managed SSL cert to be recreated (e.g., after a FAILED_NOT_VISIBLE stuck state)."
  default     = 1
}
