variable "project_id" {
  type = string
}

variable "region" {
  type        = string
  description = "GCP region for regional monitored resources."
}

variable "uptime_host" {
  type        = string
  description = "FQDN to probe for the uptime check (typically the API domain)"
}

variable "alert_email" {
  type        = string
  description = "Legacy single email to notify. Prefer alert_emails for multiple recipients."
  default     = ""
}

variable "alert_emails" {
  type        = list(string)
  description = "Email addresses to notify. Leave empty to skip unless alert_email is set."
  default     = []
}

variable "router_service_name" {
  type        = string
  description = "Cloud Run service name that handles model/router traffic."
  default     = "newapi-router"
}

variable "router_max_instances" {
  type        = number
  description = "Configured router max instances; used to derive saturation alert threshold."
  default     = 10
}

variable "router_instance_saturation_ratio" {
  type        = number
  description = "Alert when router instance count reaches this fraction of max instances."
  default     = 0.9
}

variable "router_pending_requests_threshold" {
  type        = number
  description = "Alert when Cloud Run pending queue exceeds this value for the router."
  default     = 5
}

variable "router_5xx_per_5m_threshold" {
  type        = number
  description = "Alert when router 5xx responses exceed this count over 5 minutes."
  default     = 100
}

variable "redis_instance_id" {
  type        = string
  description = "Full Memorystore instance id label, for example projects/<project>/locations/<region>/instances/newapi-redis."
}

variable "redis_cpu_threshold" {
  type        = number
  description = "Redis CPU utilization alert threshold, expressed as 0.0-1.0."
  default     = 0.8
}
