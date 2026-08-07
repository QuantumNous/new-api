# API Key Model Access Review Fixes Design

## Goal

Close the three confirmed PR #657 review gaps without changing established API-key routing compatibility or account-wide statistics semantics.

## Scope

The change covers:

1. Batch updates that invalidate token authorization caches must fail closed when Redis cleanup is uncertain.
2. Batch allowlist and blacklist strings must be normalized and bounded before persistence.
3. Batch model-rule controls must remain unavailable until model-access data has loaded successfully, while group-only and quota-only edits remain usable.

The change does not alter the historical `specific_channel_id` allowlist bypass, account-wide stats under filters, search routing, or the unused preview-copy helper.

## Cache Safety Protocol

Authorization-sensitive batch updates (quota, allowlist, or blacklist) use a per-token Redis pending marker keyed by the HMAC token cache identity. Before the database transaction writes any policy, one atomic Lua script rotates the global fill fence, writes bounded-TTL pending markers, and deletes existing token hashes. If this preparation fails, the database transaction does not run.

Cache reads check the pending marker in the same Lua call that validates a token hash. A pending marker returns a dedicated sentinel error. `GetTokenByKey` propagates that sentinel without falling back to the database and without scheduling a refill. Ordinary Redis misses and failures retain their existing database fallback behavior.

After a successful database commit, a second atomic script rotates the fence, deletes token hashes again, and removes only markers owned by the current update guard. If this cleanup fails, the marker remains and authentication stays fail-closed until a retry succeeds or the marker expires. The marker TTL exceeds the normal token-cache TTL. If the database transaction fails after preparation, a best-effort release uses the same guarded cleanup; release failure remains safe because the marker expires.

## Model Rule Normalization

The model layer normalizes each enabled comma-separated list before opening the transaction:

- split on commas;
- trim surrounding whitespace;
- remove empty entries;
- preserve first occurrence order while removing duplicates;
- reject more than 512 entries;
- reject a normalized serialized value larger than 32 KiB.

Disabled rules are stored with an empty list. Invalid input returns the existing stable batch-validation error and performs no database write.

## Frontend Readiness Gate

The batch dialog considers model access ready only when the query succeeded and returned data. Until then, allowlist and blacklist update checkboxes and their nested controls are disabled. Loading and error states explain why model-rule editing is unavailable, and the error state provides a retry action.

Submission also checks readiness independently of disabled controls. A stale UI event therefore cannot send model-rule fields while data is unavailable. Group and quota edits remain valid and submit normally.

## Verification

Backend regression tests cover pending reads, stale-fill fencing, prepare failure, commit-cleanup failure, retry cleanup, normalization, and bounds. Frontend unit tests cover the readiness predicate, and type checking/linting verify the component wiring. Existing compatibility tests remain unchanged.
