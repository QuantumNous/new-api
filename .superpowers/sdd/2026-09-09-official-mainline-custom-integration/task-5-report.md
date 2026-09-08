# Task 5 report: retain official billing and plugin semantics

## Status

COMPLETE for the official mainline billing/plugin checkpoint. The worktree
already matches `upstream/main` for every source path listed by Task 5, so no
runtime source change was justified. The official tiered-expression billing,
model billing identity/modifier handling, quota saturation safeguards, and JS
task-plugin usage-schema path are retained as the single implementation.

Custom Agent/CXM/rankings consumers and `actual_base_url` remain deferred
extension work as required by the integration boundary; this task does not
reintroduce duplicate quota conversion or custom settlement logic.

## Official source audit

The following command produced no diff, confirming that the requested billing,
model, relay/helper, service, controller, plugin, and task paths are identical
to the official skeleton:

```text
git diff --stat upstream/main...HEAD -- \
  pkg/billingexpr setting/billing_setting relay/helper \
  service/quota.go service/text_quota.go service/tiered_settle.go \
  model/pricing.go model/model_pricing_config.go controller/ratio_sync.go \
  plugins relay/channel/task
```

Read-only symbol checks confirmed the expected official seams are present:
`tiered_expr` model selection, canonical model pricing resolution, checked
quota conversion (`QuotaFromDecimalChecked`, `QuotaRoundChecked`, and
`QuotaFromFloatChecked`), request-rule traces, task `usageSchema` validation,
and plugin canonical usage ceilings.

Because the branch is an official-mainline integration branch, copying the
custom implementation would create competing billing contracts and violate
the brief's instruction to defer Agent/CXM/rankings and `actual_base_url`.

## Verification

Focused official billing checks passed:

```text
go test ./pkg/billingexpr/... ./service/... ./relay/helper/... \
  -run 'Tier|Quota|Billing|Price|Usage' -count=1
```

`pkg/billingexpr`, `service` (including `service/authz` and `service/passkey`),
and `relay/helper` all passed.

Model, controller, plugin, and task-channel checks also passed:

```text
go test ./controller ./model ./plugins/... ./relay/channel/task/... -count=1
```

The controller, model, plugins, and `relay/channel/task/jsplugin` packages
passed; `taskcommon` has no test files.

The same focused billing selector was run under the race detector and passed
for all packages. The macOS linker emitted non-fatal `LC_DYSYMTAB` warnings
while linking the race binaries; no race report or test failure occurred:

```text
go test -race ./pkg/billingexpr/... ./service/... ./relay/helper/... \
  -run 'Tier|Quota|Billing|Price|Usage' -count=1
```

No MySQL/PostgreSQL DSNs or external provider fixtures were available, so
cross-database migration and authorized real-provider billing evidence remain
outside this checkpoint. No production system, customer data, or database was
touched.

## Commit

This report is the only Task 5 working-tree change. The source commit is
therefore intentionally empty: official billing and plugin semantics were
already present and verified in the integration HEAD.
