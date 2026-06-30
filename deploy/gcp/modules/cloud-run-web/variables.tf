variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Region"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name for the website"
  default     = "newapi-web"
}

variable "image_uri" {
  type        = string
  description = "Initial container image (replaced by CI/CD on every deploy)"
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "runtime_sa_email" {
  type        = string
  description = "Service account email attached to the website Cloud Run revision"
}

variable "ingress" {
  type        = string
  description = "Ingress setting. Keep ALL during bring-up so health probes against *.run.app work; lock to INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER once the LB is stable."
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "container_port" {
  type        = number
  description = "Container port the Next standalone server listens on (website/Dockerfile)"
  default     = 4000
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "min_instances" {
  type        = number
  description = "Keep >=1 so crawlers never hit a cold start (SEO)."
  default     = 1
}

variable "max_instances" {
  type    = number
  default = 4
}

variable "concurrency" {
  type    = number
  default = 80
}

variable "request_timeout_seconds" {
  type    = number
  default = 60
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "allow_unauthenticated" {
  type    = bool
  default = true
}

variable "app_console_origin" {
  type        = string
  description = "Origin of the Go console/app (used by sign-in/dashboard links and public website data fetches). e.g. https://console.flatkey.ai"
}

variable "router_origin" {
  type        = string
  description = "Origin of the router/API service used by public model invocation examples. e.g. https://router.flatkey.ai"
  default     = "https://router.flatkey.ai"
}

variable "site_origin" {
  type        = string
  description = "Public origin of the marketing site itself. e.g. https://flatkey.ai"
  default     = "https://flatkey.ai"
}
