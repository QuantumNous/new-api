# Router / Console Runtime Split Plan

Date: 2026-06-24
Repository: `SolveaCX/new-api`
Environment: GCP project `vocai-gemini-prod`, region `us-west1`

## Objective

Split the Go new-api runtime into separately deployed Cloud Run services for model traffic and console traffic while keeping the existing website service unchanged:

- `router.flatkey.ai` routes to `newapi-router`, sized and released for stable model invocation traffic.
- `console.flatkey.ai` routes to `newapi-console`, sized and released for faster product iteration.
- `flatkey.ai` and `www.flatkey.ai` continue routing to the standalone website service `newapi-web`.
- Existing `newapi` remains as the default backend during the first rollout, so URL map host rules can be removed or redirected back to `newapi-backend` for quick rollback.

This is a runtime-role split, not a code-level microservice split.

## Current Implementation Status

This branch implements the first additive slice of the plan:

- Uses the existing `NODE_TYPE` runtime switch: `newapi-router` is slave and `newapi-console` is master.
- Keeps the existing `newapi` service as the default backend/fallback during rollout, then it can be drained only after console is confirmed as the master node.
- Avoids Go business-code changes in this slice.
- Keeps local cache convergence and local batch update flushing intact where needed for multi-node runtime correctness.
- Parameterizes `.github/workflows/gcp-deploy.yml` with `target=legacy-newapi|console|router`.
- Keeps website deployment independent in `.github/workflows/gcp-deploy-website.yml`.
- Adds optional Terraform resources for `newapi-router` and `newapi-console`.
- Sets `router_domains=[]` and `console_domains=[]` in the first Terraform slice, so service/backends can be created before any host cutover.
- Leaves `lb_domains` unchanged.
- Keeps existing staging resources explicit in `terraform.tfvars` (`enable_staging=true`, `enable_staging_domains=true`) so the prod-env plan does not schedule count-based staging destroys.

Not implemented in this branch:

- Route exposure gates by role.
- Dedicated `newapi-worker`.
- Full target-specific router/console business smoke tests beyond `/api/status`.
- Cloudflare, DNS, or certificate changes.

Local validation run on 2026-06-24:

- `go test ./common ./service ./controller` passed.
- `terraform -chdir=deploy/gcp/envs/prod init -backend=false` passed for local validation setup only.
- `terraform -chdir=deploy/gcp/envs/prod validate` passed.
- `terraform fmt -recursive deploy/gcp` passed.
- `.github/workflows/gcp-deploy.yml` parses as YAML.
- `git diff --check` passed.
- `go test ./...` is not fully green in this worktree: the root package requires missing embedded `web/classic/dist`, and existing Claude channel tests fail in `relay/channel/claude` around file content conversion. These failures are outside this runtime-split change set but must be considered before using full-repo tests as a release gate.
- `actionlint` is not installed locally, so GitHub Actions semantic linting was not run.

## Current Production Facts

- `newapi-urlmap` already uses host-based routing:
  - `flatkey.ai`, `www.flatkey.ai` -> `newapi-web-backend`
  - all other hosts -> `newapi-backend`
- `router.flatkey.ai` resolves directly to the GCP LB IP `34.54.128.101`.
- GCP managed certificate `newapi-cert-4dc684` is `ACTIVE` for `router.flatkey.ai`.
- `console.flatkey.ai` currently resolves to Cloudflare edge IPs and successfully reaches Google via Cloudflare.
- `console.flatkey.ai` is not covered by the current GCP managed certificate; direct origin access to the LB with that host fails TLS name validation.
- Current Go production service `newapi` has `minScale=4`, `maxScale=10`, `concurrency=50`, and `timeout=3600`.
- `newapi-web` is already an independent Cloud Run service and workflow.

## Non-Goals

- Do not split the Go codebase into independent services in this phase.
- Do not migrate database ownership by service.
- Do not change Cloudflare DNS, proxy mode, or SSL mode in this phase.
- Do not modify `lb_domains` or recreate the existing GCP managed certificate.
- Do not move `ServerAddress`, OAuth provider callbacks, or payment webhook URLs until a separate low-risk migration window.
- Do not remove the old `newapi` service from the LB during the first rollout.

## Architecture Target

```text
flatkey.ai / www.flatkey.ai
  -> GCP LB host rule
  -> newapi-web-backend
  -> Cloud Run: newapi-web

router.flatkey.ai
  -> GCP LB host rule
  -> newapi-router-backend
  -> Cloud Run: newapi-router

console.flatkey.ai
  -> Cloudflare orange-cloud
  -> GCP LB host rule
  -> newapi-console-backend
  -> Cloud Run: newapi-console

default / fallback
  -> newapi-backend
  -> Cloud Run: newapi
```

