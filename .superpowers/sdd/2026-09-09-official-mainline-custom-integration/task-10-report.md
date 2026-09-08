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

## Reviewer P1 authz closure

`actual_base_url` is now independently gated by the super-admin role. Users with `SENSITIVE_WRITE` may continue editing the existing sensitive fields, but cannot submit or clear `actual_base_url`. Regression coverage includes sensitive-write/non-super-admin and super-admin cases.

Follow-up validation: typecheck passed; focused authz test passed; changed-file oxlint passed; production build passed; `git diff --check` passed.

## Final review scope

The custom Agent and Agent Admin feature modules and their API/query/type layers have been copied into the official `web/src/features` architecture. They currently require route-tree registration and integration with the official navigation/access configuration before release. The custom usage-ranking screen consuming `/api/log/ranking` likewise remains pending; the existing official `/api/rankings` public page is a separate feature.

Validation after feature import: typecheck passed, focused sensitive-field test passed, and production build passed. Full frontend test suite and route-tree generation remain integration-gate work.

## Route and ranking integration

Registered authenticated `/agents` and `/agent-admin` routes and added `/usage-ranking`, which consumes root-only `/api/log/ranking` without replacing the public `/api/rankings` page. Route-tree generation occurred during `bun run build`.

Final follow-up validation: `bun run typecheck` and production build passed. Existing imported custom tests using `node:test` are incompatible with the browser Vitest environment and fail before executing; this is recorded as a pre-existing migration issue.
