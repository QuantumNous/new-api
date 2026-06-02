# STACK — Atius AI Router

> Technology stack and dependencies for the Atius AI Router project.
> Project root: `/home/ubuntu/docker/Atius/router-ai-atius`
> Go AI API gateway aggregating 40+ upstream AI providers behind a unified API.
> Last updated: 2026-06-02.

---

## Overview

Atius AI Router is a Go-based AI API gateway with a React admin dashboard.
It proxies requests to 40+ upstream AI providers (OpenAI, Claude, Gemini,
Azure, AWS Bedrock, etc.) through a unified API surface, with user management,
billing, rate limiting, and multi-tenant administration.

---

## Backend — Go

### Language and Version

- **Go**: `1.25.1` (declared in `go.mod`, Dockerfile uses `golang:1.26.1-alpine`)
- Minimum supported: **Go 1.22+**
- CGO disabled in production build (`CGO_ENABLED=0`)

### Web Framework

- **Gin** (`github.com/gin-gonic/gin` v1.9.1) — HTTP router and middleware framework
- **gin-contrib**: cors, gzip, sessions, static serving

### ORM

- **GORM v2** (`gorm.io/gorm` v1.25.2)
- Drivers:
  - `gorm.io/driver/postgres` v1.5.2 — PostgreSQL
  - `gorm.io/driver/mysql` v1.4.3 — MySQL
  - `glebarez/sqlite` v1.9.0 — SQLite (pure-Go, no CGO)
- All three databases must work simultaneously; see `AGENTS.md` Rule 2 for
  cross-DB compatibility rules.

### Database Drivers

| Driver | Package | Notes |
|--------|---------|-------|
| PostgreSQL | `gorm.io/driver/postgres` | Primary for production |
| MySQL | `gorm.io/driver/mysql` | Supported |
| SQLite | `glebarez/sqlite` | Development / embedded |

### Authentication

| Method | Package | Purpose |
|--------|---------|---------|
| JWT | `golang-jwt/jwt/v5` v5.3.0 | Stateless session tokens |
| WebAuthn / Passkeys | `go-webauthn/webauthn` v0.14.0 | FIDO2 credential management |
| OAuth | `golang.org/x/oauth2` (implied by GitHub, Discord, OIDC providers) | SSO via external identity providers |

### Key Backend Dependencies

```
github.com/gin-gonic/gin              v1.9.1         HTTP framework
gorm.io/gorm                          v1.25.2         ORM
gorm.io/driver/postgres               v1.5.2         PostgreSQL driver
gorm.io/driver/mysql                  v1.4.3         MySQL driver
github.com/glebarez/sqlite            v1.9.0         SQLite driver
github.com/golang-jwt/jwt/v5          v5.3.0         JWT auth
github.com/go-webauthn/webauthn        v0.14.0        WebAuthn / Passkeys
github.com/gin-contrib/cors            v1.7.2         CORS headers
github.com/gin-contrib/gzip            v0.0.6         Compression
github.com/gin-contrib/sessions        v0.0.5         Session management
github.com/go-redis/redis/v8          v8.11.5         Redis client
github.com/aws/aws-sdk-go-v2          v1.41.5         AWS / Bedrock
github.com/pquerna/otp                v1.5.0         TOTP / HOTP
github.com/stripe/stripe-go/v81       v81.4.0         Billing / payments
github.com/gorilla/websocket          v1.5.0         WebSocket upgrade
github.com/google/uuid                v1.6.0         UUID generation
github.com/joho/godotenv             v1.5.1         .env loading
golang.org/x/crypto                   v0.45.0         Cryptography utilities
github.com/tiktoken-go/tokenizer       v0.6.2         Token counting
github.com/expr-lang/expr             v1.17.8         Expression evaluator (billing)
```

### Middleware

- **Auth** — JWT validation, WebAuthn session
- **Rate limiting** — per-user, per-channel, token-bucket
- **CORS** — configurable origins, methods, headers
- **Logging** — request/response logging with tracing
- **Distribution** — session distribution, load balancing hints

### Caching

- **Redis** (`go-redis/redis/v8`) — distributed cache, rate limit counters,
  session store
- **In-memory cache** — hot paths, local fallback

### Build

- **Builder image**: `golang:1.26.1-alpine`
- **Output binary**: `new-api` (Go module name: `github.com/QuantumNous/new-api`)
- **Static assets**: Frontend builds embedded at `web/default/dist` and
  `web/classic/dist` (copied from Bun build stage)
