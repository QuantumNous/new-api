# Alipay Sensitive Option Encryption Design

## Background

The current Alipay configuration path already avoids frontend re-display:

- `GET /api/option/` filters keys ending with `Key`, `Secret`, and `Token`
- the `classic` and `default` admin settings UIs submit Alipay values but do not receive them back
- the UI uses the convention "leave blank to keep current value"

However, the current server-side storage path still keeps Alipay sensitive values in plaintext:

- `model.UpdateOption` writes the raw `value` directly into the `options` table
- `loadOptionsFromDatabase` loads the same raw value into `common.OptionMap`
- `updateOptionMap` assigns the same raw value into runtime config such as `setting.AlipayPrivateKey`

This means:

- a database leak exposes the Alipay private key directly
- a database backup leak exposes the Alipay private key directly
- operational staff with raw database access can read the key directly

The current implementation protects against frontend re-display, but not against at-rest exposure.

## Goal

Add server-side encrypted storage for the Alipay-sensitive option fields that are actually used in payment processing, while preserving the current admin UX and keeping the schema unchanged.

Success means:

1. the database no longer stores Alipay-sensitive values in plaintext
2. runtime Alipay code still receives usable plaintext after decryption
3. `/api/option/` still does not re-display the values
4. admin save behavior remains "leave blank to keep current value"
5. historical plaintext rows remain readable during rollout

## Scope

In scope:

- encrypted storage for:
  - `AlipayPrivateKey`
  - `AlipayPublicKey`
- runtime decryption during option loading
- guarded writes via `UpdateOption`
- backward compatibility for historical plaintext values
- explicit failure behavior when encryption key material is missing
- tests for encrypt/decrypt, backward compatibility, and option loading

Out of scope:

- encrypting Stripe, Creem, Waffo, SMTP, OAuth, or other sensitive options
- changing the `options` table schema
- changing the frontend save UX
- migrating historical plaintext rows automatically in the background
- masking secrets in database administration tools

## Why `AlipayPublicKey` Is Included

`AlipayPublicKey` is lower sensitivity than `AlipayPrivateKey`, but it should still use the same mechanism in this rollout.

Reasons:

- it keeps the Alipay keypair under one consistent storage rule
- it avoids split logic where one field is encrypted and the adjacent field is not
- it reduces future maintenance ambiguity about which Alipay key fields are considered protected

This does not imply the public key carries the same impact as the private key. The driver here is consistency, not equal sensitivity.

## Constraints From The Current Codebase

Relevant code paths:

- [controller/option.go](/mnt/c/users/shaoq/go/src/new-api/controller/option.go)
- [model/option.go](/mnt/c/users/shaoq/go/src/new-api/model/option.go)
- [setting/payment_alipay.go](/mnt/c/users/shaoq/go/src/new-api/setting/payment_alipay.go)
- [service/alipay.go](/mnt/c/users/shaoq/go/src/new-api/service/alipay.go)
- [controller/topup_alipay.go](/mnt/c/users/shaoq/go/src/new-api/controller/topup_alipay.go)

Current behavior to preserve:

- `GetOptions` must continue to omit sensitive keys
- the frontend continues to send blank-sensitive fields only when the admin intentionally fills them
- runtime Alipay payment creation, notify verification, and query reconciliation continue to read `setting.AlipayPrivateKey` and `setting.AlipayPublicKey`

## Proposed Approaches

### Approach A: Encrypt only `AlipayPrivateKey`

Pros:

- smallest code change
- minimal behavior delta

Cons:

- asymmetric handling for the Alipay keypair
- leaves the public key on the old plaintext path
- creates a precedent that similar fields may have inconsistent rules

### Approach B: Add a focused Alipay-sensitive option encryption layer

Pros:

- still narrow in scope
- consistent handling for Alipay key fields
- no schema change required
- easy to extend later if needed

Cons:

- slightly more code than Approach A
- needs careful backward compatibility logic

### Approach C: Build a generic encrypted-option framework now

Pros:

- best long-term architecture
- easy future reuse for Stripe/Waffo/SMTP/OAuth

Cons:

- larger scope than requested
- higher regression risk
- slows down the immediate Alipay hardening fix

## Recommendation

Use **Approach B**.

It gives consistent encrypted storage for the Alipay-sensitive fields actually in use, without forcing a wider framework or a schema rewrite in this pass.

## Design

### 1. Sensitive Option Set

Define a small server-side sensitive-option registry for this rollout:

- `AlipayPrivateKey`
- `AlipayPublicKey`

No other option keys are included in this pass.

### 2. Storage Format

Keep the existing `options` table unchanged:

- key: unchanged
- value: plaintext for normal options, encrypted token for protected Alipay options

Encrypted values should use a versioned prefix:

```text
enc:v1:<ciphertext>
```

This gives:

- fast detection of encrypted vs historical plaintext values
- forward compatibility for future crypto version rotation
- no schema migration requirement

### 3. Encryption Key Source

Introduce one server-side environment variable:

```text
OPTION_CRYPT_KEY
```

Requirements:

- it must never be stored in the database
- it must be deployment-managed only
- it must be stable across restarts for a given environment

The key should be validated on first use by the encryption helper.

If the key is absent:

- reading historical plaintext Alipay values is allowed
- decrypting `enc:v1:` values fails explicitly
- saving new encrypted Alipay values fails explicitly

