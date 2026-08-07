# API Key Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the confirmed PR #657 authorization-cache, model-rule validation, and batch-dialog readiness findings.

**Architecture:** Add a guarded per-token Redis pending state around authorization-sensitive batch writes, normalize model lists at the model boundary, and centralize the frontend readiness predicate in the batch-edit library. Preserve existing compatibility contracts outside these three findings.

**Tech Stack:** Go, GORM, Redis Lua, miniredis, React, TanStack Query, TypeScript, Bun.

---

### Task 1: Fail-closed token permission cache updates

**Files:**
- Modify: `model/token_cache.go`
- Modify: `model/token.go`
- Test: `model/token_cache_test.go`
- Test: `controller/token_test.go`

- [ ] Add failing cache tests proving a pending marker rejects a cached token without DB fallback and blocks a stale fill.
- [ ] Add a failing controller test proving final cleanup failure leaves the committed token inaccessible and a retry clears the pending state.
- [ ] Run `go test ./model -run 'TestTokenCachePermissionUpdate|TestGetTokenByKeyRejectsPendingPermissionUpdate' -count=1` and the targeted controller test; confirm failures are caused by missing pending-marker behavior.
- [ ] Add guarded prepare/finalize Lua scripts, marker helpers, and a dedicated sentinel error.
- [ ] Wrap authorization-sensitive `BatchUpdateTokens` writes with prepare, transaction, guarded release/finalize, and stable error handling.
- [ ] Re-run both targeted suites and confirm they pass.

### Task 2: Normalize and bound batch model rules

**Files:**
- Modify: `model/token.go`
- Test: `model/token_validation_test.go`
- Test: `controller/token_test.go`

- [ ] Add failing tests for trim, empty removal, stable deduplication, 513-item rejection, and normalized values over 32 KiB.
- [ ] Run `go test ./model -run 'TestNormalizeBatchTokenModelRules|TestBatchUpdateTokensRejectsOversizedModelRules' -count=1`; confirm expected failures.
- [ ] Implement a focused normalization helper and apply it before the transaction for both enabled model lists.
- [ ] Re-run model tests plus batch controller tests and confirm they pass.

### Task 3: Gate frontend model-rule batch edits on loaded access data

**Files:**
- Modify: `web/default/src/features/keys/lib/api-key-batch-group.ts`
- Modify: `web/default/src/features/keys/lib/api-key-batch-group.test.ts`
- Modify: `web/default/src/features/keys/components/api-keys-batch-group-dialog.tsx`

- [ ] Add a failing unit test for the readiness predicate: model edits require ready data, while group/quota-only edits do not.
- [ ] Run `bun test src/features/keys/lib/api-key-batch-group.test.ts` from `web/default`; confirm the missing export failure.
- [ ] Implement the predicate, disable model-rule controls while unavailable, guard submit, and render loading/error retry feedback.
- [ ] Re-run the unit test, targeted ESLint, and TypeScript typecheck.

### Task 4: PR verification and delivery

**Files:**
- Verify all modified files and PR metadata.

- [ ] Run targeted model, controller, middleware, and frontend key tests.
- [ ] Run `bun run typecheck`, targeted ESLint, `gofmt`, and `git diff --check`.
- [ ] Review the complete diff against the design and confirm excluded compatibility behavior is unchanged.
- [ ] Commit with Lore trailers, push `feat/api-key-model-blacklist`, reply to the PR review thread with fixed and reasoned-not-changed items, and verify PR #657 remains mergeable.
