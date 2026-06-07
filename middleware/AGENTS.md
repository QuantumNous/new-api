# middleware/ — Cross-Cutting Concerns

## Overview
24 middleware files: auth, rate limiting, CORS, distributor, logging.

## Where to Look
| Task | Location |
|---|---|
| Auth role gates | `auth.go` | User / Admin / Root + TokenAuth + TokenOrUserAuth + TokenAuthReadOnly |
| Rate limiting (6 tiers) | `rate_limit.go` | Redis + InMemory backends |
| Distributor | `distributor.go` | Channel selection with affinity + weighted random |
| Custom RouteTag | `route_tag.go` | Per-route metadata injection |

## Conventions
- Auth middleware sets context keys consumed by controllers.
- Rate limiter keys combine user ID + route tag.

## Anti-Patterns
- Do NOT bypass auth middleware in new routes.
