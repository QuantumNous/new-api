# Combo Feature — Multi-Model Routing

> **Date**: 2026-06-11
> **Status**: Phase 1 complete (backend CRUD)

## Concept

A **Combo** bundles multiple models with a routing strategy into a named configuration.
Users send requests to a combo (via `model: "combo:my-combo"`), and the system resolves
which model(s) to use based on the strategy, then routes through the existing channel
selection layer.

---

## Data Model

| Field | Type | Description |
|---|---|---|
| `id` | `int` (PK, auto-increment) | |
| `name` | `varchar(128)` unique | Combo identifier, used as `combo:<name>` in requests |
| `user_id` | `int` | Creator / owner |
| `models` | `text` | CSV — `"gpt-4,claude-3,gemini-pro"` |
| `strategy` | `varchar(32)` | `fallback` / `random` / `weighted` / `round_robin` |
| `weights` | `text` | JSON map for weighted: `{"gpt-4":3,"claude-3":2}` |
| `status` | `int` (0/1) | 1 = enabled |
| `created_time` | `bigint` | Unix timestamp |

---

## Routing Strategies

| Strategy | Behaviour |
|---|---|
| `fallback` | Iterate models in order → pick first that has an available channel |
| `random` | Uniform random selection from the model list |
| `weighted` | Weighted random using `weights` JSON |
| `round_robin` | Atomic counter → cycling through models evenly |

---

## Phases

- **Phase 1** ✅ — Backend CRUD + DB migration
- **Phase 2** — Routing integration in `middleware/distributor.go`
- **Phase 3** — Frontend management UI
- **Phase 4** — Advanced (parallel, billing, sharing)

---

## Key Files

| Layer | File |
|---|---|
| Model | `model/combo.go` |
| Migration | `model/main.go` |
| Controller | `controller/combo.go` |
| Routes | `router/api-router.go` |
| Service | `service/combo_routing.go` |
| Context keys | `constant/context_key.go` |
| Frontend feature | `web/default/src/features/combos/` |
| i18n | `web/default/src/i18n/locales/*.json` |
