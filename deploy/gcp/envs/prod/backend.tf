// State is stored in a GCS bucket created by bootstrap.sh.
// The bucket has Object Versioning enabled so any state change is recoverable.
terraform {
  backend "gcs" {
    bucket = "vocai-gemini-prod-newapi-tfstate"
    prefix = "envs/prod"
  }
}
