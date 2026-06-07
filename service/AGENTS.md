# service/ — Business Logic

## Overview
56 service files. Core domains: Quota, Billing, Channel selection, Token counting.

## Where to Look
| Task | Location | Notes |
|---|---|---|
| Quota | `quota.go` | PreConsumeTokenQuota, PostConsumeQuota |
| Billing | `billing.go` | PreConsumeBilling, SettleBilling |
| Tiered settle | `tiered_settle.go` | 830 lines, 6 benchmarks |
| Channel affinity | `channel_affinity.go` / `channel_selector.go` | |
| Token counter | `token_counter.go` | |

## Conventions
- Services call Models for persistence.
- Quota/billing flows are sensitive — follow expr.md patterns.

## Anti-Patterns
- Do NOT bypass Service layer in Controllers for business logic.
