# Asset review follow-up hardening implementation plan

## Task 1: Lock and fix TechMobi readiness semantics

Files: `service/techmobi_asset.go`, `service/techmobi_asset_test.go`

1. Replace the test that encodes immediate Active with a failing regression proving `GetAsset` cannot infer readiness from URI syntax.
2. Add a failing regression for `Processing + assetUrl` remaining retryable rather than producing a persisted pollable result.
3. Make the smallest production change: return retryable Processing from upload and from opaque `GetAsset`; keep synchronous Active upload unchanged.
4. Run focused TechMobi materializer and binding/worker tests.

## Task 2: Separate target rotation from temporary retry

Files: `service/asset_model_worker.go`, `service/asset_model_worker_test.go`

1. Add regressions for candidate-set drift and temporary target ineligibility/option failures.
2. Introduce explicit rotation causes or separate helpers so only proven exhaustion rotates terminally.
3. Make unmatched targets schedule retry rather than default to candidate zero.
4. Preserve existing definitive and five-minute-window exhaustion tests.

## Task 3: Batch strict active-binding projection

Files: `service/asset_model_status.go`, `service/asset_model_status_test.go` and, only if necessary, a narrowly scoped model query helper and its tests.

1. Add a query-count regression for multiple models sharing and not sharing compound binding keys.
2. Load matching active bindings once for the target key set.
3. Pass the shared key map to strict status and `available_models` projection.
4. Verify identical output for active, processing, failed, stale generation, and credential-scope cases.

## Task 4: Review, integration, and delivery

1. Run independent specification and code-quality review for each task.
2. Run focused controller/service/model tests, `go build ./...`, package-scoped vet, `git diff --check`, OpenAPI JSON parse, and probe script parse.
3. Re-read current PR comments, respond with evidence, commit using Lore trailers, and push the branch.
4. Provide a production smoke test that uploads two fresh images, records upload/readiness/task timings, checks `available_models`, creates fast and pro tasks only when listed, polls terminal state, and fails nonzero on any unsuccessful terminal result.
