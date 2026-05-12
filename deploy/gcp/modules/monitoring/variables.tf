variable "project_id" {
  type = string
}

variable "uptime_host" {
  type        = string
  description = "FQDN to probe for the uptime check (typically the API domain)"
}

variable "alert_email" {
  type        = string
  description = "Email to notify when uptime fails. Leave empty to skip."
  default     = ""
}
