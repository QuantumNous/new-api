# Codex v0.1.178 Identity Risk Controls Design

**Status:** Approved scope

## Goal

Port the Codex OAuth identity-risk changes that landed in Sub2 `v0.1.178` into Flatkey without importing account scheduling, capacity failover, quota routing, or unrelated provider behavior.

The behavioral source of truth is limited to these Sub2 commits:

- `6793d5ac8` — system-managed per-account fingerprint seed and internally consistent converged IDs.
- `bb6c3b4f6` — one outbound identity resolver for Codex inference and credential-adjacent paths.
- `a34123959` — real-client auth header shape and model-manifest version consistency.

The later `forever94yu/sub2api` fork is reference evidence, not a source of
truth. Its frontend new-create default is useful, but its deterministic
full-mode turn/time values, unconditional non-empty `prompt_cache_key` rewrite,
and legacy edit defaulting are intentionally not copied.

## Non-goals

- Account selection, weights, sticky sessions, concurrency slots, or account pools.
- 429/529 cooldown scheduling, capacity shedding, request-level account failover, or quota auto-pause.
- WebSocket pool scheduling or connection prewarming.
- Model governance, alerting, model enable/disable workflows, or upstream model lifecycle management.
- Inbound official-client allowlists, blocklists, or engine-fingerprint access gates.
- OAuth refresh-lock redesign.
- Claude `X-Stainless-*` unification, Anthropic TLS fingerprints, or provider-neutral fingerprint systems.

The six-hour official-version updater is in scope because it maintains outbound client identity. It does not select accounts or route requests.

## Existing Flatkey Baseline

Flatkey already supports channel-level `off/device/session/full` convergence and stages one ID set across body/header mutation and retry attempts. The current stable seed includes `ChannelId`, downstream `UserId`, and downstream `TokenId`. That makes one upstream subscription appear as multiple devices when used by different Flatkey consumers.

Flatkey also has an official Codex release lookup for model discovery, but ordinary inference requests do not currently receive a canonical, mutually consistent `User-Agent`, `originator`, and `version` identity.

## Design

### 1. System-managed channel seed

Add a persisted `codex_fingerprint_seed` property owned only by the server. In Flatkey, one Codex channel is the equivalent of one Sub2 upstream account, so the seed belongs to the channel rather than a downstream user or token.

The seed is stored in a dedicated hidden channel column rather than the public `setting` JSON. The column is excluded from JSON responses and logs. This avoids exposing the seed through channel forms and makes preservation independent of full-setting replacement.

Lifecycle rules:

- Creating a Codex channel with mode `device`, `session`, or `full` creates one canonical non-nil UUID seed.
- Enabling convergence on an existing Codex channel creates the seed if it is missing or invalid.
- Editing a channel, refreshing OAuth credentials, rotating access/refresh tokens, or disabling/re-enabling convergence preserves a valid seed.
- Copying a channel clears the source seed; the copied channel receives a fresh seed if convergence is enabled.
- Client/admin payloads cannot supply or replace the seed.
- Non-Codex channels never receive a seed.

Existing enabled Codex channels are backfilled once. Backfill uses a database-portable compare-and-set update so concurrent console/router replicas cannot persist different seeds. Creation and enable flows initialize eagerly; a guarded resolver repairs legacy missing values before relay metadata is cached. No request derives identity from downstream user or token IDs.

Deployment causes one intentional identity transition for already-enabled channels: the former downstream-scoped IDs are replaced by the new channel-account identity. After that transition, identity remains stable across users, tokens, edits, refreshes, restarts, and replicas.

### 2. Fingerprint derivation and mutation

Keep the existing four modes. New Codex channels default to `full`; existing
channels preserve their stored mode, and missing/invalid persisted values remain
`off` for backward compatibility:

- `off`: no fingerprint mutation.
- `device`: stable installation ID only.
- `session`: stable installation/session IDs; thread ID derives from the seed plus the original client session.
- `full`: stable installation/session ID and `thread_id == session_id`.

Derive stable UUIDv4-shaped identifiers from the random seed and fixed Flatkey namespaces. Generate `turn_id` as UUIDv7. Resolve `turn_started_at_unix_ms` once with the ID set so header and body metadata cannot drift by milliseconds.

