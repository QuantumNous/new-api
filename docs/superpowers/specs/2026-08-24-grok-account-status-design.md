# Grok account status and quota visibility

## Goal

Make Grok Subscription quota probing match the upstream CLI contract and give administrators a safe, Codex-like account information view for a Grok channel.

## Scope and decisions

- CLI billing paths include `/v1`: `/v1/billing` and `/v1/billing?format=credits`.
- Billing parsing accepts the observed CLI payload shapes: fields nested under `config`, numeric `{"val": ...}` wrappers, and top-level or nested plan/subscription names. Explicit known paid tiers are authoritative; explicit Free/Basic tiers still deny media.
- A billing probe may perform one best-effort `/v1/user?include=subscription` lookup when billing payloads do not identify a plan or tier. A failed tier lookup never grants media eligibility and does not discard an otherwise valid billing snapshot.
- The channel table's existing balance click affordance becomes `Account Info` for Grok type 113. The initial view is read-only and uses a new admin-only status endpoint backed by a whitelist projection of persisted state.
- The status endpoint exposes auth status, plan/tier, observation/refresh timestamps, and only the four numeric/status fields needed from each persisted billing window. It never exposes Channel.Key, tokens, lease fields, LastError, or the raw quota snapshot.
- The dialog has an explicit Refresh button that calls the existing Grok refresh endpoint, then reloads the read-only status projection. No media generation or client-side retry is introduced.

## Data flow

1. `ProbeBilling` calls the two `/v1/billing` windows with existing CLI OAuth headers.
2. If both plan and tier are empty, it calls `/v1/user?include=subscription`; a non-empty `subscriptionTier` becomes the snapshot tier.
3. The persisted billing snapshot remains private. `GET /api/channel/grok/status/:id` parses it into a safe DTO.
4. The frontend opens the DTO in `GrokAccountInfoDialog`. Refresh uses the existing POST refresh flow and then fetches the DTO again.

## Error and security behavior

- Billing endpoint URL construction is tested exactly, including query strings and CLI headers.
- Malformed or oversized billing responses continue to fail closed as before.
- Missing state is represented as pending/empty status, not a server error.
- Status endpoint validates channel type and requires admin authentication.
- Any unknown or malformed persisted quota JSON is omitted from the response rather than returned raw.

## Verification

- Go unit tests cover URL/header construction, subscription tier fallback, safe status projection, and route handler behavior.
- Frontend tests cover quota percentage boundaries, missing data, timestamps, and auth-state formatting.
- Run targeted Go tests, frontend typecheck/lint/tests, then the relevant full packages.