## Service Roles

### `newapi-router`

Purpose: stable model invocation path.

Initial settings:

- `NODE_TYPE=slave`
- `minScale=4`
- `maxScale=10` initially, tune from production metrics
- `concurrency=50`
- `timeout=3600`
- CPU always allocated for streaming behavior

Traffic:

- `/v1`, `/v1beta`, `/mj`, `/suno`, task/video relay paths
- token auth
- model routing
- quota consumption
- billing settlement tied to relay requests
- request logging and error logging

Release rule:

- Manual deployment at first.
- Later, optionally path-gated auto deploy for relay/channel/billing/model-routing changes only.

### `newapi-console`

Purpose: fast-moving user and admin console surface.

Initial settings:

- `NODE_TYPE=master`
- `minScale=1` initially; raise to `2` if sign-up/payment reliability needs warmer capacity
- `maxScale=5` initially, tune from production metrics
- `concurrency=80`
- `timeout=3600` initially to avoid unexpected request behavior drift

Traffic:

- console SPA
- `/api/user`
- `/api/token`
- `/api/log/self`
- `/api/data/self`
- `/api/task/self`
- `/api/subscription`
- wallet, top-up, invoice, OAuth and payment callback paths
- admin APIs during the transition unless `admin` is split separately later

Release rule:

- Can be deployed more frequently.
- May be the default Go deployment target after the split is stable.

### `newapi` During Transition

Purpose: default fallback and optional worker holder.

Initial settings:

- Keep as current production service.
- Keep as `newapi-urlmap.defaultService`.
- Keep old host behavior for unclassified hosts.
- Optionally retain background jobs until a dedicated worker is introduced.

Longer-term target:

- Replace worker responsibility with `newapi-worker`.
- Keep or remove `newapi` fallback only after rollback confidence is high.

## Required Runtime Configuration

Use the existing project-native runtime switch:

```bash
NODE_TYPE=master|slave
```

Minimum behavior:

- `newapi-router` must be deployed with `NODE_TYPE=slave`.
- `newapi-console` must be deployed with `NODE_TYPE=master`.
- The existing `newapi` service remains as fallback during transition, but must not be the only master once it is drained or removed.
- Do not set `CHANNEL_UPDATE_FREQUENCY` on router unless the code path is separately gated.

Local read-only cache convergence can remain enabled where required, but global writers must be single-owner or explicitly distributed-safe.

### Route Exposure Gate

First phase may keep all routes compiled into all services, but the safer target is:

- router role only exposes relay/model traffic and required read-only support routes.
- console role exposes console/API routes and static assets.
- worker role exposes no public traffic unless needed for health checks.

This route gate should be added before relying on the split as a security boundary.

## CI/CD Plan

Website remains independent:

- `.github/workflows/gcp-deploy-website.yml`
- builds `website` image
- deploys `newapi-web`

Go app uses one parameterized workflow, not two duplicated workflows:

- keep `.github/workflows/gcp-deploy.yml`
- build one `server:sha-*` image
- deploy to a selected target service

Recommended workflow inputs:

```yaml
workflow_dispatch:
  inputs:
    target:
      type: choice
      options:
        - console
        - router
        - legacy-newapi
    image_tag:
      required: false
```

Target mapping:

```text
target=console
  RUN_SERVICE=newapi-console
  NODE_TYPE=master

target=router
  RUN_SERVICE=newapi-router
  NODE_TYPE=slave

target=legacy-newapi
  RUN_SERVICE=newapi
  NODE_TYPE=master
```

Initial trigger policy:

- Push to `main` may continue building the Go image.
- Push to `main` defaults to `legacy-newapi` until the split is verified.
- Automatic deployment should default to `console` only after a later explicit workflow change.
- `router` deployment should be manual at first.
- `legacy-newapi` deployment should be manual only.

Each target keeps the current no-traffic deployment shape:

1. Build or reuse image.
2. `gcloud run services update <RUN_SERVICE> --no-traffic`.
3. Tag the new revision as `canary`.
4. Health check canary URL.
5. Optional canary traffic.
6. Promote to 100%.
7. Record service, revision, image, and target in the workflow summary.

Smoke checks must be target-specific:

Router:

- `/api/status`
- `/v1/models` using a safe test key
- a lightweight non-streaming relay call where feasible
- a lightweight streaming relay call where feasible

Console:

- `/api/status`
- console root/static page
- unauthenticated API behavior for `/api/user/self`
- login/session smoke in a non-production test user path where feasible
- payment/OAuth callbacks tested before production cutover

Current branch status: the workflow probes `/api/status` for all targets. The deeper router/console smoke checks remain rollout tasks because they require safe production test credentials and callback fixtures.

