# Aibuff P3 final local integration evidence

Date: 2026-08-05 CST
Role: technical implementation; this file is not an independent sign-off.
Scope: local code/worktree only. No production SSH/API/database/Redis, channels, models, prices, balances, customer tokens, permissions, registry push, deployment, or paid upstream calls were made.

## Frozen integration object

- Worktree: `/private/tmp/aibuff-p3-final-integration-20260805`
- Branch: `codex/p3-final-integration-20260805`
- Base: `e1a8bcd252aaba4c6991aef6489babc6fe830ef9`
- Base tree: `4249a07e9146e18da89ea35ecd168d23b475f2a4`
- Code integration commit (before this evidence file): `c23de2a19860ca8511e89d0e6d406c19feae85ba`
- Code integration tree: `358a6c3b479afcce212e6d243e000247c904c99d`
- Code integration direct parent: `9d498bea54738393f23d2328361b9078f83bb7f3`
- This evidence file is committed immediately on top of the code integration commit; the resulting branch HEAD/tree are reported in the handoff after commit.
- Final status: `git status --porcelain=v1 --untracked-files=all` empty; branch (not detached).
- Candidate label: `IMPLEMENTATION_READY_PENDING_INDEPENDENT_TEST`.
- Production: `BLOCK`; this local integration does not authorize upload, deployment, flag change, channel/model/price/permission change, or real Image2.

## Graph audit and provenance

The requested targeted object was resolved before any write: `3c9fc4404b166894a38f0b79f1c746316e66c5ee`, parent `7243d4f27e45893677fbe9d0105951b2bfaa9b44`, tree `7fbbce772884b785b0ddac3bf50306c8af6c1ad8`. The concurrency object `e1a8bcd252aaba4c6991aef6489babc6fe830ef9` is a descendant of that targeted commit. The Dashboard range is a single linear range from the common P2 base; no graph ambiguity was found.

Dashboard source range (`252b6d74e7199120eae9ee1367d0791ad9b97c1f^..3ab0a7b538ab31a25bd13d8e4362d87e8c49374e`) was cherry-picked in this order:

1. `252b6d74e7199120eae9ee1367d0791ad9b97c1f` (parent `7243d4f27e45893677fbe9d0105951b2bfaa9b44`)
2. `ad799cd514b2c33919a319fa77ecbcb03826fd02` (parent `252b6d74e7199120eae9ee1367d0791ad9b97c1f`)
3. `ea997a234566a8a653dc589936fc315863e3269f` (parent `ad799cd514b2c33919a319fa77ecbcb03826fd02`)
4. `d51ee0ffff5a066aebb772347264db6aad832a8f` (parent `ea997a234566a8a653dc589936fc315863e3269f`)
5. `d3e58361d9b5705462b097b708586aed816bc28b` (parent `d51ee0ffff5a066aebb772347264db6aad832a8f`)
6. `b422198536bc07aec89508ace96a1e84eefd1589` (parent `d3e58361d9b5705462b097b708586aed816bc28b`)
7. `ac29632eb01a26e41956eb268838fd1b1bb06217` (parent `b422198536bc07aec89508ace96a1e84eefd1589`)
8. `3ab0a7b538ab31a25bd13d8e4362d87e8c49374e` (parent `ac29632eb01a26e41956eb268838fd1b1bb06217`)

P3 source commits were then cherry-picked in the requested order:

- `5835a0f3f31d13fa30645eaa96e45342af1f8c8f` (parent `d3e58361d9b5705462b097b708586aed816bc28b`, tree `8d3cf3a7b3468af151ca16d02b167576bce5a7a7`) → integrated `9d498bea54738393f23d2328361b9078f83bb7f3`, tree `aa1d0d900f5131fb12d98d6eaac88a37af371130`.
- `686d3298277dfeece7876418dea268878e6c3730` (parent `5835a0f3f31d13fa30645eaa96e45342af1f8c8f`, tree `c9bda0b7d6bc0321c4d423fd1eb20e0070f8ba7f`) → integrated `c23de2a19860ca8511e89d0e6d406c19feae85ba`, tree `358a6c3b479afcce212e6d243e000247c904c99d`.

Dashboard cherry-pick mapping (source → integrated commit):

