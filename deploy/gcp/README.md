# GCP deployment

Terraform configuration that provisions a production environment for `new-api` on Google Cloud:

- **Cloud Run** (single service, min=2, max=10) in `us-west1`
- **Cloud SQL for MySQL 8.0** (`db-custom-2-4096`, single zone, backups + PITR)
- **Memorystore for Redis** Basic 1 GB
- **Artifact Registry** Docker repo
- **Secret Manager** for DB password, session/crypto secrets, and operator-managed OAuth/Stripe placeholders
- **Workload Identity Federation** so GitHub Actions can deploy without static keys
- **Uptime check + alert policy** (optional, set `alert_email` in tfvars)

Cloud Run reaches Cloud SQL through the **Auth Proxy Unix socket** (no VPC connector needed) and Redis through **Direct VPC Egress** (private-ranges-only on a custom subnet).

## Layout

```
deploy/gcp/
├── bootstrap.sh                     # one-time: creates the GCS state bucket
├── envs/prod/                       # root composition for production
│   ├── backend.tf                   # state in gs://vocai-gemini-prod-newapi-tfstate
│   ├── main.tf                      # wires the modules together
│   ├── outputs.tf
│   ├── terraform.tfvars             # the actual values for this env
│   ├── variables.tf
│   └── versions.tf
└── modules/
    ├── apis/                        # serviceusage enables
    ├── artifact-registry/
    ├── cloud-run/
    ├── cloud-sql/
    ├── github-wif/                  # OIDC pool + provider + SA binding
    ├── memorystore/
    ├── monitoring/
    ├── network/                     # custom VPC + regional subnet
    ├── secrets/                     # random passwords + Secret Manager
    └── service-accounts/            # runtime SA, deployer SA
```

## First-time deploy

```bash
# 0. Authenticate (already done if `gcloud config list` shows you)
gcloud auth login
gcloud auth application-default login
gcloud config set project vocai-gemini-prod

# 1. Bootstrap state bucket (one-time, idempotent)
deploy/gcp/bootstrap.sh

# 2. Plan
cd deploy/gcp/envs/prod
terraform init
terraform plan -out=tfplan

# 3. Apply after reviewing the plan
terraform apply tfplan
```

The first apply takes ~12 minutes (Cloud SQL is the slowest, ~8 min).

## Post-apply checklist

```bash
# Save these outputs — used by CI/CD setup below.
terraform output -raw github_wif_provider
terraform output -raw github_deployer_sa_email
terraform output -raw artifact_registry_url
terraform output domain_mappings
```

### Wire up GitHub Actions

1. In the `SolveaCX/new-api` repo Settings → **Environments** → New environment → name `production`.
2. Tick **Required reviewers** and add yourself.
3. Settings → **Secrets and variables** → Actions → **Variables** tab → New repository variable:
   - `GCP_WIF_PROVIDER` = output of `terraform output -raw github_wif_provider`
   - `GCP_DEPLOYER_SA`  = output of `terraform output -raw github_deployer_sa_email`
   - `GCP_PROJECT_ID`   = `vocai-gemini-prod`
   - `GCP_REGION`       = `us-west1`
   - `GCP_AR_REPO_URL`  = output of `terraform output -raw artifact_registry_url`
   - `GCP_RUN_SERVICE`  = `newapi`
   - `GCP_RUN_HEALTH_URL` = output of `terraform output -raw cloud_run_uri` (Cloud Run *.run.app URL)

### Wire up Cloudflare DNS

For each entry in `terraform output domain_mappings`, create a CNAME in the `flatkey.ai` Cloudflare zone:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `new-api.app` | `ghs.googlehosted.com` | DNS only first (until cert provisioned), then can flip to proxied |
| CNAME | `new-api.api` | `ghs.googlehosted.com` | DNS only first, then proxied |

Cloud Run will auto-provision a Google-managed TLS cert for each mapped domain. Cert provisioning takes 10–60 minutes; the mapping resource shows `Ready` once done.

### Fill in placeholder secrets (only if/when needed)

```bash
echo -n "<value>" | gcloud secrets versions add newapi-github-client-id     --data-file=-
echo -n "<value>" | gcloud secrets versions add newapi-github-client-secret --data-file=-
echo -n "<value>" | gcloud secrets versions add newapi-stripe-secret-key    --data-file=-
```

Then `gcloud run services update newapi --update-secrets=...` to inject them. (Or add the env entry to `modules/cloud-run/main.tf` and re-apply.)

## Day-2 operations

- **Deploy a new image**: push to `main` → GitHub Actions builds → manual approval gate → 10% canary → 100%.
- **Rollback**: trigger `gcp-rollback` workflow with the revision name. Cloud Run keeps all past revisions indefinitely.
- **Scale up DB**: change `tier` in `modules/cloud-sql/variables.tf` or pass an override, then `terraform apply` (~2 min restart).
- **Add HA to DB**: change `availability_type = "REGIONAL"` in `modules/cloud-sql/main.tf`, then apply (no downtime).
- **Inspect state**: `terraform state list` / `terraform state show <addr>`. Never edit state by hand.

## Cost estimate (us-west1, steady state)

| Component | Monthly |
|---|---|
| Cloud Run (min=2) | $50–80 |
| Cloud SQL MySQL `db-custom-2-4096` + 100GB SSD | ~$99 |
| Memorystore Redis Basic 1GB | ~$35 |
| Artifact Registry + logs + monitoring | ~$10 |
| **Total** | **~$195–225** |
