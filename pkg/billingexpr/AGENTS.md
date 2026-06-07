# pkg/billingexpr/ — Billing Expression System

## Overview
Expression-based tiered/dynamic pricing. Editor → storage → pre-consume → settlement → log display.

## Where to Look
| Task | File |
|---|---|
| Design spec | `expr.md` (MUST read first per Rule 7) |
| Expression parser/evaluator | `expr.go`, `value.go` |
| Tests (56 tests, 1094 lines) | `*_test.go` |

## Conventions
- Token normalization rules (`p`/`c` auto-exclusion).
- Quota conversion follows documented patterns.
- Expression versioning supported.

## Anti-Patterns
- Do NOT change billing logic without reading `expr.md` first.