| source | integrated |
|---|---|
| `252b6d74e7199120eae9ee1367d0791ad9b97c1f` | `a76ea9b0fddff6a388303f4b918320fb85c129d1` |
| `ad799cd514b2c33919a319fa77ecbcb03826fd02` | `d9459fa92206b088c36a98321ec171252b9b29b3` |
| `ea997a234566a8a653dc589936fc315863e3269f` | `e1e95b0ccce2458dc1787c7db17696e0deb07870` |
| `d51ee0ffff5a066aebb772347264db6aad832a8f` | `313f68392a82525ec5b83db680ff35ecf103f946` |
| `d3e58361d9b5705462b097b708586aed816bc28b` | `bbb8a25e92089cad062a286d79ed9d2ef1a952f8` |
| `b422198536bc07aec89508ace96a1e84eefd1589` | `542dbbb06afb3d6a39403ff8cf08a684aa42c631` |
| `ac29632eb01a26e41956eb268838fd1b1bb06217` | `efa75fc5807f4c5bbff941f1ed3588a5dea31328` |
| `3ab0a7b538ab31a25bd13d8e4362d87e8c49374e` | `e300379847d457769f98fc8c78385a4407c317f0` |

Negative graph checks: P4 `aa0d77231af787e01a2392ad6381a9ac9ef46e4e` is not an ancestor; old P3 Dashboard fork `26e5cb2e546fb227a285816bd3b15e950fec6e0d` is not an ancestor. Neither was cherry-picked. The original source SHAs are provenance anchors; the final branch correctly contains their new cherry-pick SHAs, not duplicate old Dashboard/P4 objects.

## Semantic merge audit

- `middleware/distributor.go`: final request-time channel setup uses read-only `channel.ParseSetting()` at line 416; no `GetSetting()` remains in this request path. Parse errors log a warning and use an empty setting without database repair. Existing runtime `ValidateUserRuntimeGroup` checks in auth/distribution remain present and fail closed.
- `service/channel_select.go`: targeted runtime authorization and `GetUserAutoGroupForUser` filtering from `3c9fc440` remain intact. P3 adds only the `Image2Router` field to `RetryParam`; existing auto/exhaustive group filtering and affinity behavior remain in the final file.
- `controller/relay.go`/`service/image2_smart_router.go`: Image2 capability router is built only when the flag and model/mode match, respects `specific_channel_id`, selects the capability-ordered chain, de-duplicates channels, and uses the Image2 safe-failover evaluator. Missing all capability metadata preserves legacy routing; malformed/partially configured metadata fails closed.
- P3/P2 overlap was auto-merged cleanly in the two known files (`service/channel_select.go`, `middleware/distributor.go`); source and final diffs were inspected, not blindly accepted.
- Final diff contains no P4 artifact/manifest/release-overlay paths.

## Complete changed path set relative to e1a8

```text
.env.example
common/constants.go
common/init.go
common/safe_failover_config_test.go
controller/log.go
controller/log_export_test.go
controller/relay.go
controller/relay_safe_failover_test.go
docs/p3-image2-smart-router-v1.md
dto/channel_settings.go
dto/channel_settings_test.go
middleware/distributor.go
middleware/distributor_setting_test.go
middleware/rate-limit.go
middleware/rate-limit_auth_chain_test.go
middleware/rate-limit_test.go
model/channel.go
model/image2_candidates.go
model/log.go
model/log_usage_summary_test.go
router/api-router.go
router/api_router_analysis_auth_test.go
service/channel_select.go
service/image2_redis_isolation_test.go
service/image2_smart_router.go
service/image2_smart_router_test.go
web/classic/src/components/dashboard/AnalysisPanel.jsx
web/classic/src/components/dashboard/analysisChartSpec.js
web/classic/src/components/dashboard/analysisChartSpec.test.js
web/classic/src/components/dashboard/index.jsx
web/classic/src/components/dashboard/modals/SearchModal.jsx
web/classic/src/helpers/dashboard.jsx
web/classic/src/hooks/dashboard/analysisCsv.js
web/classic/src/hooks/dashboard/analysisCsv.test.js
web/classic/src/hooks/dashboard/analysisState.js
web/classic/src/hooks/dashboard/time.js
web/classic/src/hooks/dashboard/time.test.js
web/classic/src/hooks/dashboard/useDashboardAnalysis.js
web/classic/src/hooks/dashboard/useDashboardData.js
web/classic/src/components/table/channels/modals/EditChannelModal.jsx
web/default/src/features/channels/lib/channel-form.ts
web/default/src/features/dashboard/analysisColumns.test.ts
web/default/src/features/dashboard/analysisColumns.ts
web/default/src/features/dashboard/analysisState.test.ts
web/default/src/features/dashboard/analysisState.ts
web/default/src/features/dashboard/api.test.ts
web/default/src/features/dashboard/api.ts
web/default/src/features/dashboard/components/models/multidimensional-analysis.tsx
web/default/src/features/dashboard/index.tsx
web/default/src/features/dashboard/types.ts
```

## Verification

### Backend and P3/Image2

