terraform {
  backend "gcs" {
    bucket = "vocai-gemini-prod-newapi-tfstate"
    prefix = "envs/browser-qa-staging"
  }
}
