# CLAUDE.md — Project Conventions for new-api

## Overview

This is an AI API gateway/proxy built with Go. It aggregates 40+ upstream AI providers (OpenAI, Claude, Gemini, Azure, AWS Bedrock, etc.) behind a unified API, with user management, billing, rate limiting, and an admin dashboard.

## Tech Stack

- **Backend**: Go 1.22+, Gin web framework, GORM v2 ORM
- **Frontend**: React 19, TypeScript, Rsbuild, Radix UI, Tailwind CSS
- **Databases**: SQLite, MySQL, PostgreSQL (all three must be supported)
- **Cache**: Redis (go-redis) + in-memory cache
- **Auth**: JWT, WebAuthn/Passkeys, OAuth (GitHub, Discord, OIDC, etc.)
- **Frontend package manager**: Bun (preferred over npm/yarn/pnpm)

## Architecture

Layered architecture: Router -> Controller -> Service -> Model

```
router/        — HTTP routing (API, relay, dashboard, web)
controller/    — Request handlers
service/       — Business logic
model/         — Data models and DB access (GORM)
relay/         — AI API relay/proxy with provider adapters
  relay/channel/ — Provider-specific adapters (openai/, claude/, gemini/, aws/, etc.)
middleware/    — Auth, rate limiting, CORS, logging, distribution
setting/       — Configuration management (ratio, model, operation, system, performance)
common/        — Shared utilities (JSON, crypto, Redis, env, rate-limit, etc.)
dto/           — Data transfer objects (request/response structs)
constant/      — Constants (API types, channel types, context keys)
types/         — Type definitions (relay formats, file sources, errors)
i18n/          — Backend internationalization (go-i18n, en/zh)
oauth/         — OAuth provider implementations
pkg/           — Internal packages (cachex, ionet)
web/             — Frontend themes container
  web/default/   — Default frontend (React 19, Rsbuild, Radix UI, Tailwind)
  web/classic/   — Classic frontend (React 18, Vite, Semi Design)
  web/default/src/i18n/ — Frontend internationalization (i18next, zh/en/fr/ru/ja/vi)
```

## Internationalization (i18n)

### Backend (`i18n/`)
- Library: `nicksnyder/go-i18n/v2`
- Languages: en, zh

### Frontend (`web/default/src/i18n/`)
- Library: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Languages: en (base), zh (fallback), fr, ru, ja, vi
- Translation files: `web/default/src/i18n/locales/{lang}.json` — flat JSON, keys are English source strings
- Usage: `useTranslation()` hook, call `t('English key')` in components
- CLI tools: `bun run i18n:sync` (from `web/default/`)

## Rules

### Rule 1: JSON Package — Use `common/json.go`

All JSON marshal/unmarshal operations MUST use the wrapper functions in `common/json.go`:

- `common.Marshal(v any) ([]byte, error)`
- `common.Unmarshal(data []byte, v any) error`
- `common.UnmarshalJsonStr(data string, v any) error`
- `common.DecodeJson(reader io.Reader, v any) error`
- `common.GetJsonType(data json.RawMessage) string`

Do NOT directly import or call `encoding/json` in business code. These wrappers exist for consistency and future extensibility (e.g., swapping to a faster JSON library).

Note: `json.RawMessage`, `json.Number`, and other type definitions from `encoding/json` may still be referenced as types, but actual marshal/unmarshal calls must go through `common.*`.

### Rule 2: Database Compatibility — SQLite, MySQL >= 5.7.8, PostgreSQL >= 9.6

All database code MUST be fully compatible with all three databases simultaneously.

**Use GORM abstractions:**
- Prefer GORM methods (`Create`, `Find`, `Where`, `Updates`, etc.) over raw SQL.
- Let GORM handle primary key generation — do not use `AUTO_INCREMENT` or `SERIAL` directly.

**When raw SQL is unavoidable:**
- Column quoting differs: PostgreSQL uses `"column"`, MySQL/SQLite uses `` `column` ``.
- Use `commonGroupCol`, `commonKeyCol` variables from `model/main.go` for reserved-word columns like `group` and `key`.
- Boolean values differ: PostgreSQL uses `true`/`false`, MySQL/SQLite uses `1`/`0`. Use `commonTrueVal`/`commonFalseVal`.
- Use `common.UsingPostgreSQL`, `common.UsingSQLite`, `common.UsingMySQL` flags to branch DB-specific logic.

