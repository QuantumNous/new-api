terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.13"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
