variable "REGISTRY" {
  default = "ghcr.io/wenertech/new-api"
}

group "default" {
  targets = ["develop"]
}

# ── develop: push prebuilt binary to registry ─────────────────────────────────

target "develop" {
  context    = "."
  dockerfile = "Dockerfile.prebuilt"
  platforms  = ["linux/amd64"]
  tags       = ["${REGISTRY}:develop"]
}

# ── local: load into local docker daemon (no push) ───────────────────────────

target "local" {
  inherits = ["develop"]
  output   = ["type=docker"]
}
