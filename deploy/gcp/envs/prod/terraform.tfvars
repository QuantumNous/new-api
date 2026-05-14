project_id        = "vocai-gemini-prod"
region            = "us-west1"
zone              = "us-west1-a"
service_name      = "newapi"
github_repository = "SolveaCX/new-api"

// Domain mappings (free, simple) require run.domainmappings.create — the caller lacks it.
// We use a GCP HTTPS LB instead. Once an org admin grants roles/run.admin, you can switch
// back to domain mappings by populating custom_domains and disabling enable_load_balancer.
custom_domains = []

// HTTPS LB front door — replaces domain mappings.
// Old `new-api.*.flatkey.ai` kept during the migration window so existing
// clients keep working while we cut over to the shorter `one.flatkey.ai` /
// `router.flatkey.ai` pair. Remove the old entries once monitoring shows
// no traffic on them.
enable_load_balancer = true
lb_domains = [
  "new-api.app.flatkey.ai",
  "new-api.api.flatkey.ai",
  "one.flatkey.ai",
  "router.flatkey.ai",
]

// Keep Cloud Run open during initial bring-up so health probes against *.run.app still work.
// After LB is healthy and CI/CD probes via the LB hostname, lock this down to
// INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER.
cloud_run_ingress = "INGRESS_TRAFFIC_ALL"

frontend_base_url = "https://new-api.app.flatkey.ai"

// Set this to receive uptime failure alerts. Leave empty to skip the alert policy.
alert_email = ""
