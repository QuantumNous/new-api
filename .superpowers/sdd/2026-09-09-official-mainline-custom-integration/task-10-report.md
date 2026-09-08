# Task 10 frontend migration report

Status: PARTIAL

Implemented in official `web/src`:

- Agent workspace and Agent Admin feature modules with API/types/query layers.
- URL-backed `/agents` and `/agent-admin` routes with schema validation, access guards, and role-gated navigation.
- Authenticated, super-admin-only `/usage-ranking` consuming `/api/log/ranking` envelope `data.data.items` and rendering request/quota/token fields.
- `actual_base_url` schema/form/API support with super-admin-only editing and non-super-admin payload stripping.
- i18n keys synchronized across en/zh/fr/ja/ru/vi.

The agent route waits for authoritative status and overview loading, handles overview errors, and passes real overview data. The public `/rankings` page remains unchanged.

Validation:

- `bun run typecheck` — passed.
- `bun run build` — passed.
- Focused sensitive URL regression tests — passed.
- `git diff --check` — passed.

Known limitation: imported custom feature tests using Node's `node:test` module are incompatible with the browser Vitest environment and fail during bundling before test execution. No backend changes were made.