## Environment and Secret Manifest

Do not rely on manual copying from the current `newapi` live env.

Create a reviewed manifest with these groups:

Common:

- `SQL_DSN`
- `REDIS_CONN_STRING`
- `SESSION_SECRET`
- `CRYPTO_SECRET`
- `GIN_MODE`
- `TZ`
- `MEMORY_CACHE_ENABLED`
- `SYNC_FREQUENCY`
- `SQL_MAX_OPEN_CONNS`
- `SQL_MAX_IDLE_CONNS`
- `SQL_MAX_LIFETIME`
- `COOKIE_SESSION_DOMAIN`
- `SESSION_COOKIE_SECURE`
- `OFFICIAL_WEBSITE_ORIGIN`
- `APP_CONSOLE_ORIGIN`
- `NODE_TYPE`

Router:

- `STREAMING_TIMEOUT`
- `ERROR_LOG_ENABLED`
- `BLOCKRUN_USAGE_SUMMARY_TOKEN`
- relay and rate-limit variables

Console:

- Paddle and other payment provider configuration
- OAuth provider runtime configuration
- Turnstile configuration
- GA and analytics variables
- frontend/console display origins

Worker:

- background-job toggles
- batch update settings
- task polling settings

Terraform may seed baseline env, but live env ownership must be explicit because current production ignores Cloud Run env changes in Terraform lifecycle.

## Terraform / GCP Infrastructure Plan

### Add Cloud Run Services

Add two Go Cloud Run services:

- `newapi-router`
- `newapi-console`

Use the existing `cloud-run` module where possible. Parameterize:

- service name
- min/max instances
- role env
- background job env
- optional env profile

Current Terraform defaults:

- `enable_runtime_split=true` in `terraform.tfvars`
- `enable_staging=true` and `enable_staging_domains=true` remain explicit to preserve the already-created staging environment.
- `newapi-router`: min `4`, max `10`, concurrency `50`, `NODE_TYPE=slave`
- `newapi-console`: min `1`, max `5`, concurrency `80`, `NODE_TYPE=master`
- `router_domains=[]`
- `console_domains=[]`

With the domain lists empty, the first apply creates services/backends without adding router/console host rules to the URL map.

### Add Serverless NEGs and Backends

Extend `cloud-lb` module or add equivalent resources:

- `newapi-router-cr-neg`
- `newapi-console-cr-neg`
- `newapi-router-backend`
- `newapi-console-backend`

### Extend URL Map Host Rules

Target URL map shape:

```text
host_rule:
  hosts = ["flatkey.ai", "www.flatkey.ai"]
  path_matcher = "website"

host_rule:
  hosts = ["router.flatkey.ai"]
  path_matcher = "router"

host_rule:
  hosts = ["console.flatkey.ai"]
  path_matcher = "console"

path_matcher website:
  default_service = newapi-web-backend

path_matcher router:
  default_service = newapi-router-backend

path_matcher console:
  default_service = newapi-console-backend

default_service = newapi-backend
```

### Do Not Change Certificate Domains

No `lb_domains` change in this rollout.

`console.flatkey.ai` remains Cloudflare proxied. If a future phase requires DNS-only console origin, create a certificate plan that avoids replacing the current active certificate in a way that causes downtime.

## Rollout Sequence

### Phase 0: Preparation

1. Freeze the no-change constraints:
   - no Cloudflare change
   - no DNS change
   - no GCP certificate change
   - no `ServerAddress` change
2. Document current `newapi` service env and revision.
3. Confirm current URL map and cert state.
4. Prepare rollback commands.

### Phase 1: Code and CI/CD

1. Add runtime role flags.
2. Gate background jobs.
3. Update deploy workflow for `target=console|router|legacy-newapi`.
4. Add target-specific smoke checks.
5. Run unit tests and build checks.

### Phase 2: Infrastructure Additive Apply

1. Add `newapi-router` and `newapi-console`.
2. Add serverless NEGs and backend services.
3. Do not add URL map host rules yet if you want a two-step apply.
4. Deploy initial revisions with no traffic.
5. Verify each service directly through canary or run.app URL.

### Phase 3: Pre-Cutover Validation

Router validation:

- `/api/status`
- `/v1/models`
- non-streaming relay smoke
- streaming relay smoke
- token auth failure and success behavior
- quota/log side effects

Console validation:

- console SPA
- login/logout
- token management
- wallet/top-up calculation
- payment request path
- OAuth callback path
- user logs and task logs
- admin paths if still served here

Cross-service validation:

- console config changes propagate to router.
- cache invalidation or sync delay is acceptable and documented.
- worker-only jobs do not run in router or console logs.