**Forbidden without cross-DB fallback:**
- MySQL-only functions (e.g., `GROUP_CONCAT` without PostgreSQL `STRING_AGG` equivalent)
- PostgreSQL-only operators (e.g., `@>`, `?`, `JSONB` operators)
- `ALTER COLUMN` in SQLite (unsupported — use column-add workaround)
- Database-specific column types without fallback — use `TEXT` instead of `JSONB` for JSON storage

**Migrations:**
- Ensure all migrations work on all three databases.
- For SQLite, use `ALTER TABLE ... ADD COLUMN` instead of `ALTER COLUMN` (see `model/main.go` for patterns).

### Rule 3: Frontend — Prefer Bun

Use `bun` as the preferred package manager and script runner for the frontend (`web/default/` directory):
- `bun install` for dependency installation
- `bun run dev` for development server
- `bun run build` for production build
- `bun run i18n:*` for i18n tooling

### Rule 4: New Channel StreamOptions Support

When implementing a new channel:
- Confirm whether the provider supports `StreamOptions`.
- If supported, add the channel to `streamSupportedChannels`.

### Rule 5: Fork Attribution & Branding Policy (AIKanHub)

This is a fork of [Calcium-Ion/new-api](https://github.com/Calcium-Ion/new-api).
We re-brand the user-facing surface to AIKanHub, but preserve upstream attribution
where AGPL-3.0 requires it. When making changes, follow:

**MUST preserve (legal / AGPL requirements):**
- The `LICENSE` file (AGPL-3.0)
- Per-file copyright headers in source code (`Copyright (c) ... QuantumNous` etc.)
- The `NOTICE.md` upstream attribution
- The Go module path `github.com/QuantumNous/new-api` — internal only, never user-visible.
  Keeping it eases upstream rebases. Do **not** rename it.

**MAY change freely (user-facing branding):**
- README files, HTML titles, meta tags, footer text
- Frontend `package.json` name, dashboard "site name", logos
- Docker image names (we publish as `aikanhub:*`, not `calciumion/new-api:*`)
- Project taglines, descriptions, analytics IDs

**When adding new files:**
- New files in this fork should carry AIKanHub identity (e.g., `aikanhub-*` naming
  in container_name, image tags, env var prefixes if introducing new ones)
- Do not introduce gratuitous references to the upstream project name in new code

If unsure whether a change is "branding" (free to modify) or "license/attribution"
(must preserve), default to keeping upstream notices and ask.

### Rule 6: Upstream Relay Request DTOs — Preserve Explicit Zero Values

For request structs that are parsed from client JSON and then re-marshaled to upstream providers (especially relay/convert paths):

- Optional scalar fields MUST use pointer types with `omitempty` (e.g. `*int`, `*uint`, `*float64`, `*bool`), not non-pointer scalars.
- Semantics MUST be:
  - field absent in client JSON => `nil` => omitted on marshal;
  - field explicitly set to zero/false => non-`nil` pointer => must still be sent upstream.
- Avoid using non-pointer scalars with `omitempty` for optional request parameters, because zero values (`0`, `0.0`, `false`) will be silently dropped during marshal.

### Rule 7: Billing Expression System — Read `pkg/billingexpr/expr.md`

When working on tiered/dynamic billing (expression-based pricing), you MUST read `pkg/billingexpr/expr.md` first. It documents the design philosophy, expression language (variables, functions, examples), full system architecture (editor → storage → pre-consume → settlement → log display), token normalization rules (`p`/`c` auto-exclusion), quota conversion, and expression versioning. All code changes to the billing expression system must follow the patterns described in that document.

### Rule 8: Frontend Theme — Default-Only

Classic frontend has been removed from this fork. `common.GetTheme()` is hardcoded to `"default"` and `common.SetTheme()` is a no-op. When debugging frontend issues:

- **First check**: which bundle is being served? `curl http://host/` and look at the `<script src=...>` path. `/static/js/...` = default; `/assets/...` = classic (should never appear).
- All UI work happens in `web/default/`. The `web/classic/` directory has been deleted; do not re-introduce it.
- New routes go in `web/default/src/routes/<path>/index.tsx` (TanStack Router file-based). After adding a route file, run `cd web/default && bunx --bun @tanstack/router-cli generate` to update `routeTree.gen.ts` (committed to git).

### Rule 9: Verify Before Instructing — Test the UI Path Yourself First

**This is a behavioral rule for AI assistants, not a code rule.**

Before telling the user "click X then Y then Z" in the admin UI, drive that path in a browser yourself (Chrome MCP / Claude in Chrome). The Chinese i18n translations diverge from English Go constants frequently — e.g. `DoubaoVideo` (Go) shows as `豆包视频` (zh.json), so telling a Chinese user to "search DoubaoVideo" sends them down a dead end.

Concrete checks before giving UI instructions:
1. Log in as the relevant role (admin/user) and navigate the actual path.
2. If telling the user to search/filter, try the suggested keyword yourself.
3. If telling them to find a menu item, confirm it exists in the live nav (not just in the source code).
4. Use the API directly (curl + bearer token) when the UI is wonky — see [Rule 10](#rule-10).

Cost of skipping: a 30-second browser test prevents a 30-minute back-and-forth.

### Rule 10: Server Verification — Don't Trust Browser Cache

When verifying that a backend or frontend change took effect, do **not** rely on a single browser screenshot. The browser may serve stale HTML, the bundle may be cached, or the running container may not be the one you just built. Verification ladder:

1. Confirm the running image has your code: `docker inspect <container> --format '{{.Image}}'` and check creation timestamp against your file mtime.
2. Confirm the served bundle includes your change: `curl <host>/<bundle.js> | grep <marker>`. Drop a unique marker string in your code temporarily to make this trivial.
3. Hard-reload the browser (`Cmd+Shift+R`) before screenshotting.
4. For SPA routes that 404, verify the JS bundle has the route registered (search for the route path in the bundle), not just that the HTML shell loads.

### Rule 11: Migration Skip via Schema Hash

`InitDB()` skips `migrateDB()` when `model.computeSchemaHash()` matches the value stored in the `Option` table under key `SchemaMigrationHash`. See `model/schema_hash.go`.

This makes restarts on remote DBs (Neon) drop from ~90s to ~11s. Implications:

- **When you add a model to AutoMigrate**: also add it to `migrateModels()` in `model/schema_hash.go`. Forgetting causes the new model's table/columns to be missing on next boot.
- **When you change a model's struct fields or `gorm:` tags**: the reflection-based hash will change automatically and trigger a fresh migration.
- **Limitation**: only walks one level of struct fields. If you change a field inside an embedded type (e.g. `ChannelInfo`'s internals when `Channel` embeds it), the hash won't change. Force a re-migrate via `SKIP_AUTO_MIGRATION_HASH_CHECK=true` for one boot.
- **Override env vars**:
  - `FORCE_SKIP_AUTO_MIGRATION=true` — never run, ops-managed migration
  - `SKIP_AUTO_MIGRATION_HASH_CHECK=true` — always run (escape hatch when hash logic itself is suspected broken)

### Rule 12: Don't Switch Infrastructure Without Permission

When the user has explicitly chosen a setup (e.g. Neon Postgres, R2, etc.), don't unilaterally swap it for "something faster" or "easier to debug". The user's setup choice usually reflects production parity, billing, or other constraints not visible to the AI assistant. Switching:

- Loses data (admin sessions, test users, preconfigured channels)
- Hides bugs that only show on the chosen infra
- Wastes user trust

If a slow-iteration problem comes up (Neon migration latency, etc.), solve it on the chosen stack — see Rule 11. Don't propose a stack swap until the on-stack solution is exhausted and the user explicitly OKs it.

### Rule 13: Docker Build Hygiene

The Dockerfile uses BuildKit cache mounts (`--mount=type=cache`) for `bun install`, `go mod download`, and `go build`. Maintain these patterns:

- A bare `bun install` step without the cache mount will re-download all packages on every build (slow + wasteful)
- Adding a top-level dir without it appearing in `.dockerignore` will balloon the build context. Always check what's in the context: a build context > 100 MB warrants investigation.
- The classic frontend stage has been dropped. Do not add it back.

### Rule 14: Always Update This File After a Bug Fix

When a fix lands a non-obvious correctness or workflow lesson — something a future change could re-break — append a short rule to this file in the same PR. Examples of what triggers a CLAUDE.md update:

- A frontend change broke because of a server-side flag (Rule 8)
- A debugging session revealed an undocumented invariant (Rule 11)
- A user pointed out a behavioral mistake (Rule 9, Rule 12)

The rule should state the constraint, not retell the bug story. Keep it under 200 words.
