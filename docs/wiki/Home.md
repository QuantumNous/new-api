# DeepRouter Wiki

OpenAI-compatible multi-tenant LLM gateway. Fork of [QuantumNous/new-api](https://github.com/QuantumNous/new-api) (AGPL v3).

## Quick links

| | |
|---|---|
| **Repo** | [deeprouter-ai/deeprouter](https://github.com/deeprouter-ai/deeprouter) |
| **Smart Router** | [deeprouter-ai/smart-router](https://github.com/deeprouter-ai/smart-router) |
| **Sprint board** | Linear — Sprint 1 (5 Jun – 19 Jun 2026) |
| **Local dev** | `docker compose -f docker-compose.dev.yml up -d --build new-api` → http://localhost:3000 |

## What DeepRouter adds on top of upstream

| Package | What it does |
|---------|-------------|
| `internal/policy/` | Per-tenant policy decision engine. `DecisionFor(kidsMode, profile) → Decision` |
| `internal/kids/` | Kids mode hard constraints: model whitelist, metadata strip, OpenAI ZDR, child-safe system prompt |
| `internal/billing/` | HMAC-signed per-request billing webhook dispatcher (Phase 2, not yet wired) |
| `internal/smart_router_client/` | HTTP client for the smart-router sidecar |
| `relay/airbotix_policy.go` | Stitches policy enforcement into every relay handler |

## Team

| Handle | Role |
|--------|------|
| PW (pjwan2) | CTO / lead engineer |

## Pages

- [Sprint 1 Progress](Sprint-1-Progress)
- [Architecture Decisions](Architecture-Decisions)
- [Bug Log](Bug-Log)
- [Dev Setup](Dev-Setup)