- `go test -count=1 ./middleware ./service ./controller ./model ./dto ./common ./router` — PASS.
- `go test -race -count=1 ./middleware ./service ./controller ./model ./dto ./common ./router` — PASS.
- `go test -race -count=1 ./service -run '^(TestImage2|TestSafeFailover|TestImage2SafeFailover)' -v` — Image2 capability/filter/failover/race PASS; loopback Redis case was run separately below.
- `go test -race -count=1 ./controller -run '^(TestShouldRetryImage2Router|TestGetChannel|TestSafeFailover)' -v` — PASS, including pinned channel and deterministic 4xx/429/5xx decisions.
- `go test -race -count=1 ./middleware -run '^(TestTokenAuthRejectsHistoricalTokenAfterTargetedPolicyChanges|TestDistributor|TestTokenGroup|TestTokenConcurrency)' -v` — targeted runtime historical-token test PASS; Redis cases skipped in this no-Redis invocation.
- `TOKEN_CONCURRENCY_TEST_REDIS_ADDR=127.0.0.1:16379 go test ./setting ./middleware -run 'Test(ParseTokenConcurrency|TokenConcurrency)' -count=1 -race -timeout=180s` — PASS using a temporary Redis bound only to loopback; process stopped after test.
- `TOKEN_CONCURRENCY_TEST_ALLOW_REDIS_RESTART=1 go test ./middleware -run '^TestTokenConcurrencyRedisRestartAfterTTLDoesNotOverlapHTTP200$' -count=1 -race -timeout=60s` — PASS; first request cancelled, next request 200, no overlapping 200 at limit 1.
- `P3_ISOLATED_REDIS_ADDR=127.0.0.1:16380 go test -race -count=1 ./service -run '^TestImage2IsolatedRedisHashTTL$' -v -timeout=60s` — PASS using temporary loopback Redis; process stopped after test.
- `go build ./...` — PASS after local Classic/Default production builds generated the embedded `web/*/dist` trees.
- `go vet ./middleware ./service ./controller ./model ./dto ./common ./router` — exit 1 on four pre-existing `common/custom-event.go` lock-copy diagnostics. The exact direct parent `0654d754166eb0c76201415e276658dfd8b9a6fc` produced the same four diagnostics and no candidate-new diagnostics; this is a baseline BLOCK, not introduced by this integration.

### Frontend

- Classic `bun test src/hooks/dashboard src/components/dashboard` — 18 pass, 0 fail.
- Default `bun test src/features/dashboard` — 8 pass, 0 fail.
- Classic `bun run build` — PASS (`vite`, 18,037 modules transformed).
- Default `bun run typecheck` — PASS.
- Default `bun run build` — PASS (`rsbuild`).
- Classic changed Dashboard ESLint and Prettier checks — PASS.
- Default changed Dashboard Prettier check — one inherited `src/features/dashboard/index.tsx` formatting warning; no formatting rewrite was added to preserve source provenance. Default ESLint reports existing `@ts-nocheck`, set-state-in-effect, and unused-arg diagnostics in inherited Dashboard files; typecheck/build/unit remain PASS.

### Browser smoke

- Started the final embedded Default frontend and backend locally on `127.0.0.1:3001` with disposable SQLite and no Redis/upstream. Browser setup, initialization, login, and `/console` Dashboard navigation were completed using synthetic local-only credentials.
- Observed Dashboard `多维消费分析` with `管理员视图`, empty state `当前筛选条件下暂无消费记录`, no dead user/token/group/channel columns in the scoped analysis card, and no target `axes.forEach`/`ReferenceError`/uncaught/ErrorBoundary markers after login. API requests (`/api/status`, `/api/log/analysis`) returned 200 in the local backend log.
- A separate Classic Vite-only smoke without an API server produced expected local stub 404s; it is not treated as a Dashboard PASS. No production/browser session was used.
- Browser tab and local server were finalized/stopped after evidence capture.

### Full repository baseline

- `go test -count=1 ./...` — BLOCK with the same direct-parent failures: three Claude file-content conversion tests (`relay/channel/claude`) and `relay/helper` `TestStreamScannerHandler_StreamStatus_PreInitialized`, plus existing stream timeout/noise. The exact direct parent `0654d754166eb0c76201415e276658dfd8b9a6fc` reproduced the same failing packages; no P3/Dashboard integration attribution is made.

## Remaining risk and next owner

- Independent testing/Claude must re-run against the exact final SHA `c23de2a19860ca8511e89d0e6d406c19feae85ba` and sign or block; no prior source SHA sign-off transfers automatically.
- P4 development/release identity, registry digest, backups, production locks, dual-node same-image proof, real capability metadata, zero-traffic flag-off baseline, real Image2 billing/Request ID/duplicate-charge evidence, and observation windows remain outside this local task and keep production `BLOCK`.
- Browser evidence is local/default empty-state only; real Safari/Chrome production session and Classic VChart cancellation-chain evidence remain independent gates. The candidate may be handed to `/root` for independent test review, not deployed.