- **Binary entrypoint**: `/new-api` in final image

---

## Frontend — React

### Default Theme (`web/default/`)

Modern React 19 dashboard. Built with Rsbuild.

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | ^19.2.6 |
| Language | TypeScript | ~6.0.3 |
| Bundler | Rsbuild (`@rsbuild/core`) | ^2.0.7 |
| UI Library | Base UI (`@base-ui/react`) | ^1.5.0 |
| Styling | Tailwind CSS v4 | ^4.3.0 |
| Icons | Hugeicons (`@hugeicons/react`) | ^1.1.6 |
| State (server) | TanStack Query (`@tanstack/react-query`) | ^5.100.14 |
| State (client) | Zustand | ^5.0.13 |
| Routing | TanStack Router | ^1.170.8 |
| Forms | React Hook Form + Zod | ^7.76.1 / ^4.4.3 |
| Tables | TanStack Table | ^8.21.3 |
| Virtual lists | TanStack Virtual | ^3.13.25 |
| Charts | VisActor (`@visactor/react-vchart`) | ^2.0.22 |
| i18n | i18next + react-i18next | ^26.2.0 / ^17.0.8 |
| HTTP | Axios | ^1.16.1 |
| Markdown | react-markdown + remark-gfm | ^10.1.0 / ^4.0.1 |
| Testing | Vitest | ^3.2.4 |
| Package manager | Bun | (lock file: `bun.lock`) |

Scripts (`web/default/package.json`):

```json
{
  "dev":        "rsbuild dev",
  "build":      "rsbuild build",
  "build:check":"tsc -b && rsbuild build",
  "typecheck": "tsc -b",
  "lint":       "eslint .",
  "test":       "vitest run",
  "format":     "prettier --write .",
  "i18n:sync":  "node scripts/sync-i18n.mjs"
}
```

### Classic Theme (`web/classic/`)

Legacy React 18 dashboard. Built with Vite. Semi Design UI kit.

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | ^18.2.0 |
| Language | TypeScript | 4.4.2 |
| Bundler | Vite | ^5.2.0 |
| UI Library | Douyin Semi Design (`@douyinfe/semi-ui`) | ^2.69.1 |
| Styling | Tailwind CSS v3 | ^3 |
| i18n | i18next | ^23.16.8 |
| Routing | React Router DOM | ^6.3.0 |
| Charts | VisActor | ~1.8.8 |
| Package manager | Bun | (lock file: `bun.lock`) |

---

## Frontend Architecture

```
web/
  default/           # React 19 + Rsbuild + Base UI + Tailwind v4 (modern)
    dist/            # Production build output (embedded in Go binary)
    src/
      features/      # Feature-scoped components, hooks, api, lib
      components/    # Shared UI components
      stores/        # Zustand stores
      routes/        # TanStack Router file-based routes
      styles/        # Global CSS, Tailwind config
      i18n/          # i18next config + locales/
  classic/           # React 18 + Vite + Semi Design (legacy)
    dist/            # Production build output
```

### Default Theme — Key Libraries

- **State management**: Zustand (local/client state) + TanStack Query
  (server state with cache, optimistic updates, background refetch)
- **Routing**: TanStack Router with file-based route definitions,
  `beforeLoad` hooks for auth guards, Zod-validated search params
- **Forms**: React Hook Form + Zod resolver; field-level error mapping
- **i18n**: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
  Supported locales: `en` (base), `zh` (fallback), `fr`, `ru`, `ja`, `vi`
- **Auth in UI**: React Context / Zustand store; JWT in Authorization header;
  WebAuthn via `navigator.credentials`
- **Styling**: Tailwind CSS utility classes + `cn()` helper (`clsx` +
  `tailwind-merge`); CSS variables for theming; `dark:` variants;
  Base UI for accessible component primitives

---

## Container / Build

### Dockerfile (production)

```
Stage: builder (Bun)        → builds web/default/  → dist/
Stage: builder-classic (Bun)→ builds web/classic/   → dist/
Stage: builder2 (Go)        → compiles Go binary, embeds dist/ dirs
Stage: final (debian:bookworm-slim) → runtime image
```

- **Runtime base**: `debian:bookworm-slim`
- **Exposed port**: `3000`
- **Binary**: `/new-api` (entrypoint)
- **Static assets**: embedded by Go at build time (no separate CDN)
- **Go version in build**: `golang:1.26.1-alpine`
- ** Bun version in build**: `oven/bun:1`

