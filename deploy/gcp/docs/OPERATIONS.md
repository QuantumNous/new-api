# GCP Operations Guide

Read this **before** touching anything under `deploy/gcp/`. Captures the parts of operating the GCP infrastructure that aren't obvious from the Terraform code, especially landmines that have already bitten this project.

This is the AI-facing operations playbook. Architecture inventory is in `INFRASTRUCTURE.md`; deploy/rollback procedures are in `DEPLOYMENT.md`.

---

## Project / environment

- **GCP project**: `vocai-gemini-prod` (project number `528088078482`)
- **Region**: `us-west1` (Oregon)
- **Production Terraform root**: `deploy/gcp/envs/prod/`
- **Production Terraform state**: GCS backend, bucket `vocai-gemini-prod-newapi-tfstate`, prefix `envs/prod` (versioning enabled)
- **Browser QA staging Terraform root**: `deploy/gcp/envs/browser-qa-staging/`
- **Browser QA staging Terraform state**: GCS backend, bucket `vocai-gemini-prod-newapi-tfstate`, prefix `envs/browser-qa-staging` (independent from production)
- **Shared infrastructure ownership**: the production root still owns shared project APIs and application/production/staging infrastructure; the Browser QA staging root owns only the isolated Browser QA resources.
- **Sole approver / human-in-loop**: `slZhong` (manual deploy gate in GitHub Actions)

---

## Auth

Two separate token systems — they expire independently and you need both:

| Purpose | Command | Used by |
|---|---|---|
| Application Default Credentials (ADC) | `gcloud auth application-default login` | Terraform, REST API via `Authorization: Bearer $(gcloud auth application-default print-access-token)` |
| User CLI session | `gcloud auth login` | `gcloud compute ...`, `gcloud run ...`, `gcloud sql ...` |

`gcloud auth application-default print-access-token` succeeding is **not** enough to prove `gcloud compute X` will work — those use the user-CLI token. If you see "Reauthentication failed. cannot prompt during non-interactive execution", the user-CLI token expired; ask the user to run `gcloud auth login`.

**Network gotcha**: the user's local network sometimes can't reach specific `*.googleapis.com` endpoints (notably `cloudresourcemanager.googleapis.com`) — symptoms are `EOF` on `terraform plan/apply` or `Recv failure: Connection reset by peer` on curl. Test with:

```bash
curl -sS --connect-timeout 5 -o /dev/null -w "%{http_code}\n" \
  https://cloudresourcemanager.googleapis.com/v1/projects
```

`000` (timeout / RST) → network blocked, ask user to switch network/VPN before retrying. `401` → network works (auth header missing is fine for the probe).

---

## Resource ownership: who writes what

This is the single most important thing to know before running `terraform apply`. Several Cloud Run fields are written by **CI/CD at deploy time**, not Terraform. Terraform must `ignore_changes` on them or every plan will fight CI/CD and try to revert.

**Ignored on `google_cloud_run_v2_service`** (see `modules/cloud-run/main.tf`):

| Field | Owner | Why |
|---|---|---|
| `template[0].containers[0].image` | CI/CD | New image per deploy |
| `template[0].revision` | CI/CD | Pinned revision name per deploy |
| `client`, `client_version` | gcloud | Set by `gcloud run` writes |
| `scaling` (top-level block) | gcloud | Populated with zero values by `gcloud run services update` — harmless drift |
| `traffic` | CI/CD | Canary blue/green with revision-pinned tags; the LATEST block in TF is only for first bring-up |
| `template[0].containers[0].env` | gcp-deploy.yml + gcloud | PADDLE_*, GA_*, BATCH_UPDATER_RESET etc. exist only on the live service; the TF env blocks are bring-up defaults. Added to ignore_changes 2026-06-12 after a plain plan tried to strip the live payment config |
| `template[0].vpc_access` | gcloud | egress flipped to `ALL_TRAFFIC` out-of-band (fixed-IP egress); TF code still says `PRIVATE_RANGES_ONLY` |

If a plan ever shows a diff on these fields, **do not apply**. Either the ignore list got broken, or CI/CD's state was lost — investigate, don't bulldoze.

**Env vars are out-of-band owned (in `ignore_changes` since 2026-06-12).** The env blocks in the TF module only seed a brand-new service; the live service's env is written by `gcp-deploy.yml` (PADDLE_*) and ad-hoc `gcloud run services update` (GA_*, secret refs, ...). Terraform neither strips nor updates env anymore. To change env on the live service (CI/CD's pinned revision names cause HTTP 409 on TF-driven updates anyway):

```bash
# Update env vars directly (gcloud auto-creates a new revision name)
gcloud run services update newapi \
  --region=us-west1 \
  --update-env-vars=KEY1=value1,KEY2=value2

# Then sync TF state without making changes
terraform apply -refresh-only
```

`ASSET_STORAGE_BUCKET` follows this same ownership rule. Terraform seeds it for
first creation, but production revisions get
`vocai-gemini-prod-flatkey-assets` from `.github/workflows/gcp-deploy.yml` and
staging revisions get `vocai-gemini-prod-flatkey-assets-staging` from
`.github/workflows/gcp-deploy-staging.yml`.

The asset buckets are private source stores, not public distribution buckets:
uniform bucket-level access is on, public access prevention is enforced, and
runtime service accounts receive only bucket-scoped object permissions plus
self signing permission for short-lived signed URLs. Never add public IAM,
project-wide Storage Admin, or signed URLs to logs, GitHub summaries, task
payloads, Terraform variables, or Terraform state.

GCS lifecycle is intentionally not the 30-day last-used retention mechanism. The
database cleanup worker owns that contract. Bucket lifecycle may clean archived
object versions, and soft delete/versioning protects against accidental deletes,
but active source objects must not be deleted by object creation age.

---

## Usage reconciliation token (`BLOCKRUN_USAGE_SUMMARY_TOKEN`) — already set up, keep it on

The BlockRun usage reconciliation endpoints — `GET /usage/summary` and `GET /usage/transactions` (code: `controller/usage_reconciliation.go`, `router/usage_reconciliation.go`, auth in `middleware/usage_recon_auth.go`; design spec `docs/superpowers/specs/2026-06-08-blockrun-usage-reconciliation-design.md`) — authenticate with a single static Bearer token read from env `BLOCKRUN_USAGE_SUMMARY_TOKEN`. Same value goes to the external reconciliation consumer.

**State (as of 2026-06-08):**

- Secret Manager secret `newapi-blockrun-usage-summary-token` exists (Terraform-owned: `google_secret_manager_secret.blockrun_usage_summary_token` in `envs/prod/main.tf`), value set (version 1), runtime SA `newapi-runtime@vocai-gemini-prod.iam.gserviceaccount.com` granted `roles/secretmanager.secretAccessor`.
- The env was **pre-injected on the live service via gcloud** (`gcloud run services update newapi --update-secrets=BLOCKRUN_USAGE_SUMMARY_TOKEN=newapi-blockrun-usage-summary-token:latest --no-traffic`), creating revision `newapi-00051-v4v` at **0% traffic** (serving revision and the `canary` tag were left untouched). So `spec.template` already carries the secret env, and every later CI image deploy inherits it — `gcp-deploy.yml` uses `--update-env-vars` (a delta) + `--image`, which preserves existing env/secrets rather than replacing them.
- `enable_usage_recon_token = true` in `envs/prod/terraform.tfvars` gates the `dynamic "env"` block in `modules/cloud-run/main.tf`.

**Don't break it:**

