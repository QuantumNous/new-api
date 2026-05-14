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

If a plan ever shows a diff on these fields, **do not apply**. Either the ignore list got broken, or CI/CD's state was lost — investigate, don't bulldoze.

**Env vars: Terraform owns them, but with a catch.** CI/CD writes specific revision names, which prevents `terraform apply` from updating env vars on the existing revision (HTTP 409 conflict). Workaround:

```bash
# Update env vars directly (gcloud auto-creates a new revision name)
gcloud run services update newapi \
  --region=us-west1 \
  --update-env-vars=KEY1=value1,KEY2=value2

# Then sync TF state without making changes
terraform apply -refresh-only
```

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

Two pairs of hostnames are live:

- **Long form** (depth 3): `new-api.app.flatkey.ai`, `new-api.api.flatkey.ai` — **must stay DNS-only** (gray cloud). Cloudflare Universal SSL only covers `flatkey.ai` and `*.flatkey.ai` (depth ≤ 2). Switching to Proxied (orange cloud) fails with `sslv3 alert handshake failure` because CF has no cert for these.
- **Short form** (depth 2): `one.flatkey.ai`, `router.flatkey.ai` — covered by Universal SSL, can go Proxied if needed. Currently DNS-only.

To use Proxied for depth-3 names would require Total TLS ($10/mo) — declined per cost.

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
- Editing `ServerAddress` admin setting (breaks OAuth callbacks, video proxy URLs, email reset links until rolled to all instances)

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
