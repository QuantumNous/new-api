# ADR 0004 — Channel API keys stored plaintext

- **Status**: Accepted, with named trigger to revisit
- **Date**: 2026-05-22
- **Affects**: `deeprouter/` (also applies to `users.webhook_secret`)

## Context

The `channels.key` column on the `channels` table stores upstream API keys (OpenAI, Anthropic, Bedrock, etc.) **in plaintext**. There is no symmetric encryption layer in the codebase — `grep -r "AES\|cipher.NewGCM\|crypto/aes"` returns zero hits across `common/`, `model/`, and `service/`.

The same is true for `users.webhook_secret` (added by this fork for billing webhook signatures).

This is the upstream behavior — `QuantumNous/new-api` has always stored channel keys plaintext. It's been a known item, not a security incident.

We could add column-level application encryption:
- envelope encryption with a KMS-wrapped DEK
- store ciphertext + IV + auth-tag in the same column
- decrypt on every read

But that's a non-trivial change: every code path that reads `channel.key` (37 provider adapters, channel test endpoints, balance check endpoints, channel-list APIs) would need to call the decryption helper. Adding this on a fork that rebases monthly from a moving upstream means high ongoing merge conflict cost in `controller/channel.go`, `relay/channel/*/adaptor.go`, etc. — files we explicitly try to keep clean (see ADR 0006).

## Decision

For V0, **keep plaintext storage**. Compensate at other layers:

1. **DB-level**: enable encryption-at-rest on the storage volume / RDS instance. This protects against stolen-disk scenarios.
2. **Network-level**: never expose the database port. Postgres listens only on the docker network; no security group rule on `5432`.
3. **Access-control level**: reading a channel's key value via the API requires `RootAuth` (not `AdminAuth`) plus `SecureVerificationRequired` (TOTP / passkey re-prompt). Regular admins see masked values only. This is enforced in `router/api-router.go:230`.
4. **Backup-level**: any pg_dump backed up off-host MUST be encrypted (e.g., `pg_dump | gpg -e`) before leaving the instance. Operational runbook only — no code enforcement.
5. **Audit**: rotate provider keys whenever an admin user leaves the org or a backup leaks. We accept that there is no in-band detection of compromise.

This decision applies equally to `users.webhook_secret`.

## Consequences

**Good**:
- Upstream-rebase friendly. We don't touch any of the 37 channel adapters or the channel CRUD path.
- Simpler operationally: no KMS to provision, no key rotation choreography for the DEK.
- No new failure modes (KMS unavailable → can't decrypt key → can't relay).

**Bad**:
- A leaked Postgres dump exposes every channel's API key in plaintext. The mitigations above try to reduce probability, not impact.
- Doesn't meet SOC 2 / ISO 27001 "data-at-rest encryption beyond disk level" controls if a hypothetical future customer demands them. We'd fail an audit on this control today.
- `webhook_secret` shares the same exposure surface. Tenant billing forgery becomes possible if a dump leaks.

**Neutral**:
- DB encryption-at-rest (RDS storage encryption, EBS encryption) provides legal "encrypted at rest" coverage even though the column value is plaintext relative to the DB engine. This is a real but partial defense.

## Alternatives considered

1. **AES-GCM column encryption with KMS-wrapped DEK** — most correct technically. Rejected for V0 due to upstream-rebase cost and lack of immediate driver. Documented as the most likely path on trigger.
2. **Wrap key in `pgcrypto` symmetric functions at the SQL layer** — couples encryption to Postgres only; we support SQLite + MySQL too (see ADR 0005). Rejected.
3. **Store keys in HashiCorp Vault or AWS Secrets Manager, only fetch by reference** — significant infrastructure dependency; expensive per-request fetch; cache invalidation across N gateway instances becomes a problem. Rejected for V0.
4. **Hash the key (no plaintext stored, hash-compare on auth)** — doesn't apply: we need the plaintext to forward to the upstream provider's API. This isn't password auth.
5. **Encrypt only the high-value keys (Bedrock, Anthropic) and leave others plaintext** — partial protection, double the operational complexity. Rejected.

## Trigger to revisit

Reopen IMMEDIATELY if any of these happen:

- An enterprise customer's procurement requires column-level encryption (most likely trigger).
- A SOC 2 / ISO 27001 audit is scheduled.
- We add multi-tenancy with stronger blast-radius isolation (e.g., per-tenant DB).
- A backup leak or pg_dump exposure incident occurs (post-mortem driven).

When the trigger fires, the implementation path is roughly:
1. Add `common/keystore/` package with `Encrypt(plaintext) ([]byte, error)` and `Decrypt(ciphertext) (string, error)` using KMS-wrapped DEK.
2. Add `channel.key_ciphertext` column alongside `channel.key`; migrate existing rows.
3. Update channel write paths to encrypt; update read paths to decrypt.
4. Backfill + drop the plaintext column after a verification window.
5. Same for `users.webhook_secret`.

Estimated effort: 2–3 engineer-days plus a careful migration. Don't do this preemptively; do it when the trigger is real.
