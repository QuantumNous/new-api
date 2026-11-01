# Implementation

1. [x] Add regression tests for unlimited quota and plan limit selection.
2. [x] Implement backend persistence, validation, rate limiting and response contract.
3. [x] Add admin form controls, translations and documentation.
4. [x] Run focused backend and frontend tests and inspect the diff.

SQLite migration was tested; MySQL and PostgreSQL matrix tests require separate test databases not configured in this workspace.

## Review fixes and verification (2026-11-02)

- Fixed review item 3: ordinary users perform one indexed membership query on a cache miss and zero database queries from the plan limiter on cache hits. Plan edits, cancellation and expiry are read immediately.
- Fixed review item 4: Unicode ID validation is shared by the controller and model. Verified 43/128 Chinese characters and 128 emoji are accepted; overlong and control-character IDs return 400.
- Passed `go test ./model ./middleware ./router ./controller` and `go vet ./model ./middleware ./router ./controller`.
- Passed repeated focused regressions with `-count=2` for membership caching, plan updates, expiry, Unicode IDs, HTTP/WebSocket and plugin routes.
- Passed 11 frontend tests across plan forms, purchase scope, partner tenant management and OAuth client forms; `bun run typecheck` and lint for changed TypeScript files also passed.

## Remaining review follow-ups

The user requested fixes for review items 3 and 4. Items 1 (video remix bypasses the plan limiter) and 2 (partner plan UI remains gated by payment compliance) remain unresolved. Keep this task open until those follow-ups are addressed.
