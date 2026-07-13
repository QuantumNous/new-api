# router/ — HTTP Routing

## Overview
6 files wiring all HTTP routes. `SetRouter()` is the single entry point called from `main.go`, dispatching to 5 sub-routers.

## Structure
```
router/
├── main.go           # SetRouter() — dispatches to 5 sub-routers
├── api-router.go     # Dashboard/API routes (users, channels, tokens, logs, settings)
├── dashboard.go      # Dashboard-specific endpoints (/api/data, /api/stat)
├── relay-router.go   # AI relay/proxy routes (/v1/chat/completions, /v1/messages, etc.)
├── video-router.go   # Video generation routes (/v1/videos, async task polling)
└── web-router.go     # Frontend static file serving + SPA fallback
```

## Where to Look
| Task | Location |
|---|---|
| Add dashboard API endpoint | `api-router.go` — find the resource group, add route |
| Add relay endpoint | `relay-router.go` — add path + handler |
| Add video generation route | `video-router.go` |
| Change SPA fallback behavior | `web-router.go` |
| CORS / middleware ordering | `main.go` — middleware chain setup |

## Conventions
- Routes are registered via Gin router groups: `apiGroup`, `relayRouter`, `dashboardRouter`, etc.
- Auth middleware applied at group level: `apiGroup.Use(middleware.UserAuth())`, `relayRouter.Use(middleware.TokenAuth())`.
- Relay routes follow OpenAI-compatible paths: `/v1/chat/completions`, `/v1/embeddings`, `/v1/images/generations`, etc.
- Dashboard routes under `/api/` prefix.
- Frontend SPA fallback: all unmatched routes serve `index.html` (web-router.go).

## Anti-Patterns
- Do NOT add routes without appropriate auth middleware — use `middleware.UserAuth()`, `middleware.AdminAuth()`, `middleware.RootAuth()`, or `middleware.TokenAuth()` as appropriate.
- Do NOT register routes outside of the `Set*Router()` functions.
- Do NOT change `/v1/` relay paths without updating provider adapters — these are the client-facing API contract.
