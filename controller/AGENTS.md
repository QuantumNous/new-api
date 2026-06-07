# controller/ — HTTP Request Handlers

## Overview
73 handler files bridging Router → Service/Model. Uses Gin context + common API helpers.

## Where to Look
| Task | Location | Notes |
|---|---|---|
| Channel CRUD | `channel.go` (1978 lines) | Large file, models fetch, upstream sync |
| User mgmt | `user.go` (1296 lines) | |
| Billing | `channel-billing.go` | Dashboard billing endpoints |
| Video proxy | `video_proxy.go` | |
| OAuth | `oauth_*.go` | GitHub, Discord, OIDC callbacks |

## Conventions
- Handlers are PascalCase (`UpdateChannel`, `GetUserStats`).
- Use `common.ApiError` / `common.ApiSuccess` / `common.ApiErrorI18n` helpers.
- `GetContextKeyType[T]` generics for type-safe context retrieval.

## Anti-Patterns
- Blurring Controller→Service→Model chain is common here (handlers call both Service and Model directly).
- Do NOT add handlers without using `common.ApiError` / `common.ApiSuccess` helpers.
