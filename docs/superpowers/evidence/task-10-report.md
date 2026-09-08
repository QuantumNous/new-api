# Task 10 frontend migration report

Status: PARTIAL

## Completed

- Added `actual_base_url` to the official `web/src` channel schema, form defaults, edit hydration, create/update payloads, and super-admin-only channel editor field.
- Added `actual_base_url` to usage-log DTO parsing for runtime/display URL responses.
- Ran i18n synchronization; all six supported locale files remain generated from the same key set.

## Validation

- `cd web && bun run typecheck` — passed.
- `cd web && bunx oxlint -c .oxlintrc.json src/features/channels/types.ts src/features/channels/lib/channel-form.ts src/features/channels/components/drawers/channel-mutate-drawer.tsx src/features/usage-logs/data/schema.ts` — passed.
- `cd web && bun run test --run src/features/channels/lib/__tests__/new-api-channel.test.ts src/features/usage-logs/components/__tests__/detail-preview.test.tsx` — 2 files, 18 tests passed.

## Remaining

The full Agent/CXM admin/customer screens from the custom frontend still require a dedicated adaptation to the official `web/src` route and component APIs; the old `web/default` implementation was not copied into the long-term official tree.
