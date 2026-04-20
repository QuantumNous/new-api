# Task Billing Log Update

## Scope

This update fixes how async video task billing is recorded and displayed for usage logs.

## Changes

- Backend task pre-consume logs now persist `conditional_input_price` in the log `other` field.
- Usage log summary rendering now detects async task logs and uses task-specific billing text instead of text-token pricing text.
- Task billing detail rendering now shows the correct conditional input price and avoids invalid output-price display for async task logs.
- Added regression tests for:
  - frontend task billing summary rendering
  - backend task consume log persistence

## Affected Files

- `service/task_billing.go`
- `service/task_billing_test.go`
- `web/src/helpers/taskBillingSummary.js`
- `web/src/helpers/taskBillingSummary.test.js`
- `web/src/helpers/render.jsx`
- `web/src/components/table/usage-logs/UsageLogsColumnDefs.jsx`
- `web/src/hooks/usage-logs/useUsageLogsData.jsx`

## Verification

- `go test ./service -run "TestLogTaskConsumptionIncludesConditionalInputPrice|TestRecalculateTaskQuotaByTokensPrefersConditionalInputPrice"`
- `node --test web/src/helpers/taskBillingSummary.test.js`
- `docker compose -f deploy/newapi-local/docker-compose.postgres.yml build new-api`

## Notes

- Existing historical logs without `conditional_input_price` will still render with legacy data because the field was not stored at the time they were created.
- New async video task logs will render with the corrected billing summary once generated after this update.