- **Keep `enable_usage_recon_token = true`.** It keeps desired-state honest and seeds fresh bring-ups. (Env is in `ignore_changes` since 2026-06-12, so `terraform apply` no longer strips live env either way — but don't rely on that to paper over a wrong flag.)
- The env was set out-of-band via gcloud, so TF state can lag reality. The committed flag keeps desired-state aligned, so a refreshing `terraform plan` shows no env diff; run `terraform apply -refresh-only` to sync state exactly.
- When writing the secret value, use `printf '%s'`, not `echo` (no trailing newline in the token).

**Rotate the token** (single shared secret — the reconciliation consumer must change in lockstep):

```bash
printf '%s' '<new-token>' | gcloud secrets versions add newapi-blockrun-usage-summary-token \
  --project=vocai-gemini-prod --data-file=-
gcloud run services update newapi --region=us-west1 --project=vocai-gemini-prod \
  --update-secrets=BLOCKRUN_USAGE_SUMMARY_TOKEN=newapi-blockrun-usage-summary-token:latest
# then shift traffic to the new revision — see the revision-pinned traffic section above
```

First-time setup runbook: `DEPLOYMENT.md` → "用量对账 token（`BLOCKRUN_USAGE_SUMMARY_TOKEN`）".

---

## `gcp-infra.yml` apply currently does not work (IAM gap)

**Symptom**: `workflow_dispatch` on `gcp-infra.yml` fails at the very first `terraform apply` step with errors like:

```
Error 403: Permission denied to list services for consumer container [projects/528088078482]
reason: AUTH_PERMISSION_DENIED on serviceusage.googleapis.com
  with module.apis.google_project_service.this["serviceusage.googleapis.com"]
```

**Cause**: the CI service account `newapi-ci-deployer@vocai-gemini-prod.iam.gserviceaccount.com` only has the three minimum roles needed for **app deploy** (`run.developer`, `artifactregistry.writer`, `iam.serviceAccountUser`). `terraform apply` does a full state refresh that reads every module's GCP state — needing read perms across serviceusage, IAM, secretmanager, compute, cloudsql, redis, monitoring, etc. Until those are granted, **infra apply via CI will never succeed**.

**Update 2026-07-09: pull-request plans intentionally use `terraform plan -refresh=false`.** This avoids the deployer SA's refresh-time `AUTH_PERMISSION_DENIED` on serviceusage and other prod resources, but it only checks the desired Terraform diff against the current state file. **Treat CI plan comments as non-authoritative for live drift** — always run a refreshing `terraform plan` locally with Owner ADC before applying.

**Workaround (works today, no Terraform drift)**: when the Terraform code on `main` is already merged with the desired state, just apply via `gcloud` using a user account with Owner / `roles/run.admin`. Terraform's `desired` and reality will reconverge — no drift, no refresh-only needed.

Worked example (2026-05-25 scaling tune, PR #22):

```bash
gcloud run services update newapi \
  --region=us-west1 \
  --project=vocai-gemini-prod \
  --min-instances=4 \
  --concurrency=50

# Then redirect traffic to the new revision — see next section.
```

**Long-term fix** (separate PR): grant the deployer SA the full set of read + write roles in `modules/service-accounts/main.tf`. Minimum starter list:

```
roles/serviceusage.serviceUsageAdmin
roles/iam.securityReviewer            # read IAM policies across resources
roles/secretmanager.viewer
roles/compute.viewer                  # network/LB
roles/cloudsql.viewer
roles/redis.viewer
roles/monitoring.viewer
roles/iam.workloadIdentityPoolViewer
roles/artifactregistry.reader
# plus admin roles per module for the write side: secretmanager.admin, cloudsql.admin, redis.admin, compute.networkAdmin, compute.loadBalancerAdmin, monitoring.admin
```

This is a meaningful blast radius (broad cross-resource admin) — review carefully and consider splitting into a separate `infra-deployer` SA instead of upgrading the existing `ci-deployer`.

---

## Cloud Run traffic is revision-pinned — gcloud-only scaling tweaks don't auto-receive traffic

When CI/CD deploys a new image, the workflow pins traffic to that specific revision name (the LATEST block in Terraform is only for first bring-up). After such a deploy, `spec.traffic[*].latestRevision == false` and traffic = 100% on the explicit revision name.

**Consequence**: if you then run `gcloud run services update newapi --min-instances=X --concurrency=Y` to tweak scaling, gcloud creates a **brand-new revision** (with auto-generated name like `newapi-00021-zxs`) carrying the new scaling. But **traffic stays on the previously-pinned revision**, which keeps the old scaling values. You'll see `spec.template.containerConcurrency = 50` in `services describe` (that's the next revision's template), but in reality 100% of traffic is still served by the old revision at conc=80.

To make the new scaling take effect immediately:

```bash
gcloud run services update-traffic newapi \
  --region=us-west1 \
  --project=vocai-gemini-prod \
  --to-revisions=newapi-00021-zxs=100
```

Verify with:

```bash
gcloud run services describe newapi --region=us-west1 --project=vocai-gemini-prod \
  --format='value(status.traffic)'
# Want: status.traffic[0].revisionName=newapi-00021-zxs, percent=100
```

After traffic flips, the next CI/CD app deploy still works normally — it creates yet another revision (with commit-hash suffix), inherits the *current* `spec.template` (so new scaling carries over), and re-pins traffic to itself.

To roll back to the prior revision quickly:

```bash
gcloud run services update-traffic newapi --region=us-west1 --project=vocai-gemini-prod \
  --to-revisions=<previous-revision-name>=100
```

The same rule applies to the split production services:

| Service | Role | Normal traffic owner |
|---|---|---|
| `newapi-console` | console/admin/API, `NODE_TYPE=master` | `console.flatkey.ai` |
| `newapi-router` | model relay/API, `NODE_TYPE=slave` | `router.flatkey.ai` |
| `newapi-web` | public website | `flatkey.ai`, `www.flatkey.ai` |
| `newapi-console` | fallback for unmatched hosts | URL map default backend |

When rolling back or shifting traffic, target the specific service that serves the failing host. The legacy `newapi` service is decommissioned (`enable_legacy_runtime=false`) and is not a deployment or rollback target. Restoring it requires a separately approved infrastructure recovery plan; do not treat it as an ordinary revision rollback.

---

## Production runtime split

Current production routing is host-based at the GCP LB:

| Host | Backend service | Cloud Run service | Runtime role |
|---|---|---|---|
| `flatkey.ai`, `www.flatkey.ai` | `newapi-web-backend` | `newapi-web` | Next.js website |
| `console.flatkey.ai` | `newapi-console-backend` | `newapi-console` | Go app, `NODE_TYPE=master`, `APP_ROLE=console` |
| `router.flatkey.ai` | `newapi-router-backend` | `newapi-router` | Go app, `NODE_TYPE=slave`, `APP_ROLE=router` |
| default | `newapi-console-backend` | `newapi-console` | fallback for unmatched hosts |

Verify the live URL map before and after any host-split change:

```bash
gcloud compute url-maps describe newapi-urlmap \
  --project=vocai-gemini-prod --global \
  --format='yaml(hostRules,pathMatchers,defaultService)'
```

Rollback levers:

- Bad console revision: `gcloud run services update-traffic newapi-console ... --to-revisions=<old>=100`
- Bad router revision: `gcloud run services update-traffic newapi-router ... --to-revisions=<old>=100`
- Bad website revision: `gcloud run services update-traffic newapi-web ... --to-revisions=<old>=100`
- Bad console host split: set `console_domains = []`, plan, review URL map diff, apply
- Bad router host split: set `router_domains = []`, plan, review URL map diff, apply
- Bad website host split: set `website_domains = []`, plan, review URL map diff, apply

Host-rule rollback sends new requests to the URL map default backend (`newapi-console-backend`). It does not stop in-flight requests on the previous Cloud Run revision, but it can change application behavior if the fallback service has different image/env. Check logs before choosing host-rule rollback over revision rollback.

---

## HTTPS LB cert rotation has a downtime window

The managed SSL cert is recreated whenever `lb_domains` changes (via `random_id.cert_suffix` keepers). With `create_before_destroy`, Terraform creates the new cert and points the HTTPS proxy at it **before** destroying the old one. That sounds safe but isn't:

- The new cert is in `PROVISIONING` immediately after creation
- The HTTPS proxy now references only the new cert (old one detached)
- Until Google verifies all listed domains' DNS and signs the cert (10–30 min), the LB has no usable cert
- **All HTTPS traffic to all domains in `lb_domains` fails during that window** (TLS handshake errors like `SSL_ERROR_SYSCALL`)

Always warn the user before applying a `lb_domains` change. Schedule it during low-traffic windows.

**Check cert status without gcloud CLI** (works with just ADC):

```bash
TOKEN=$(gcloud auth application-default print-access-token)
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://compute.googleapis.com/compute/v1/projects/vocai-gemini-prod/global/sslCertificates?filter=name+eq+.*newapi-cert.*" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(c['name'],'|',c['managed']['status'],'|',c['managed'].get('domainStatus',{})) for c in d.get('items',[])]"
```

`domainStatus` showing all `ACTIVE` but `status: PROVISIONING` means cert is about to flip — typically a few more minutes. Outright `FAILED_NOT_VISIBLE` means DNS isn't pointing at the LB IP yet — fix DNS, then bump the `cert_rotation` Terraform variable to force-recreate the cert.

---

## Cloudflare DNS mode

Current production uses a deliberate mixed Cloudflare mode:

| Host | Mode | Why |
|---|---|---|
| `flatkey.ai`, `www.flatkey.ai` | Proxied | Public website, covered by Cloudflare Universal SSL |
| `console.flatkey.ai` | Proxied | Console is intentionally kept out of GCP `lb_domains` to avoid managed-cert rotation |
| `router.flatkey.ai` | DNS only | Covered by GCP managed cert; avoids proxy behavior on long-lived model calls |
| `new-api.app.flatkey.ai`, `new-api.api.flatkey.ai` | DNS only | Depth-3 names are not covered by Cloudflare Universal SSL |
| `one.flatkey.ai` | DNS only | Compatibility entry; URL map default routes to `newapi-console` |

Cloudflare's "origin IP partially exposed" warning is expected because the same GCP LB IP has both Proxied and DNS-only records.

Do not flip DNS modes casually:

- Switching depth-3 names to Proxied fails unless Cloudflare Total TLS / ACM is enabled.
- Switching `console.flatkey.ai` to DNS-only would require adding it to GCP `lb_domains`, which triggers managed cert rotation and a possible HTTPS downtime window.
- Switching `router.flatkey.ai` to Proxied is technically possible at depth 2, but should be tested for streaming/model-call behavior first.

To use Proxied for depth-3 names would require Total TLS ($10/mo) — previously declined per cost.

---

## Flatkey staging browser QA first-run and recovery runbook

This runbook is for the isolated staging browser QA surface managed by `deploy/gcp/envs/browser-qa-staging` and `.github/workflows/gcp-browser-qa.yml`. It is separate from the production deploy path. Backend staging deploys call the same-commit reusable Browser QA workflow in `core` mode after the deploy job and health check pass; QA failures turn the Actions run red and leave the completed staging deployment unchanged.

Operator rules:

- Treat every command in this section as an example until the operator has reviewed the current branch, account, project, and target resource names.
- Do not run these commands from an agent session. The human operator runs them from an authenticated terminal.
- Keep `set -x` disabled. Do not paste secret values into argv, Terraform variables, Terraform state, GitHub output, GitHub summaries, committed files, or shell history.
- Use stdin for secret values. Use `printf`, `read -s`, and pipes; do not use `echo` for secrets.
- Keep temporary files under `mktemp -d`, remove them on exit, and never commit Terraform plans, JSON plan exports, OAuth material, or report downloads.
- Do not manually run `gcloud run jobs execute ... --update-env-vars=FLATKEY_QA_GMAIL_BASE=...`; the workflow owns runtime injection from the repository variable.

### Resource names to verify before touching anything

These names are the implementation contract as of this Terraform root:

| Purpose | Name |
|---|---|
| Terraform root | `deploy/gcp/envs/browser-qa-staging/` |
| Backend prefix | `envs/browser-qa-staging` |
| Project | `vocai-gemini-prod` |
| Region | `us-west1` |
| Artifact Registry repository | `flatkey-staging-browser-qa` |
| Broker Cloud Run service | `flatkey-staging-browser-qa-broker` |
| Main Cloud Run job | `flatkey-staging-browser-qa` |
| Cleanup Cloud Run job | `flatkey-staging-browser-qa-cleanup` |
| Codex API key secret | `flatkey-browser-qa-codex-api-key` |
| Identity seed secret | `flatkey-browser-qa-identity-seed` |
| Gmail OAuth secret | `flatkey-browser-qa-gmail-oauth` |
| Report bucket | `gs://vocai-gemini-prod-flatkey-browser-qa-reports` |
| Runtime service accounts | `flatkey-browser-qa-runtime@vocai-gemini-prod.iam.gserviceaccount.com`, `flatkey-browser-qa-broker@vocai-gemini-prod.iam.gserviceaccount.com`, `flatkey-browser-qa-cleanup@vocai-gemini-prod.iam.gserviceaccount.com`, `flatkey-browser-qa-deployer@vocai-gemini-prod.iam.gserviceaccount.com` |
| Workload Identity Federation pool/provider | `flatkey-browser-qa-github` / `staging` (global) |
| GitHub workflow | `.github/workflows/gcp-browser-qa.yml` |
| Workflow modes | `core`, `normal`, `cleanup-only` |
| Non-committed GitHub variable | `GCP_BROWSER_QA_AR_REPO_URL` |
| Non-committed GitHub variable | `GCP_BROWSER_QA_WIF_PROVIDER` |
| Non-committed GitHub variable | `GCP_BROWSER_QA_DEPLOYER_SA` |
| Non-committed GitHub variable | `GCP_BROWSER_QA_GCS_BUCKET` |
| Non-committed GitHub variable | `GCP_BROWSER_QA_GMAIL_BASE` |

### 1. Phase A: authenticated refreshing infrastructure plan review

Do not trust PR plan comments for this apply. They use `-refresh=false` and cannot prove live drift is absent. Use Owner-capable user CLI auth plus ADC locally, then save the exact Phase A infrastructure plan that will be applied. Phase A uses the independent Browser QA Terraform root and must create only the non-workload infrastructure: 26 creates, 0 updates, 0 deletes, 0 replaces, and 4 infrastructure output creates.

```bash
# Human-only review commands. Non-mutating until the final saved-plan apply.
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
qa_root="$repo_root/deploy/gcp/envs/browser-qa-staging"
project_id="vocai-gemini-prod"
region="us-west1"

gcloud auth login
gcloud auth application-default login

active_project="$(gcloud config get-value project 2>/dev/null)"
if [ "$active_project" != "$project_id" ]; then
  echo "ABORT: active GCP project must be vocai-gemini-prod; got ${active_project:-<unset>}" >&2
  exit 1
fi

active_region="$(gcloud config get-value run/region 2>/dev/null)"
if [ "$active_region" != "$region" ]; then
  echo "ABORT: active run region must be us-west1; got ${active_region:-<unset>}" >&2
  exit 1
fi

review_dir="$(mktemp -d)"
trap 'rm -rf "$review_dir"' EXIT
required_apis="$review_dir/required-apis.txt"
enabled_apis="$review_dir/enabled-apis.txt"
missing_apis="$review_dir/missing-apis.txt"
state_stdout="$review_dir/state-list.stdout"
state_stderr="$review_dir/state-list.stderr"
probe_stdout="$review_dir/probe.stdout"
probe_stderr="$review_dir/probe.stderr"

cat > "$required_apis" <<'EOF_APIS'
artifactregistry.googleapis.com
cloudresourcemanager.googleapis.com
iam.googleapis.com
iamcredentials.googleapis.com
logging.googleapis.com
run.googleapis.com
secretmanager.googleapis.com
serviceusage.googleapis.com
sts.googleapis.com
storage.googleapis.com
EOF_APIS

gcloud services list --enabled \
  --project="$project_id" \
  --format='value(config.name)' \
  | LC_ALL=C sort -u > "$enabled_apis"
LC_ALL=C sort -u "$required_apis" -o "$required_apis"
comm -23 "$required_apis" "$enabled_apis" > "$missing_apis"
if [ -s "$missing_apis" ]; then
  echo "ABORT: required APIs are not enabled:" >&2
  cat "$missing_apis" >&2
  exit 1
fi

cd "$qa_root"
terraform init -reconfigure

if terraform state list >"$state_stdout" 2>"$state_stderr"; then
  state_status=0
  state_addresses="$(cat "$state_stdout")"
else
  state_status="$?"
  state_addresses=""
fi
state_diagnostic="$(cat "$state_stderr" "$state_stdout")"
if [ "$state_status" -ne 0 ]; then
  case "$state_diagnostic" in
    *"No state file was found!"*)
      if [ -s "$state_stdout" ]; then
        echo "ABORT: unable to read independent Browser QA state" >&2
        printf '%s\n' "$state_diagnostic" >&2
        exit 1
      fi
      state_addresses=""
      ;;
    *)
      echo "ABORT: unable to read independent Browser QA state" >&2
      printf '%s\n' "$state_diagnostic" >&2
      exit 1
      ;;
  esac
fi
if [ -n "$state_addresses" ]; then
  echo "ABORT: independent Browser QA state is not empty" >&2
  printf '%s\n' "$state_addresses" >&2
  echo "Stop and design an import/migration before creating Browser QA resources. Do not use -target." >&2
  exit 1
fi

describe_absent() {
  label="$1"
  shift
  : > "$probe_stdout"
  : > "$probe_stderr"
  if "$@" >"$probe_stdout" 2>"$probe_stderr"; then
    echo "ABORT: ${label} already exists. Stop and design an import/migration before creating Browser QA resources." >&2
    cat "$probe_stdout" >&2
    exit 1
  fi
  diagnostic="$(cat "$probe_stderr" "$probe_stdout")"
  absence_verified=false
  case "$diagnostic" in
    *PERMISSION_DENIED*|*UNAUTHENTICATED*|*UNAVAILABLE*|*Cannot\ find\ project*) ;;
    *404*|*NOT_FOUND*|*does\ not\ exist*|*Cannot\ find\ service\ \[*|*Cannot\ find\ job\ \[*) absence_verified=true ;;
    *) ;;
  esac
  if [ "$absence_verified" != "true" ]; then
    echo "ABORT: unable to prove ${label} is absent" >&2
    printf '%s\n' "$diagnostic" >&2
    exit 1
  fi
}

describe_absent "Artifact Registry repository flatkey-staging-browser-qa" \
  gcloud artifacts repositories describe flatkey-staging-browser-qa \
    --project="$project_id" --location="$region"
describe_absent "Cloud Run broker service flatkey-staging-browser-qa-broker" \
  gcloud run services describe flatkey-staging-browser-qa-broker \
    --project="$project_id" --region="$region"
describe_absent "Cloud Run job flatkey-staging-browser-qa" \
  gcloud run jobs describe flatkey-staging-browser-qa \
    --project="$project_id" --region="$region"
describe_absent "Cloud Run job flatkey-staging-browser-qa-cleanup" \
  gcloud run jobs describe flatkey-staging-browser-qa-cleanup \
    --project="$project_id" --region="$region"
describe_absent "runtime service account flatkey-browser-qa-runtime@vocai-gemini-prod.iam.gserviceaccount.com" \
  gcloud iam service-accounts describe flatkey-browser-qa-runtime@vocai-gemini-prod.iam.gserviceaccount.com \
    --project="$project_id"
describe_absent "broker service account flatkey-browser-qa-broker@vocai-gemini-prod.iam.gserviceaccount.com" \
  gcloud iam service-accounts describe flatkey-browser-qa-broker@vocai-gemini-prod.iam.gserviceaccount.com \
    --project="$project_id"
describe_absent "cleanup service account flatkey-browser-qa-cleanup@vocai-gemini-prod.iam.gserviceaccount.com" \
  gcloud iam service-accounts describe flatkey-browser-qa-cleanup@vocai-gemini-prod.iam.gserviceaccount.com \
    --project="$project_id"
describe_absent "deployer service account flatkey-browser-qa-deployer@vocai-gemini-prod.iam.gserviceaccount.com" \
  gcloud iam service-accounts describe flatkey-browser-qa-deployer@vocai-gemini-prod.iam.gserviceaccount.com \
    --project="$project_id"
describe_absent "Secret container flatkey-browser-qa-codex-api-key" \
  gcloud secrets describe flatkey-browser-qa-codex-api-key \
    --project="$project_id"
describe_absent "Secret container flatkey-browser-qa-identity-seed" \
  gcloud secrets describe flatkey-browser-qa-identity-seed \
    --project="$project_id"
describe_absent "Secret container flatkey-browser-qa-gmail-oauth" \
  gcloud secrets describe flatkey-browser-qa-gmail-oauth \
    --project="$project_id"
describe_absent "GCS bucket gs://vocai-gemini-prod-flatkey-browser-qa-reports" \
  gcloud storage buckets describe gs://vocai-gemini-prod-flatkey-browser-qa-reports \
    --project="$project_id"
describe_absent "WIF pool flatkey-browser-qa-github" \
  gcloud iam workload-identity-pools describe flatkey-browser-qa-github \
    --project="$project_id" --location=global
describe_absent "WIF provider staging" \
  gcloud iam workload-identity-pools providers describe staging \
    --project="$project_id" --location=global --workload-identity-pool=flatkey-browser-qa-github

infra_plan_path="$review_dir/browser-qa-infra.tfplan"
infra_plan_json="$review_dir/browser-qa-infra.tfplan.json"

terraform plan -var='create_workloads=false' -out="$infra_plan_path"
terraform show -json "$infra_plan_path" > "$infra_plan_json"
terraform show -no-color "$infra_plan_path" > "$review_dir/browser-qa-infra.tfplan.txt"

python3 "$repo_root/scripts/browser_qa/terraform_plan_guard.py" --phase infra "$infra_plan_json"

printf '\nHuman-readable Phase A plan review:\n  %s\n' "$review_dir/browser-qa-infra.tfplan.txt"
printf 'If approved, apply before this shell exits so the exact saved plan still exists.\n'
IFS= read -r -p "Type APPLY_BROWSER_QA_INFRA_SAVED_PLAN to apply this exact saved plan: " APPLY_CONFIRM
if [ "$APPLY_CONFIRM" = "APPLY_BROWSER_QA_INFRA_SAVED_PLAN" ]; then
  terraform apply "$infra_plan_path"
else
  printf 'Skipped apply; temp plan will be removed by the EXIT trap.\n'
fi
```

Abort immediately if active project/region checks fail, any required API is missing, the independent Browser QA state is non-empty, any live resource already exists, or the phase-aware Terraform plan guard reports an out-of-contract Phase A diff. Any state/live hit means the operator must stop and design an import/migration before creating Browser QA resources. Do not automatically import, do not continue create, and do not use `-target`.

Apply only from the same review shell before the `EXIT` trap removes `infra_plan_path`. Never replace this with an unsaved `terraform apply`, `-refresh=false`, or `-target`.

### 1A. Recover the interrupted Phase A bucket IAM apply

Use this only for the known interrupted Phase A where the first 23 non-bucket-IAM infrastructure resources reached Terraform state and the three report-bucket IAM members are still missing. The old saved plan is permanently invalid after that partial apply and must not be rerun. Generate, guard, and apply a new recovery saved plan from the refreshed current state.

```bash
# Human-only recovery commands. Non-mutating until the final saved-plan apply.
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
qa_root="$repo_root/deploy/gcp/envs/browser-qa-staging"
expected_account="liu1124789567@gmail.com"
expected_project="vocai-gemini-prod"
region="us-west1"

active_account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -n 1)"
if [ "$active_account" != "$expected_account" ]; then
  echo "ABORT: active GCP account must be liu1124789567@gmail.com; got ${active_account:-<unset>}" >&2
  exit 1
fi

active_project="$(gcloud config get-value project 2>/dev/null)"
if [ "$active_project" != "$expected_project" ]; then
  echo "ABORT: active GCP project must be vocai-gemini-prod; got ${active_project:-<unset>}" >&2
  exit 1
fi

active_region="$(gcloud config get-value run/region 2>/dev/null)"
if [ "$active_region" != "$region" ]; then
  echo "ABORT: active run region must be us-west1; got ${active_region:-<unset>}" >&2
  exit 1
fi

review_dir="$(mktemp -d)"
trap 'rm -rf "$review_dir"' EXIT
expected_pre_recovery_state="$review_dir/expected-pre-recovery-state.txt"
actual_pre_recovery_state="$review_dir/actual-pre-recovery-state.txt"
expected_full_phase_a_state="$review_dir/expected-full-phase-a-state.txt"
actual_full_phase_a_state="$review_dir/actual-full-phase-a-state.txt"
recovery_plan_path="$review_dir/browser-qa-infra-recovery.tfplan"
recovery_plan_json="$review_dir/browser-qa-infra-recovery.tfplan.json"
recovery_plan_text="$review_dir/browser-qa-infra-recovery.tfplan.txt"

cd "$qa_root"
terraform init -reconfigure

cat > "$review_dir/expected-pre-recovery-state.txt" <<'EOF_PRE_RECOVERY_STATE'
google_artifact_registry_repository.browser_qa
google_artifact_registry_repository_iam_member.browser_qa_deployer_writer
google_iam_workload_identity_pool.browser_qa_github
google_iam_workload_identity_pool_provider.browser_qa_github
google_project_iam_member.browser_qa_broker_log_writer
google_project_iam_member.browser_qa_cleanup_log_writer
google_project_iam_member.browser_qa_runtime_log_writer
google_secret_manager_secret.browser_qa_codex_api_key
google_secret_manager_secret.browser_qa_gmail_oauth
google_secret_manager_secret.browser_qa_identity_seed
google_secret_manager_secret_iam_member.browser_qa_broker_gmail_oauth
google_secret_manager_secret_iam_member.browser_qa_cleanup_identity_seed
google_secret_manager_secret_iam_member.browser_qa_runtime_codex_api_key
google_secret_manager_secret_iam_member.browser_qa_runtime_identity_seed
google_service_account.browser_qa_broker
google_service_account.browser_qa_cleanup
google_service_account.browser_qa_deployer
google_service_account.browser_qa_runtime
google_service_account_iam_member.browser_qa_broker_user
google_service_account_iam_member.browser_qa_cleanup_user
google_service_account_iam_member.browser_qa_runtime_user
google_service_account_iam_member.browser_qa_wif_deployer
google_storage_bucket.browser_qa_reports
EOF_PRE_RECOVERY_STATE

terraform state list | LC_ALL=C sort > "$actual_pre_recovery_state"
if ! diff -u "$expected_pre_recovery_state" "$actual_pre_recovery_state"; then
  echo "ABORT: recovery must start from the exact 23-address pre-recovery Phase A state." >&2
  exit 1
fi

terraform plan -var='create_workloads=false' -out="$recovery_plan_path"
terraform show -json "$recovery_plan_path" > "$recovery_plan_json"
terraform show -no-color "$recovery_plan_path" > "$recovery_plan_text"

python3 "$repo_root/scripts/browser_qa/terraform_plan_guard.py" --phase infra-recovery "$recovery_plan_json"

if ! grep -Fx -- "Plan: 3 to add, 0 to change, 0 to destroy." "$recovery_plan_text" >/dev/null; then
  echo "ABORT: recovery plan text must prove exactly: Plan: 3 to add, 0 to change, 0 to destroy." >&2
  exit 1
fi

printf '\nHuman-readable Phase A recovery plan review:\n  %s\n' "$recovery_plan_text"
printf 'If approved, apply before this shell exits so the exact recovery saved plan still exists.\n'
IFS= read -r -p "Type APPLY_BROWSER_QA_INFRA_RECOVERY_SAVED_PLAN to apply this exact saved plan: " APPLY_CONFIRM
if [ "$APPLY_CONFIRM" = "APPLY_BROWSER_QA_INFRA_RECOVERY_SAVED_PLAN" ]; then
  if terraform apply "$recovery_plan_path"; then
    :
  else
    echo "ABORT: recovery saved plan apply exited non-zero; the plan is invalid." >&2
    exit 1
  fi
else
  printf 'Skipped apply; temp recovery plan will be removed by the EXIT trap.\n'
  exit 0
fi

cat > "$review_dir/expected-full-phase-a-state.txt" <<'EOF_FULL_PHASE_A_STATE'
google_artifact_registry_repository.browser_qa
google_artifact_registry_repository_iam_member.browser_qa_deployer_writer
google_iam_workload_identity_pool.browser_qa_github
google_iam_workload_identity_pool_provider.browser_qa_github
google_project_iam_member.browser_qa_broker_log_writer
google_project_iam_member.browser_qa_cleanup_log_writer
google_project_iam_member.browser_qa_runtime_log_writer
google_secret_manager_secret.browser_qa_codex_api_key
google_secret_manager_secret.browser_qa_gmail_oauth
google_secret_manager_secret.browser_qa_identity_seed
google_secret_manager_secret_iam_member.browser_qa_broker_gmail_oauth
google_secret_manager_secret_iam_member.browser_qa_cleanup_identity_seed
google_secret_manager_secret_iam_member.browser_qa_runtime_codex_api_key
google_secret_manager_secret_iam_member.browser_qa_runtime_identity_seed
google_service_account.browser_qa_broker
google_service_account.browser_qa_cleanup
google_service_account.browser_qa_deployer
google_service_account.browser_qa_runtime
google_service_account_iam_member.browser_qa_broker_user
google_service_account_iam_member.browser_qa_cleanup_user
google_service_account_iam_member.browser_qa_runtime_user
google_service_account_iam_member.browser_qa_wif_deployer
google_storage_bucket.browser_qa_reports
google_storage_bucket_iam_member.browser_qa_cleanup_report_admin
google_storage_bucket_iam_member.browser_qa_deployer_report_viewer
google_storage_bucket_iam_member.browser_qa_runtime_report_creator
EOF_FULL_PHASE_A_STATE

terraform state list | LC_ALL=C sort > "$actual_full_phase_a_state"
if ! diff -u "$expected_full_phase_a_state" "$actual_full_phase_a_state"; then
  echo "ABORT: recovery apply completed but Phase A state does not exactly match the 26 expected infrastructure addresses." >&2
  exit 1
fi
```

The project IAM administrator must remove the temporary project-level grant `user:liu1124789567@gmail.com -> roles/storage.admin` immediately after the 3 bucket IAM recovery is applied and the exact 26-address state/bindings are verified. Do not automate that removal in this recovery block; Storage Admin by itself does not guarantee `resourcemanager.projects.setIamPolicy`. Only after that IAM cleanup is complete may the operator continue with outputs, GitHub Variables, Secret versions, and Phase B.

### 2. Set output-backed GitHub repository variables

After the browser-QA Terraform apply succeeds, set the four non-secret repository variables that the GitHub workflow reads from `vars.*`. These values come directly from Terraform outputs and are not committed files, Terraform variables, or Secret Manager secrets:

| GitHub variable | Terraform output |
|---|---|
| `GCP_BROWSER_QA_AR_REPO_URL` | `browser_qa_artifact_registry_url` |
| `GCP_BROWSER_QA_WIF_PROVIDER` | `browser_qa_wif_provider` |
| `GCP_BROWSER_QA_DEPLOYER_SA` | `browser_qa_deployer_sa_email` |
| `GCP_BROWSER_QA_GCS_BUCKET` | `browser_qa_report_bucket` |

Use stdin for `gh variable set` so the values are not placed in argv. Do not use `--body`, do not print the values, and do not set or change `GCP_BROWSER_QA_GMAIL_BASE` in this step. The GitHub variable writes are sequential and non-atomic; if a partial `gh` failure occurs after some variables were written, fix the failure and rerun the whole block. The block is safe to rerun because it overwrites the same four repository variables from the current Terraform outputs.

```bash
# Mutating; operator review required. Sets non-secret repo variables from Terraform outputs.
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root/deploy/gcp/envs/browser-qa-staging"

GCP_BROWSER_QA_AR_REPO_URL="$(terraform output -raw browser_qa_artifact_registry_url)"
GCP_BROWSER_QA_WIF_PROVIDER="$(terraform output -raw browser_qa_wif_provider)"
GCP_BROWSER_QA_DEPLOYER_SA="$(terraform output -raw browser_qa_deployer_sa_email)"
GCP_BROWSER_QA_GCS_BUCKET="$(terraform output -raw browser_qa_report_bucket)"

test -n "${GCP_BROWSER_QA_AR_REPO_URL}"
test "${GCP_BROWSER_QA_AR_REPO_URL}" != "null"
test -n "${GCP_BROWSER_QA_WIF_PROVIDER}"
test "${GCP_BROWSER_QA_WIF_PROVIDER}" != "null"
test -n "${GCP_BROWSER_QA_DEPLOYER_SA}"
test "${GCP_BROWSER_QA_DEPLOYER_SA}" != "null"
test -n "${GCP_BROWSER_QA_GCS_BUCKET}"
test "${GCP_BROWSER_QA_GCS_BUCKET}" != "null"

printf '%s' "${GCP_BROWSER_QA_AR_REPO_URL}" | gh variable set GCP_BROWSER_QA_AR_REPO_URL --repo SolveaCX/new-api
printf '%s' "${GCP_BROWSER_QA_WIF_PROVIDER}" | gh variable set GCP_BROWSER_QA_WIF_PROVIDER --repo SolveaCX/new-api
printf '%s' "${GCP_BROWSER_QA_DEPLOYER_SA}" | gh variable set GCP_BROWSER_QA_DEPLOYER_SA --repo SolveaCX/new-api
printf '%s' "${GCP_BROWSER_QA_GCS_BUCKET}" | gh variable set GCP_BROWSER_QA_GCS_BUCKET --repo SolveaCX/new-api

unset GCP_BROWSER_QA_AR_REPO_URL
unset GCP_BROWSER_QA_WIF_PROVIDER
unset GCP_BROWSER_QA_DEPLOYER_SA
unset GCP_BROWSER_QA_GCS_BUCKET
```

Abort if any output is empty or `null`, or if the installed `gh variable set` cannot read from stdin. Do not fall back to passing values through command-line arguments.

### 3. Add Secret Manager versions without leaking values

Terraform creates only the Secret Manager containers. Secret versions are operator-owned.

Generate a random 32-byte identity seed as base64, validate that it decodes to exactly 32 bytes, and only then launch `gcloud` with the payload on stdin:

```bash
# Mutating; operator review required. No secret value appears in argv.
set -euo pipefail
set +x

python3 - <<'PY'
import base64
import os
import subprocess

payload = base64.b64encode(os.urandom(32))
decoded = base64.b64decode(payload, validate=True)
if len(decoded) != 32:
    raise SystemExit("identity seed must decode to exactly 32 bytes")

subprocess.run(
    [
        "gcloud",
        "secrets",
        "versions",
        "add",
        "flatkey-browser-qa-identity-seed",
        "--project=vocai-gemini-prod",
        "--data-file=-",
    ],
    input=payload,
    check=True,
)
PY
```

Add the dedicated Codex API key through non-echoing stdin:

```bash
# Mutating; operator review required. The key is read silently and never placed in argv.
set -euo pipefail
set +x

python3 - <<'PY'
import getpass
import subprocess

secret = getpass.getpass("Dedicated Codex API key: ")
if not secret or not secret.strip():
    raise SystemExit("Codex API key must be non-empty")
payload = secret.encode("utf-8")

subprocess.run(
    [
        "gcloud",
        "secrets",
        "versions",
        "add",
        "flatkey-browser-qa-codex-api-key",
        "--project=vocai-gemini-prod",
        "--data-file=-",
    ],
    input=payload,
    check=True,
)
PY
```

Transform the existing local post-consent Gmail OAuth credential JSON in memory and pass only the canonical broker payload to Secret Manager. Do not copy the source file, do not print the transformed JSON, and do not commit either file.

```bash
# Mutating; operator review required. Set GMAIL_OAUTH_SOURCE to the local credential file path.
set -euo pipefail
set +x

IFS= read -rsp "Local Gmail OAuth credential JSON path: " GMAIL_OAUTH_SOURCE
printf '\n'
export GMAIL_OAUTH_SOURCE

python3 - <<'PY'
import json
import os
import subprocess

GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"

source = os.environ["GMAIL_OAUTH_SOURCE"]
if not source.strip():
    raise SystemExit("GMAIL_OAUTH_SOURCE must be non-empty")
with open(source, encoding="utf-8") as handle:
    raw = json.load(handle)
if not isinstance(raw, dict):
    raise SystemExit("OAuth credential JSON must be an object")

client = raw.get("installed") or raw.get("web") or raw
if not isinstance(client, dict):
    raise SystemExit("OAuth client fields must be an object")

missing = []
if not isinstance(raw.get("refresh_token"), str) or not raw["refresh_token"].strip():
    missing.append("refresh_token")
for name in ("client_id", "client_secret"):
    if not isinstance(client.get(name), str) or not client[name].strip():
        missing.append(name)
if missing:
    raise SystemExit("OAuth credential JSON missing required post-consent field(s): " + ", ".join(sorted(missing)))

token_uri = client.get("token_uri") or raw.get("token_uri")
if token_uri != GOOGLE_TOKEN_URI:
    raise SystemExit("OAuth token_uri must be exactly https://oauth2.googleapis.com/token")

if "scopes" in raw:
    scopes = raw["scopes"]
elif "scope" in raw:
    scopes = raw["scope"]
else:
    raise SystemExit("OAuth credential JSON must explicitly contain scope or scopes")
if isinstance(scopes, str):
    scopes = scopes.split()
elif isinstance(scopes, list) and all(isinstance(item, str) for item in scopes):
    scopes = list(scopes)
else:
    raise SystemExit("OAuth scopes must be a string or list of strings")
if scopes != [GMAIL_READONLY]:
    raise SystemExit("OAuth scopes must be exactly the singleton gmail.readonly scope")

payload = {
    "refresh_token": raw["refresh_token"],
    "token_uri": token_uri,
    "client_id": client["client_id"],
    "client_secret": client["client_secret"],
    "scopes": scopes,
}
payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")

subprocess.run(
    [
        "gcloud",
        "secrets",
        "versions",
        "add",
        "flatkey-browser-qa-gmail-oauth",
        "--project=vocai-gemini-prod",
        "--data-file=-",
    ],
    input=payload_bytes,
    check=True,
)
PY

unset GMAIL_OAUTH_SOURCE
```

The originally downloaded Google OAuth client-secret JSON is insufficient by itself: it normally contains `installed` or `web` client metadata, but no `refresh_token` and no granted `scopes`. The source for the transform must be a post-consent credential JSON containing `refresh_token` plus explicit `scope` or `scopes`. If it does not, use the Google OAuth app's existing client to perform a one-time local authorization outside the repo with `access_type=offline`, `prompt=consent`, and exactly `https://www.googleapis.com/auth/gmail.readonly`; save the resulting credential JSON only in an operator-owned `0600` local path, then rerun the transform above. Do not use a broad Gmail scope, do not use a production mailbox other than the approved base mailbox, and do not copy the credential JSON into the repository.

Reviewer-only self-check for the rewritten snippets: each snippet constructs and validates `payload` or `payload_bytes` before `subprocess.run(...)`; every `raise SystemExit(...)` path occurs before the `gcloud` process is launched, so parse/validation failure cannot create an empty or malformed Secret Manager version. Static syntax validation can be done locally without invoking `gcloud` by extracting the Python heredocs from this file and running `ast.parse` on each snippet.

### 4. Phase B: verify Secret versions and create Cloud Run workloads

Phase B is allowed only after Phase A apply, output-backed GitHub variables, and all three Secret Manager versions are complete. It must create only indexed Cloud Run workload resources: 9 indexed workload creates, 0 updates, 0 deletes, 0 replaces, and 4 workload output creates. It must not read Secret payloads.

```bash
# Human-only review commands. Non-mutating until the final saved-plan apply.
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
qa_root="$repo_root/deploy/gcp/envs/browser-qa-staging"
expected_project="vocai-gemini-prod"
region="us-west1"

active_project="$(gcloud config get-value project 2>/dev/null)"
if [ "$active_project" != "$expected_project" ]; then
  echo "ABORT: active GCP project must be vocai-gemini-prod; got ${active_project:-<unset>}" >&2
  exit 1
fi

active_region="$(gcloud config get-value run/region 2>/dev/null)"
if [ "$active_region" != "$region" ]; then
  echo "ABORT: active run region must be us-west1; got ${active_region:-<unset>}" >&2
  exit 1
fi

review_dir="$(mktemp -d)"
trap 'rm -rf "$review_dir"' EXIT
expected_infra_state="$review_dir/expected-infra-state.txt"
actual_infra_state="$review_dir/actual-infra-state.txt"
probe_stdout="$review_dir/probe.stdout"
probe_stderr="$review_dir/probe.stderr"
workload_plan_path="$review_dir/browser-qa-workloads.tfplan"
workload_plan_json="$review_dir/browser-qa-workloads.tfplan.json"

cd "$qa_root"
terraform init -reconfigure

cat > "$expected_infra_state" <<'EOF_INFRA_STATE'
google_artifact_registry_repository.browser_qa
google_artifact_registry_repository_iam_member.browser_qa_deployer_writer
google_iam_workload_identity_pool.browser_qa_github
google_iam_workload_identity_pool_provider.browser_qa_github
google_project_iam_member.browser_qa_broker_log_writer
google_project_iam_member.browser_qa_cleanup_log_writer
google_project_iam_member.browser_qa_runtime_log_writer
google_secret_manager_secret.browser_qa_codex_api_key
google_secret_manager_secret.browser_qa_gmail_oauth
google_secret_manager_secret.browser_qa_identity_seed
google_secret_manager_secret_iam_member.browser_qa_broker_gmail_oauth
google_secret_manager_secret_iam_member.browser_qa_cleanup_identity_seed
google_secret_manager_secret_iam_member.browser_qa_runtime_codex_api_key
google_secret_manager_secret_iam_member.browser_qa_runtime_identity_seed
google_service_account.browser_qa_broker
google_service_account.browser_qa_cleanup
google_service_account.browser_qa_deployer
google_service_account.browser_qa_runtime
google_service_account_iam_member.browser_qa_broker_user
google_service_account_iam_member.browser_qa_cleanup_user
google_service_account_iam_member.browser_qa_runtime_user
google_service_account_iam_member.browser_qa_wif_deployer
google_storage_bucket.browser_qa_reports
google_storage_bucket_iam_member.browser_qa_cleanup_report_admin
google_storage_bucket_iam_member.browser_qa_deployer_report_viewer
google_storage_bucket_iam_member.browser_qa_runtime_report_creator
EOF_INFRA_STATE

terraform state list | LC_ALL=C sort > "$actual_infra_state"
if ! diff -u "$expected_infra_state" "$actual_infra_state"; then
  echo "ABORT: Phase A Terraform state does not exactly match the 26 expected infrastructure addresses." >&2
  exit 1
fi

for secret in \
  flatkey-browser-qa-codex-api-key \
  flatkey-browser-qa-gmail-oauth \
  flatkey-browser-qa-identity-seed
do
  state="$(gcloud secrets versions describe latest \
    --secret="$secret" \
    --project="$expected_project" \
    --format='value(state)')"
  if [ "$state" != "ENABLED" ]; then
    echo "ABORT: latest version for ${secret} must be ENABLED; got ${state:-<empty>}" >&2
    exit 1
  fi
done

describe_absent() {
  label="$1"
  shift
  : > "$probe_stdout"
  : > "$probe_stderr"
  if "$@" >"$probe_stdout" 2>"$probe_stderr"; then
    echo "ABORT: ${label} already exists. Stop and design an import/migration before creating Browser QA workloads." >&2
    cat "$probe_stdout" >&2
    exit 1
  fi
  diagnostic="$(cat "$probe_stderr" "$probe_stdout")"
  absence_verified=false
  case "$diagnostic" in
    *PERMISSION_DENIED*|*UNAUTHENTICATED*|*UNAVAILABLE*|*Cannot\ find\ project*) ;;
    *404*|*NOT_FOUND*|*does\ not\ exist*|*Cannot\ find\ service\ \[*|*Cannot\ find\ job\ \[*) absence_verified=true ;;
    *) ;;
  esac
  if [ "$absence_verified" != "true" ]; then
    echo "ABORT: unable to prove ${label} is absent" >&2
    printf '%s\n' "$diagnostic" >&2
    exit 1
  fi
}

describe_absent "Cloud Run broker service flatkey-staging-browser-qa-broker" \
  gcloud run services describe flatkey-staging-browser-qa-broker \
    --project="$expected_project" --region="$region"
describe_absent "Cloud Run job flatkey-staging-browser-qa" \
  gcloud run jobs describe flatkey-staging-browser-qa \
    --project="$expected_project" --region="$region"
describe_absent "Cloud Run job flatkey-staging-browser-qa-cleanup" \
  gcloud run jobs describe flatkey-staging-browser-qa-cleanup \
    --project="$expected_project" --region="$region"

terraform plan -var='create_workloads=true' -out="$workload_plan_path"
terraform show -json "$workload_plan_path" > "$workload_plan_json"
terraform show -no-color "$workload_plan_path" > "$review_dir/browser-qa-workloads.tfplan.txt"

python3 "$repo_root/scripts/browser_qa/terraform_plan_guard.py" --phase workloads "$workload_plan_json"

printf '\nHuman-readable Phase B plan review:\n  %s\n' "$review_dir/browser-qa-workloads.tfplan.txt"
printf 'If approved, apply before this shell exits so the exact saved plan still exists.\n'
IFS= read -r -p "Type APPLY_BROWSER_QA_WORKLOADS_SAVED_PLAN to apply this exact saved plan: " APPLY_CONFIRM
if [ "$APPLY_CONFIRM" = "APPLY_BROWSER_QA_WORKLOADS_SAVED_PLAN" ]; then
  terraform apply "$workload_plan_path"
else
  printf 'Skipped apply; temp plan will be removed by the EXIT trap.\n'
fi
```

Abort if the active project/region checks fail, the independent state is not exactly the 26 Phase A addresses, any latest Secret version is not `ENABLED`, any workload already exists, or the phase-aware Terraform plan guard reports an out-of-contract Phase B diff. Do not access Secret payloads, do not continue with partial state, and do not use `-target`.

### 5. Set the Gmail GitHub repository variable

`GCP_BROWSER_QA_GMAIL_BASE` is a repository variable, not a committed file and not a Terraform variable. It must be the base Gmail address only, with no plus tag, comma, CR, or LF. Use the GitHub repository UI if possible so the value does not enter CLI argv or shell history.

If policy requires CLI, do not put the value in the command line. Use a locked temporary file and remove it immediately after `gh` reads it:

```bash
# Mutating; operator review required. Prefer the GitHub UI if your gh version cannot read variables from stdin.
set -euo pipefail
set +x

tmp_var="$(mktemp)"
chmod 600 "$tmp_var"
trap 'rm -f "$tmp_var"' EXIT
IFS= read -rsp "Base Gmail address without plus tag: " GCP_BROWSER_QA_GMAIL_BASE
printf '\n'
printf '%s' "$GCP_BROWSER_QA_GMAIL_BASE" > "$tmp_var"
unset GCP_BROWSER_QA_GMAIL_BASE

gh variable set GCP_BROWSER_QA_GMAIL_BASE \
  --repo SolveaCX/new-api \
  < "$tmp_var"
```

Abort if the installed `gh variable set` cannot read from stdin; use the GitHub UI instead. Do not fall back to `--body "$GCP_BROWSER_QA_GMAIL_BASE"`.

### 6. OAuth publication, bootstrap, and repeatability rule

A token issued while the OAuth app Publishing status is `Testing` proves bootstrap only. External Testing refresh tokens can expire quickly, so one successful run with a Testing token is not repeatability evidence.

Repeatability is accepted only after all three steps are complete:

1. Publish the OAuth app as `In production`.
2. Reauthorize exactly `gmail.readonly`.
3. Rotate `flatkey-browser-qa-gmail-oauth` with the new refresh token and complete a second successful full `normal` run.

### 7. Verify broker IAM denial

The broker must deny unauthenticated calls and calls from an explicitly reviewed known-unauthorized identity that is not the active operator Owner identity, runtime SA, broker SA, or deployer SA. The cleanup SA below is only a candidate negative-control identity; use it only after reviewing effective org, project, and service IAM and confirming it has no broker invoker path. Use the Terraform output for the broker URI; do not hardcode the generated `run.app` URL.

```bash
# Read-only verification example.
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root/deploy/gcp/envs/browser-qa-staging"
BROKER_URI="$(terraform output -raw browser_qa_broker_uri)"
NEGATIVE_PROBE_SA="flatkey-browser-qa-cleanup@vocai-gemini-prod.iam.gserviceaccount.com"
ACTIVE_OWNER_IDENTITY="<active-owner-service-account-or-user>"

if [ "$NEGATIVE_PROBE_SA" = "$ACTIVE_OWNER_IDENTITY" ]; then
  echo "negative probe must not be the active Owner identity" >&2
  exit 1
fi

case "$NEGATIVE_PROBE_SA" in
  flatkey-browser-qa-runtime@vocai-gemini-prod.iam.gserviceaccount.com|\
  flatkey-browser-qa-broker@vocai-gemini-prod.iam.gserviceaccount.com|\
  flatkey-browser-qa-deployer@vocai-gemini-prod.iam.gserviceaccount.com)
    echo "negative probe must not be the active Owner, runtime, broker, or deployer identity" >&2
    exit 1
    ;;
esac

echo "Before using this negative-control SA, review effective org/project/service IAM and confirm it has no roles/run.invoker path to ${BROKER_URI}."
echo "The operator must have impersonation authority, such as roles/iam.serviceAccountTokenCreator, on ${NEGATIVE_PROBE_SA}."

service_invoker_binding="$(gcloud run services get-iam-policy flatkey-staging-browser-qa-broker \
  --project=vocai-gemini-prod \
  --region=us-west1 \
  --flatten='bindings[].members' \
  --filter="bindings.role=roles/run.invoker AND bindings.members=serviceAccount:${NEGATIVE_PROBE_SA}" \
  --format='value(bindings.role)')"
test -z "$service_invoker_binding"

project_invoker_binding="$(gcloud projects get-iam-policy vocai-gemini-prod \
  --flatten='bindings[].members' \
  --filter="bindings.role=roles/run.invoker AND bindings.members=serviceAccount:${NEGATIVE_PROBE_SA}" \
  --format='value(bindings.role)')"
test -z "$project_invoker_binding"

ORG_ID="<gcp-org-id>"
if [ "$ORG_ID" = "<gcp-org-id>" ]; then
  echo "Set ORG_ID and check organization IAM for roles/run.invoker before continuing." >&2
  exit 1
fi
org_invoker_binding="$(gcloud organizations get-iam-policy "$ORG_ID" \
  --flatten='bindings[].members' \
  --filter="bindings.role=roles/run.invoker AND bindings.members=serviceAccount:${NEGATIVE_PROBE_SA}" \
  --format='value(bindings.role)')"
test -z "$org_invoker_binding"

status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  --data '{"run_id":"0","email_tag":"qa-0-00000000","start_time":0}' \
  "${BROKER_URI}/v1/current-code")"
test "$status" = "401" -o "$status" = "403"

token_file="$(mktemp)"
header_file="$(mktemp)"
chmod 600 "$token_file" "$header_file"
trap 'rm -f "$token_file" "$header_file"' EXIT
gcloud auth print-identity-token \
  --audiences="$BROKER_URI" \
  --impersonate-service-account="$NEGATIVE_PROBE_SA" \
  > "$token_file"
{ printf 'Authorization: Bearer '; cat "$token_file"; printf '\n'; } > "$header_file"
status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -H @"$header_file" \
  --data '{"run_id":"0","email_tag":"qa-0-00000000","start_time":0}' \
  "${BROKER_URI}/v1/current-code")"
test "$status" = "401" -o "$status" = "403"
```

Abort if the negative-control identity is the operator Owner, runtime, broker, or deployer identity; if IAM review shows it has `roles/run.invoker` at org/project/service scope; or if the operator lacks impersonation authority for that service account. Abort if either request reaches application-level validation, returns `200`, or returns a broker JSON error such as `invalid_fields`. That means IAM is not enforcing the private broker boundary.

### 8. Dispatch core or normal and capture the exact run id

Run `core` first. It exercises the onboarding replay and stops before the five-minute exploration phase. Run `normal` only after `core` finishes and cleanup succeeds; `normal` performs core replay plus the bounded exploration phase, capped by the implementation at five minutes or thirty browser actions.

Use this helper for both modes. GitHub's [February 19, 2026 changelog](https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids/) and [workflow dispatch REST docs](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event) document that the endpoint accepts top-level `return_run_details: true`; with that field it returns `200` JSON containing `workflow_run_id`, `run_url`, and `html_url`, while omitting it keeps the legacy empty `204` response. The helper posts the dispatch body directly, validates that exact response, and prints `ORIGINAL_GITHUB_RUN_ID` from `workflow_run_id`. It does not rediscover the run with timestamp/SHA correlation.

```bash
# Mutating; operator review required. Starts a GitHub Actions run on the staging ref.
set -euo pipefail
set +x

dispatch_browser_qa() {
  mode="$1"
  case "$mode" in
    core|normal) ;;
    *) echo "mode must be core or normal" >&2; return 2 ;;
  esac

  request_body="$(python3 - "$mode" <<'PY'
import json
import sys

mode = sys.argv[1]
if mode not in {"core", "normal"}:
    raise SystemExit("mode must be core or normal")
print(json.dumps({
    "ref": "staging",
    "inputs": {"mode": mode},
    "return_run_details": True,
}, separators=(",", ":")))
PY
)"

  response="$(printf '%s' "$request_body" | gh api -X POST \
    "repos/SolveaCX/new-api/actions/workflows/gcp-browser-qa.yml/dispatches" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    -H "X-GitHub-Api-Version: 2026-03-10" \
    --input -)"

  python3 - "$response" <<'PY'
import json
import sys

raw = sys.argv[1]
if not raw.strip():
    raise SystemExit(
        "ABORT: workflow dispatch returned an empty response. Do not redispatch blindly; "
        "recover the exact run from the GitHub UI or Actions API."
    )
try:
    payload = json.loads(raw)
except json.JSONDecodeError as exc:
    raise SystemExit(
        "ABORT: workflow dispatch returned non-JSON output. Do not redispatch blindly; "
        "recover the exact run from the GitHub UI or Actions API."
    )
if not isinstance(payload, dict):
    raise SystemExit("ABORT: workflow dispatch response must be a JSON object")

run_id = payload.get("workflow_run_id")
if not isinstance(run_id, int) or run_id <= 0:
    raise SystemExit(
        "ABORT: workflow dispatch response missing positive workflow_run_id. "
        "Do not redispatch blindly; recover the exact run from the GitHub UI or Actions API."
    )
for name in ("run_url", "html_url"):
    value = payload.get(name)
    if not isinstance(value, str) or not value.strip():
        raise SystemExit(
            f"ABORT: workflow dispatch response missing string {name}. "
            "Do not redispatch blindly; recover the exact run from the GitHub UI or Actions API."
        )

print(f"ORIGINAL_GITHUB_RUN_ID={run_id}")
print(f"RUN_API_URL={payload['run_url']}")
print(f"RUN_URL={payload['html_url']}")
PY
}

# First run:
dispatch_browser_qa core

# After core passes and cleanup succeeds, run:
# dispatch_browser_qa normal
```

Record `ORIGINAL_GITHUB_RUN_ID` from the dispatch response's `workflow_run_id` for the specific `core` or `normal` run. Do not use a workflow attempt number. If the response is empty, missing `workflow_run_id`, or has malformed URLs, do not redispatch blindly; recover the exact run from the GitHub UI or Actions API before any cleanup-only dispatch.

The GitHub summary must show only status, replay status, exploration status/actions, finding count, cleanup status, and the private GCS URI. Abort and redact the run if a secret, full Gmail address, full plus alias, verification code, password, Cookie, Authorization header, or full API key appears in the summary.

### 9. Private GCS report lookup

Use the GitHub Summary `gcs_uri`, or derive the manifest path from the original GitHub run id:

```bash
# Read-only report lookup example.
set -euo pipefail
set +x

repo_root="$(git rev-parse --show-toplevel)"
GITHUB_RUN_ID="<original-github-run-id>"
GCP_BROWSER_QA_GCS_BUCKET="$(terraform -chdir="$repo_root/deploy/gcp/envs/browser-qa-staging" output -raw browser_qa_report_bucket)"
report_dir="$(mktemp -d)"
trap 'rm -rf "$report_dir"' EXIT

gcloud storage cp \
  "gs://${GCP_BROWSER_QA_GCS_BUCKET}/runs/${GITHUB_RUN_ID}/manifest.json" \
  "$report_dir/manifest.json" \
  --quiet

python3 -m json.tool "$report_dir/manifest.json"
```

Report objects are private and expire by bucket lifecycle after 14 days. Do not upload report downloads to issues, PR comments, tickets, or chat unless they have been manually redacted again.

### 10. Cleanup-only with the original GitHub run id

Use `cleanup-only` when the main run was cancelled, the platform interrupted the workflow before cleanup completed, or cleanup needs to be retried. Always use the original GitHub run id for the run that created the staging identity.

```bash
# Mutating; operator review required. Recomputes the same QA identity from the original run id.
ORIGINAL_GITHUB_RUN_ID="<original-github-run-id>"

gh workflow run gcp-browser-qa.yml \
  --repo SolveaCX/new-api \
  --ref staging \
  -f mode=cleanup-only \
  -f original_run_id="$ORIGINAL_GITHUB_RUN_ID"
```

Abort if `original_run_id` is unknown. Do not substitute the cleanup workflow's new run id; that would derive a different identity and leave the original account unproven.

### 11. `invalid_grant` recovery

`gmail_invalid_grant` from the broker is an infrastructure failure, not a retryable app failure.

Recovery:

1. Stop rerunning `normal`; repeated runs will consume cleanup capacity and produce the same failure.
2. Publish the OAuth app as `In production` if it is still `Testing`.
3. Reauthorize the OAuth client for exactly `https://www.googleapis.com/auth/gmail.readonly`.
4. Rotate `flatkey-browser-qa-gmail-oauth` using the in-memory transform above.
5. Run `core`.
6. If `core` passes and cleanup succeeds, run `normal`.

Abort if the new OAuth grant requires a broader Gmail scope, if the base Gmail profile is not the expected base mailbox, or if `gmail_invalid_grant` repeats after publication and secret rotation.

### 12. Gmail plus-alias restriction failure

Browser QA requires staging to accept Gmail plus aliases generated as `+qa-<run-id>-<8-char-HMAC-suffix>`. The complete derived email address must stay within the backend registration validator's 50-character email limit, so do not lengthen the tag without updating tests and registration constraints. If the workflow fails before account creation with an alias restriction error, classify it as staging configuration failure.

Recovery:

1. Verify staging has `EmailAliasRestrictionEnabled=false`.
2. Do not switch to a non-plus personal mailbox, disposable domain, or committed static test address.
3. Run `cleanup-only` with the original run id if the report or logs show that account creation may have started.
4. Rerun `core` after the staging setting is fixed.

Abort if staging policy intentionally forbids plus aliases; the current QA design depends on deterministic plus-alias derivation and must be redesigned before use.

### Recovery and abort rules

| Condition | Required action |
|---|---|
| phase-aware Terraform plan guard fails | Abort; do not apply; inspect the exact guard finding before changing infrastructure. |
| state/live preflight finds non-empty state or an existing Browser QA resource | Stop and design an import/migration before creating resources; do not continue create and do not use `-target`. |
| Phase A or Phase B saved-plan apply exits non-zero | Treat the corresponding saved plan as invalid; do not retry that plan. If partial apply is detected, stop, write a separate recovery design, then generate and guard a new plan. Do not use `-target`, manual deletion, or import guessing as recovery. |
| Plan touches existing Cloud Run services, LB, URL map, cert, DNS, traffic, or unrelated IAM | Abort; investigate drift or lifecycle ownership. |
| Secret command would put a secret in argv, history, Terraform state, GitHub output, or a committed file | Abort; use stdin/UI/in-memory transform instead. |
| Broker unauthenticated or bad-identity call returns `200` or broker JSON validation | Abort; IAM boundary failed. |
| `core` fails and cleanup succeeds | Triage replay failure from private report; do not run `normal` yet. |
| `normal` returns `findings_detected` and cleanup succeeds | Treat as actionable QA finding; production deploy path remains unchanged. |
| Any run returns `cleanup_failed` | Run `cleanup-only` with the original GitHub run id; manually inspect staging if it repeats. |
| Manifest is missing and cleanup failed or skipped | Run `cleanup-only` with the original GitHub run id before further testing. |
| Manifest is missing but cleanup succeeded | Classify as `infrastructure_failed`; inspect GCS/report upload path. |
| OAuth app is `Testing` and the run passed | Count it as bootstrap only; publish In production, rotate, and rerun before claiming repeatability. |
| `gmail_invalid_grant` | Publish/reauthorize/rotate; do not blind-retry. |
| Gmail plus-alias restriction | Fix staging alias policy or stop; do not change identity strategy ad hoc. |
| Unknown original run id for cleanup | Stop and recover the run id from GitHub Actions before attempting cleanup. |

---

## CI/CD constraints

- Workflow: `.github/workflows/deploy.yml` (GitHub Actions), uses Workload Identity Federation — no static keys.
- Push to `main` triggers `build` automatically.
- `deploy` job is gated by a `production` Environment with `slZhong` as the sole required reviewer.
- Don't bypass the approval gate. Don't merge to main without an approved PR (the auto-mode classifier will block direct merges).

---

## Common destructive actions — confirm first

- Any change to `lb_domains` (causes HTTPS downtime window — see above)
- `terraform destroy` on any module (obviously)
- Bumping `cert_rotation` while a cert is currently ACTIVE (causes new downtime window unnecessarily)
- Removing or changing `router_domains`, `console_domains`, or `website_domains` (changes live host routing)
- Changing Cloudflare proxy mode for `console.flatkey.ai` or `router.flatkey.ai`
- Editing `ServerAddress` admin setting (breaks OAuth callbacks, video proxy URLs, email reset links until rolled to all instances)
- Setting `enable_usage_recon_token = false` or removing the `BLOCKRUN_USAGE_SUMMARY_TOKEN` secret env (breaks the `/usage` reconciliation endpoints → 503; see the section above)

---

## Whitelabel channels (kuaizi etc.)

Some video channels run through the whitelabel pipeline — customer-facing responses must hide upstream provider identity. The registry is in `relay/channel/task/taskcommon/helpers.go::whitelabelChannels`. When adding a new whitelabel channel:

1. Add the channel type constant to that map
2. Add a case in `controller/video_proxy.go::VideoProxy` to resolve the real upstream URL from `task.Data` (see kuaizi case for the pattern)
3. Optionally provide an `ExtractUpstream...VideoURL` helper inside the channel adaptor package

The `ScrubBrandedText` helper has a keyword list — extend `brandKeywords` if the new provider's name leaks through error strings.

---

## When in doubt

1. **Plan before apply, always.** Save with `terraform plan -out=newapi.plan` and inspect.
2. **Targeted applies don't help here** — `cloud_lb` references `cloud_run` so `-target=module.cloud_lb` will still pull cloud_run changes. Fix the lifecycle config instead.
3. **State is recoverable** — GCS versioning is on. If state corrupts, list versions: `gsutil ls -a gs://vocai-gemini-prod-newapi-tfstate/envs/prod/default.tfstate`.
