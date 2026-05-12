variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository in OWNER/REPO form"
}

variable "deployer_sa_name" {
  type        = string
  description = "Full resource name of the deployer service account (projects/.../serviceAccounts/...)"
}
