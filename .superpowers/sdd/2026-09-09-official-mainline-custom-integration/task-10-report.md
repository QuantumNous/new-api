# Task 10 frontend migration report

Status: PARTIAL

## Completed

- Added `actual_base_url` to official `web/src` channel schema, form defaults, edit hydration, create/update payloads, and the super-admin-only editor field.
- Added `actual_base_url` to usage-log DTO parsing.
- Added `actual_base_url` to `SENSITIVE_UPDATE_FIELDS`; non-super-admin update payloads now omit it (with regression coverage).
- Added translations for all new UI strings in en, zh, fr, ja, ru, and vi through the sanctioned script workflow, followed by `bun run i18n:sync`.

## Pending

- Agent/CXM admin and customer frontend migration remains pending.
- Usage-ranking frontend migration from the custom tree remains pending; the existing official public rankings page was not replaced.

## Validation

- `cd web && bun run typecheck` — passed.
- Targeted oxlint on changed TypeScript files — passed.
- Targeted Vitest channel and usage-log tests — passed (18 tests).
- Sensitive update regression test — passed.
- `cd web && bun run build` — not run in this follow-up; full test suite — not run. These remain integration-gate work.
