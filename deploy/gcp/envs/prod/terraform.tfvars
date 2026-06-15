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

// Usage reconciliation token (BLOCKRUN_USAGE_SUMMARY_TOKEN) is wired into Cloud Run.
// The secret value (newapi-blockrun-usage-summary-token) was added and the env was
// injected on the live service on 2026-06-08, so the desired state must keep it on —
// otherwise a future `terraform apply` would strip the env. Keep this true.
enable_usage_recon_token = true

// --- Standalone Next.js website (apex flatkey.ai + www → Node; everything else → Go) ---
// website_domains are served through Cloudflare orange-cloud (depth ≤ 2, covered by
// Universal SSL), so they are intentionally NOT in lb_domains: no managed-cert rotation,
// no HTTPS downtime window. The Go console moves to console.flatkey.ai (also orange,
// reached via the LB default backend — no lb_domains change needed for it either).
enable_website             = true
website_service_name       = "newapi-web"
website_app_console_origin = "https://console.flatkey.ai"
website_site_origin        = "https://flatkey.ai"
// Phase A (this value): apex/www stay on the Go app; only the website service +
// backend are created. Verify the site via its *.run.app URL and CI deploy first.
// Phase B (flip): change to ["flatkey.ai", "www.flatkey.ai"] and apply — the LB
// host_rule appears and apex+www move to Node. Reverting to [] instantly rolls back.
website_domains = []