Use the same staged ID object for:

- `x-codex-installation-id`
- `x-codex-window-id`
- `x-client-request-id`
- `session-id` and `session_id`
- `thread-id`
- `x-codex-turn-metadata`
- body `client_metadata`

Capture the original body `client_metadata.session_id`. Rewrite root `prompt_cache_key` to the converged session only when the original key equals that captured session default. Preserve custom cache keys.

Typed and raw JSON paths must have identical semantics. Chat, responses,
passthrough, image, and compact requests all use the same convergence policy;
compact and image receive converged headers, while body fields are rewritten
only where that endpoint already supports them. Retry staging must clear stale
IDs before resolving a new channel.

### 3. Full-mode zero-original hardening

`full` is stricter than the Sub2 v0.1.178 implementation. It guarantees that
known and unknown client-origin identity material is not forwarded unchanged.

Body policy:

- Rebuild `client_metadata` from the converged installation/session/thread/turn/window set.
- Remove environment and tool-chain fields such as cwd, workspace, Git state,
  OS/architecture, terminal, plugin, skill, MCP, and trace identifiers.
- Unknown `client_metadata` fields are dropped and the clean request continues.
- Invalid JSON, unsafe shape, or an over-limit metadata object fails before the
  upstream request instead of falling back to original passthrough bytes.
- Add marker-based regression tests around the existing relay log/error paths.
  Add redaction only at a call site where a marker test proves original
  metadata or credentials are currently emitted; do not introduce a new global
  logging subsystem speculatively.

Header policy:

- After channel header overrides, remove known client-origin identity side
  channels and rewrite server-owned Codex identity headers from trusted state.
- Drop client/override Cookie, distributed-trace, locale, timeout, opaque beta,
  turn-state, attestation, and unknown `x-codex-*` headers.
- Preserve endpoint-specific transport headers, then recreate required auth,
  media, canonical identity, beta, and converged-ID headers from trusted server
  state. Do not clear unrelated server-owned transport headers wholesale.
- Keep Flatkey's existing exact Codex route switch. Lock its hard-coded paths
  with regression tests instead of adding a second request-class/path router.

Flatkey does not honor `openai_device_id` or another client/admin supplied
installation ID. Installation identity always derives from the system-managed
seed and deployment namespace.

All Codex subscription egress paths share the same finalization helpers,
including typed conversion, raw passthrough, compact, image, OAuth refresh,
models, usage/reset, and admin probes. A path that cannot be finalized fails
before sending rather than silently using the caller's original identity.

### 4. Canonical Codex outbound identity

Introduce one resolver that returns a coherent identity tuple:

```text
User-Agent + originator + version
```

The effective client version precedence is:

```text
manual admin version > last synced stable official version > built-in fallback
```

Rules:

- Accept only normalized official version shapes and reject control characters or oversized values.
- Enforce the Sub2 upstream floor of `0.144.0`; lower or invalid versions fall back to the built-in safe version.
- A configured User-Agent may provide the official client family and OS/terminal suffix, but its embedded version is rebuilt from the effective version.
- If a configured User-Agent cannot be paired with an official originator, fall back to the canonical Codex TUI identity.
- Final identity enforcement runs after channel header overrides so an override cannot accidentally create a half-identity.
- Provide an administrator kill switch for emergency rollback; enforcement is enabled by default to match Sub2.

Request shapes:

- Codex inference: canonical `User-Agent`, paired `originator`, canonical `version`, and existing `OpenAI-Beta` behavior.
- OAuth token exchange/refresh and equivalent credential-face requests: canonical `User-Agent` plus paired `originator`, deliberately no `version` header.
- Models manifest: query `client_version` keeps its caller contract; the `Version` header uses that value only when valid and above the floor, otherwise it falls back to the canonical version.
- Existing Flatkey quota/usage/reset-credit and probe paths that authenticate as the Codex subscription reuse the same resolver instead of hard-coded client identities.

### 5. Official version synchronization

Reuse and harden Flatkey's existing `openai/codex` release lookup rather than creating a second downloader.

