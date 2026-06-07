# common/ — Shared Utilities

## Overview
47-file utility belt used across the entire backend.

## Where to Look
| Task | Location |
|---|---|
| JSON wrappers (Rule 1) | `json.go` |
| Redis wrappers | `redis.go` |
| SSRF protection | `ssrf_protection.go` |
| HMAC/bcrypt crypto | `crypto.go` |
| Body storage (memory/disk spillover) | `body_storage.go` |
| Rate limiting (in-memory sliding window) | `rate-limit.go` |
| PII masking | `str.go` (MaskSensitiveInfo) |
| Global mutable state | `init.go` + `constants.go` |

## Conventions
- `json.go` wrappers MUST be used instead of direct `encoding/json` calls.
- `body_storage.go` auto-spills large requests to disk.
- `init.go` populates global state from env vars.

## Anti-Patterns
- Do NOT call `encoding/json` directly in business code.