### Dockerfiles available

| File | Purpose |
|------|---------|
| `Dockerfile` | Production multi-stage build (Go + Bun) |
| `Dockerfile.dev` | Development build with live reload |
| `Dockerfile.fastapi` | FastAPI-related service (not core gateway) |
| `integration/middleware/Dockerfile.fastapi` | Middleware service container |

---

## Supported Upstream Providers

40+ providers via `relay/channel/` adapters. Key adapter categories:

- `openai/` — OpenAI-compatible (OpenAI, Azure OpenAI, custom endpoints)
- `claude/` — Anthropic Claude via AWS Bedrock or direct
- `gemini/` — Google Gemini
- `aws/` — AWS Bedrock (Claude, Llama, Mistral, Stable Diffusion, etc.)
- `github/` — GitHub Models
- Plus: Groq, Mistral, Cohere, Replicate, Perplexity, and more

Each channel adapter normalizes request/response formats to a unified internal
schema.

---

## Architecture Pattern

```
router/          HTTP routing (API, relay, dashboard, web)
controller/      Request handlers (Gin handlers)
service/         Business logic (channels, billing, auth)
model/           GORM models and DB access
relay/           AI provider proxy with channel adapters
  channel/      Provider-specific adapters
middleware/      Auth, rate limiting, CORS, logging
setting/         Configuration (ratio, model, operation, system)
common/          Utilities (JSON, crypto, Redis, env, rate-limit)
dto/             Request/response structs
constant/        Constants (API types, channel types, context keys)
types/           Type definitions (relay formats, file sources, errors)
i18n/            Backend i18n (go-i18n, en/zh)
oauth/           OAuth provider implementations
web/             Frontend themes
  default/       Modern React 19 dashboard
  classic/       Legacy React 18 dashboard
```

---

## i18n

### Backend

- Library: `nicksnyder/go-i18n/v2`
- Languages: `en`, `zh`

### Frontend (Default)

- Library: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Languages: `en` (base), `zh` (fallback), `fr`, `ru`, `ja`, `vi`
- Locale files: `web/default/src/i18n/locales/{lang}.json`
- Sync: `bun run i18n:sync` from `web/default/`

---

## Important Project Rules (from AGENTS.md)

1. **JSON** — Use `common/json.go` wrappers; never call `encoding/json` directly.
2. **Database** — Must work on SQLite, MySQL >= 5.7.8, and PostgreSQL >= 9.6
   simultaneously. Use GORM abstractions; branch on
   `common.UsingPostgreSQL` / `common.UsingSQLite` / `common.UsingMySQL` for
   unavoidable raw-SQL differences.
3. **Frontend package manager** — Use Bun (`bun install`, `bun run dev`, etc.).
4. **StreamOptions** — New channel adapters must declare whether the provider
   supports streaming; add to `streamSupportedChannels` if yes.
5. **Protected identifiers** — References to `nеw-аρi` and `QuаntumΝоuѕ` must
   never be removed or replaced.
6. **Relay DTOs** — Optional scalar fields must use pointer types with
   `omitempty`; explicit zero values must not be dropped during marshal.
7. **Billing expressions** — See `pkg/billingexpr/expr.md` before modifying
   expression-based pricing.

---

## Environment and Config

- `.env` file loaded via `godotenv`
- Redis connection for caching and rate limiting
- Database connection string via env (supports all three DBs)
- JWT secret, WebAuthn relying party config, OAuth credentials via env
- Version injected at build time: `-X 'github.com/QuantumNous/new-api/common.Version=...'`

---

## Quick Reference — Key Package Versions

| Package | Version |
|---------|---------|
| Go | 1.25.1 (build: 1.26.1) |
| Gin | 1.9.1 |
| GORM | 1.25.2 |
| React (default) | 19.2.6 |
| React (classic) | 18.2.0 |
| TypeScript | ~6.0.3 |
| Rsbuild | 2.0.7 |
| Tailwind CSS | 4.3.0 |
| Zustand | 5.0.13 |
| TanStack Query | 5.100.14 |
| TanStack Router | 1.170.8 |
| Bun | 1.x |
| jwt-go | 5.3.0 |
| go-webauthn | 0.14.0 |
| go-redis | 8.11.5 |
| stripe-go | 81.4.0 |
| aws-sdk-go-v2 | 1.41.5 |