- Poll every six hours from the master/console task lane only.
- Accept only stable, non-draft official releases with valid `rust-v*`/version metadata.
- Persist the last valid synced version in the existing global settings store.
- Never replace a valid stored value with an invalid, prerelease, older, or failed lookup result.
- Manual version always wins over the synced version.
- A failed refresh keeps the last known version and logs only the source/result, never credentials or fingerprint seeds.
- All replicas read the persisted effective value through the existing settings/cache invalidation mechanism.

### 6. Deployment namespace and clone safety

Stable IDs derive from both the random channel seed and a deployment-level
namespace supplied through `CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE`.

- Every replica in one deployment must use the same namespace.
- Independent production, staging, and cloned deployments must use different
  namespaces, so copying the database does not copy the upstream-visible IDs.
- Production `full` mode fails closed when the namespace is absent; local/test
  environments may use an explicit `local` namespace.
- Namespace values are never sent upstream or logged with seeds.
- Changing the namespace intentionally rotates all converged IDs and therefore
  requires an explicit deployment operation.

Application-level channel copy still clears the source seed and mints a new one.
The external namespace solves full-database clone reuse, which a database-only
seed cannot solve by itself.

### 7. Administration surface

Keep the existing per-channel convergence selector and make `full` the selected
and persisted default for newly created Codex channels. Editing an existing
channel must preserve its current mode unless the administrator changes it.
Do not expose the seed.

Add global Codex identity settings for:

- canonical User-Agent override
- manual client-version override
- automatic version synchronization toggle
- read-only last synced version/source timestamp
- emergency identity-enforcement toggle

New user-visible copy must use all supported frontend locales. Defaults are new
Codex channel convergence `full`, automatic version synchronization enabled, and
outbound identity enforcement enabled. Existing channels without an explicit
mode remain `off`; deployment does not mass-enable convergence.

## Error handling and rollback

- Missing/invalid seed on an enabled channel is repaired server-side; if persistence fails, the request fails before sending a changing or legacy-derived identity upstream.
- Missing production deployment namespace fails before a `full` request is sent upstream.
- Disabling convergence stops ID/body rewriting but retains the seed for stable re-enable.
- Disabling identity enforcement restores the existing passthrough/default-header behavior without deleting version or seed state.
- Version-sync failure never blocks inference while a valid manual, synced, or built-in fallback exists.
- Seed, access token, refresh token, and full OAuth key are excluded from logs and API responses.

## Testing

Tests must prove:

- seed create, preserve, disable/re-enable, copy, invalid repair, and concurrent compare-and-set behavior
- no seed leakage through channel APIs or frontend form state
- downstream users/tokens no longer change installation/session IDs for one channel
- UUIDv7 turn IDs and one shared turn timestamp
- typed/raw body parity and guarded `prompt_cache_key` rewrite
- full-mode metadata rebuild drops environment/tool/trace fields and unknown keys
- post-override header normalization removes client/override identity side channels
- compact, image, passthrough, usage, model, OAuth, and admin probe paths share the policy
- invalid metadata fails closed and retry state cannot leak across channels
- existing exact endpoint routing remains locked against suffix/path smuggling
- deployment namespaces isolate cloned databases and missing production namespace fails closed
- inference identity tuple is coherent after header overrides
- credential-face requests omit `version`
- manifest query/header version rules
- stable-only auto-sync, manual precedence, stale-on-error behavior, and cache invalidation
- existing Codex fingerprint, OAuth refresh, usage, model-fetch, and relay tests remain green
- new Codex channel forms persist `full` while existing missing/off modes remain unchanged

## Deployment impact

- Router deploy: required, because relay headers and request bodies change.
- Console deploy: required, because channel seed lifecycle, global settings, migrations, and the version-sync task change.
- Web deploy: not required; only the authenticated console frontend changes.
- Database: one additive hidden channel column plus an idempotent backfill/repair step compatible with SQLite, MySQL, and PostgreSQL.
- Runtime configuration: set a stable, deployment-unique `CODEX_FINGERPRINT_DEPLOYMENT_NAMESPACE` on console and router replicas before enabling `full` traffic.

Roll out to staging first. Verify one enabled test subscription across two downstream users and tokens, OAuth refresh, models fetch, usage query, and restart/multi-replica cache convergence before production deployment.