### Phase 4: Host Cutover

Recommended order:

1. Cut `console.flatkey.ai` to `newapi-console-backend`.
2. Observe 30 to 60 minutes.
3. Cut `router.flatkey.ai` to `newapi-router-backend`.
4. Observe at least 2 hours or one meaningful traffic window.

The cutover is only URL map host-rule modification. `defaultService` stays `newapi-backend`.

### Phase 5: Stabilization

1. Keep old `newapi` alive as fallback.
2. Keep router deploy manual.
3. Allow console deploys after production approval.
4. Track service-specific dashboards and alerting.
5. After stable operation, consider splitting `newapi-worker`.

## Go / No-Go Gates

Go only if all are true:

- Router deploys with `NODE_TYPE=slave`.
- Console deploys with `NODE_TYPE=master`.
- Env/secret manifest exists and is applied to both services.
- Deploy workflow can deploy router and console independently.
- New services pass target-specific smoke checks.
- No destructive DB migration is in the release.
- URL map rollback command is ready.
- Old `newapi` remains default backend.
- Cloudflare and GCP certificates remain unchanged.

No-go if any are true:

- `console.flatkey.ai` requires GCP certificate changes.
- Env values are copied manually without review.
- Background job ownership is unclear.
- Router streaming smoke test fails or is not run.
- Payment/OAuth callback paths are unverified.
- DB migration requires router and console to be upgraded simultaneously.

## Rollback Plan

Fast URL map rollback:

```bash
# Restore router and console hosts to the existing default backend by removing
# their host rules or changing their path matchers back to newapi-backend.
```

Service revision rollback:

```bash
gcloud run services update-traffic newapi-router \
  --project=vocai-gemini-prod \
  --region=us-west1 \
  --to-revisions=<previous-router-revision>=100

gcloud run services update-traffic newapi-console \
  --project=vocai-gemini-prod \
  --region=us-west1 \
  --to-revisions=<previous-console-revision>=100
```

Fallback:

- Keep `newapi-backend` as URL map default until the split has survived several production releases.
- Do not run destructive migrations during the split rollout.

## Observability Requirements

Dashboards or queries must distinguish:

- host
- backend service
- Cloud Run service
- revision
- HTTP status
- route tag
- relay streaming aborts
- payment webhook failures
- OAuth callback failures
- DB connection count
- Redis errors
- background job ownership logs

Minimum alert candidates:

- `newapi-router` 5xx rate
- `newapi-router` streaming abort spike
- `newapi-router` latency spike
- `newapi-console` login or callback 5xx
- payment webhook 4xx/5xx
- DB connection saturation
- duplicate worker/job execution

## Database Compatibility Policy

Because router and console may run different versions, schema and data format changes must use expand/contract:

1. Add new nullable fields or tables.
2. Deploy readers that tolerate both old and new formats.
3. Deploy writers that can dual-write if necessary.
4. Upgrade router and console.
5. Only later remove old fields or assumptions.

During the split rollout:

- no destructive migrations
- no required same-time router and console upgrade
- no critical new console write that old router cannot read

## ADR

### Decision

Use GCP LB host-based routing to split `router.flatkey.ai` and `console.flatkey.ai` into separate Cloud Run services while keeping a shared codebase and shared database in the first phase.

### Drivers

- Keep model invocation path stable.
- Allow faster console product iteration.
- Avoid premature microservice boundaries.
- Preserve quick rollback through the existing `newapi` backend.
- Avoid TLS downtime by not changing certificates or Cloudflare.

### Alternatives Considered

1. Keep one `newapi` service.
   - Lowest operational complexity.
   - Does not isolate router stability from console release cadence.

2. Full code-level microservice split.
   - Stronger long-term boundaries.
   - Too risky now because user, billing, token, log, and relay data are deeply coupled.

3. Runtime-role split with shared codebase.
   - Provides deployment and scaling isolation.
   - Requires disciplined env, background job, DB compatibility, and CI/CD controls.

### Why Chosen

Runtime-role split gives the desired release-cadence isolation without forcing a premature service decomposition. The existing LB already supports host routing, and the existing website split proves the host-rule pattern is viable.

### Consequences

- CI/CD must become service-target aware.
- Env ownership must be explicit.
- Background jobs need hard role gates.
- Database changes must be cross-version compatible.
- Observability must be service- and host-aware.

### Follow-Ups

- Add `newapi-worker` after router/console split stabilizes.
- Add route exposure gates by role.
- Add path-based router auto-deploy only after manual router deployments are proven.
- Decide whether `console.flatkey.ai` should remain Cloudflare proxied long term or receive first-class GCP origin certificate support in a separate certificate-safe rollout.
