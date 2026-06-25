# GCP Operations Guide

Read this **before** touching anything under `deploy/gcp/`. Captures the parts of operating the GCP infrastructure that aren't obvious from the Terraform code, especially landmines that have already bitten this project.

This is the AI-facing operations playbook. Architecture inventory is in `INFRASTRUCTURE.md`; deploy/rollback procedures are in `DEPLOYMENT.md`.

---

## Project / environment

- **GCP project**: `vocai-gemini-prod` (project number `528088078482`)
- **Region**: `us-west1` (Oregon)
- **Terraform working directory**: `deploy/gcp/envs/prod/`
- **Terraform state**: GCS backend, bucket `vocai-gemini-prod-newapi-tfstate`, prefix `envs/prod` (versioning enabled — recoverable)
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

**Update 2026-06-12: the PR plan step is affected too.** Run 27411650497 (PR #116) hit the same `AUTH_PERMISSION_DENIED` on serviceusage during refresh, yet the workflow concluded "success" and posted the error text as the PR plan comment. **Treat CI plan comments as untrusted** — always run `terraform plan` locally with Owner ADC before applying.

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
| `newapi` | legacy default/fallback | URL map default backend |

When rolling back or shifting traffic, target the specific service that serves the failing host. Do not assume a `newapi` rollback affects `console.flatkey.ai` or `router.flatkey.ai`; after the runtime split, those hosts route to their own Cloud Run services.

---

## Production runtime split

Current production routing is host-based at the GCP LB:

| Host | Backend service | Cloud Run service | Runtime role |
|---|---|---|---|
| `flatkey.ai`, `www.flatkey.ai` | `newapi-web-backend` | `newapi-web` | Next.js website |
| `console.flatkey.ai` | `newapi-console-backend` | `newapi-console` | Go app, `NODE_TYPE=master`, `APP_ROLE=console` |
| `router.flatkey.ai` | `newapi-router-backend` | `newapi-router` | Go app, `NODE_TYPE=slave`, `APP_ROLE=router` |
| default | `newapi-backend` | `newapi` | legacy fallback |

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

Host-rule rollback sends new requests to the URL map default backend (`newapi-backend`). It does not stop in-flight requests on the previous Cloud Run revision, but it can change application behavior if the fallback service has different image/env. Check logs before choosing host-rule rollback over revision rollback.

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
| `one.flatkey.ai` | DNS only | Legacy/compatibility entry |

Cloudflare's "origin IP partially exposed" warning is expected because the same GCP LB IP has both Proxied and DNS-only records.

Do not flip DNS modes casually:

- Switching depth-3 names to Proxied fails unless Cloudflare Total TLS / ACM is enabled.
- Switching `console.flatkey.ai` to DNS-only would require adding it to GCP `lb_domains`, which triggers managed cert rotation and a possible HTTPS downtime window.
- Switching `router.flatkey.ai` to Proxied is technically possible at depth 2, but should be tested for streaming/model-call behavior first.

To use Proxied for depth-3 names would require Total TLS ($10/mo) — previously declined per cost.

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