This avoids silently falling back to plaintext writes after the feature ships.

### 4. Write Path

Write path starts in:

- [controller/option.go](/mnt/c/users/shaoq/go/src/new-api/controller/option.go)
- [model/option.go](/mnt/c/users/shaoq/go/src/new-api/model/option.go)

New behavior:

1. admin submits `PUT /api/option/`
2. if `key` is in the Alipay-sensitive registry:
   - validate `OPTION_CRYPT_KEY`
   - encrypt the submitted value
   - persist the encrypted form to the `options` table
3. update runtime option state using the decrypted plaintext value

Important:

- runtime `setting.AlipayPrivateKey` and `setting.AlipayPublicKey` should remain plaintext in memory after successful save
- only database persistence changes

### 5. Read / Load Path

Read path starts in:

- [model/option.go](/mnt/c/users/shaoq/go/src/new-api/model/option.go)

When loading from the database:

1. if key is not in the sensitive registry:
   - current behavior remains unchanged
2. if key is sensitive and value starts with `enc:v1:`:
   - decrypt
   - place plaintext into `common.OptionMap`
   - place plaintext into `setting.Alipay*`
3. if key is sensitive and value does not start with `enc:v1:`:
   - treat it as historical plaintext
   - place plaintext into runtime as before
   - do not auto-rewrite the database row

This keeps rollout safe for existing installations.

### 6. No Automatic Background Migration

Do not auto-convert historical plaintext rows during startup or sync.

Reasons:

- startup should not mutate production config unexpectedly
- failed partial migration is harder to reason about than explicit re-save
- the existing admin UI already supports re-saving the Alipay fields when needed

Historical plaintext values should remain readable until an administrator saves new values or explicitly rotates the keypair.

### 7. Frontend Behavior

No frontend UX redesign is needed.

Keep existing behavior in:

- [web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayAlipay.jsx](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayAlipay.jsx)
- `default` theme payment settings code already added in the earlier Alipay work

Behavior stays:

- fields do not re-display
- blank means keep current value
- save still uses `PUT /api/option/`

No new API endpoint is needed.

### 8. Error Handling

#### Missing `OPTION_CRYPT_KEY`

When saving a protected Alipay option and the environment key is absent:

- reject the save
- return a clear admin-facing error

When loading encrypted protected options and the environment key is absent:

- log a clear startup/runtime error without printing the ciphertext or plaintext
- fail closed for those specific runtime values

The Alipay payment availability checks should then naturally treat the configuration as incomplete.

#### Decryption Failure

If an `enc:v1:` value cannot be decrypted:

- do not fall back to treating it as plaintext
- log the key name and failure reason only
- treat the affected runtime configuration as unavailable

#### Historical Plaintext

If the stored value has no encryption prefix:

- accept it as a historical plaintext record
- continue loading it
- do not log it

### 9. Logging Rules

Do not log:

- plaintext Alipay private key
- plaintext Alipay public key
- encrypted ciphertext value
- raw option payload body

Allowed logs:

- option key name
- operation type
- error category

Example allowed logging shape:

```text
failed to decrypt sensitive option key=AlipayPrivateKey reason=missing OPTION_CRYPT_KEY
```

### 10. Testing Strategy

Add tests covering:

1. encryption helper:
   - encrypt produces `enc:v1:` format
   - decrypt restores original value
2. write path:
   - saving `AlipayPrivateKey` stores non-plaintext in database
   - runtime config receives plaintext
3. read path:
   - encrypted row loads correctly into runtime config
   - historical plaintext row still loads correctly
4. failure handling:
   - save fails when `OPTION_CRYPT_KEY` is missing
   - decrypting `enc:v1:` fails when key is missing
5. API visibility:
   - `/api/option/` still omits `AlipayPrivateKey`
   - `/api/option/` still omits `AlipayPublicKey`

## Rollout Plan

### Initial Deployment

1. deploy code with encryption support
2. set `OPTION_CRYPT_KEY` in the target environment
3. restart service
4. verify existing historical plaintext Alipay config still loads
5. re-save Alipay fields from admin UI or rotate keys to convert them to encrypted storage

### Operational Note

Because historical plaintext is intentionally still readable, deployment alone does not guarantee the database already contains ciphertext. The actual at-rest protection for existing values begins after those values are re-saved or rotated.

## Risks

### Key Management Risk

If `OPTION_CRYPT_KEY` is lost:

- encrypted Alipay options become unreadable
- Alipay payment functionality will stop working until the same key is restored

This is expected and must be documented for deployment.

### Partial Migration Risk

Some environments may temporarily contain:

- old plaintext Alipay rows
- new encrypted Alipay rows

The read path must therefore support both until migration is complete.

### Scope Creep Risk

It will be tempting to fold Stripe/Waffo/SMTP secrets into the same pass. Do not do that in this implementation cycle.

## Acceptance Criteria

The work is complete when all of the following are true:

1. saving `AlipayPrivateKey` or `AlipayPublicKey` stores `enc:v1:` values in the database
2. runtime Alipay payment code still receives usable plaintext values
3. `/api/option/` still does not expose the two fields
4. the admin UI still behaves as "leave blank to keep current value"
5. existing plaintext rows remain readable after deployment
6. missing `OPTION_CRYPT_KEY` causes explicit save/decrypt failure for encrypted Alipay values instead of silent plaintext fallback
