# Sprint 1 Progress

**Dates:** 5 Jun – 19 Jun 2026  
**Goal:** e2e relay working with `kids_mode` enforcement, staging deployed

## Ticket status

| Ticket | Title | Status | PR | Notes |
|--------|-------|--------|----|-------|
| DR-6 | `internal/billing` webhook dispatcher | ✅ Done | merged in main | Code + tests. Not wired into relay (Phase 2). |
| DR-7 | `internal/kids` hard constraints | ✅ Done | merged in main | Whitelist, ZDR, metadata strip, child-safe prompt. |
| DR-8 | `internal/policy` decision engine | ✅ Done | merged in main | `DecisionFor()` pure function + profile tests. |
| DR-9 | e2e: same endpoint, different key → different policy | 🟡 In Review | [fix/policy-before-model-mapping](https://github.com/deeprouter-ai/deeprouter/pull/new/fix/policy-before-model-mapping) | chat path fixed + verified. claude/responses/gemini handlers need same fix before merge. |
| DR-13 | Quota check RPM/TPM + staging deploy | ⏳ Not started | — | Next ticket. |

## What was verified (DR-9 e2e)

Three test cases against local dev stack (Groq channel, `gpt-4o-mini` → `llama-3.1-8b-instant` mapping):

| # | Key type | Model sent | Expected | Result |
|---|----------|------------|----------|--------|
| 1 | Root (passthrough) | `llama-3.1-8b-instant` | 200 ✅ | ✅ |
| 2 | Kids key | `llama-3.1-8b-instant` (not whitelisted) | 400 ❌ blocked | ✅ |
| 3 | Kids key | `gpt-4o-mini` (whitelisted, maps to llama) | 200 ✅ | ✅ |

## Bug found and fixed during Sprint 1

**Policy ordering bug** (`relay/compatible_handler.go`)

- **Symptom:** Kids key requesting `gpt-4o-mini` was blocked even though it's on the whitelist.
- **Root cause:** `ModelMappedHelper` ran first, renaming `gpt-4o-mini` → `llama-3.1-8b-instant`. The whitelist check then saw the upstream name (not whitelisted) and blocked the request.
- **Fix:** Moved `applyAirbotixPolicy` call to before `ModelMappedHelper` so whitelist always evaluates the client-requested model name.
- **Same bug still exists in:** `claude_handler.go`, `responses_handler.go`, `gemini_handler.go` — fix pending.

## PRs merged this sprint

| PR | Title | Date |
|----|-------|------|
| [#21](https://github.com/deeprouter-ai/deeprouter/pull/21) | fix(default): render header wordmark as text so brand name never drops | 2026-06-07 |
