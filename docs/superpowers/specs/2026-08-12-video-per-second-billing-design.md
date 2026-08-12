# Video Per-Second Billing Design

## Decision

All video generation channels move to per-second billing driven by an
administrator-configurable price table. Channel adapters resolve billing
*dimensions* from the request; prices come from configuration, never from
hardcoded Go tables.

This replaces three divergent hardcoded pricing implementations
(`sora`, `vertex`/`gemini`, `modelapiseedance`) and one token-settled
implementation (`byteplus`) with a single mechanism.

## Goal

- One place to configure video prices; upstream price changes need no deploy.
- Adapters own only *what the request is* (seconds, resolution, video input).
- Configuration is extensible: new billing dimensions must not invalidate
  existing configuration entries.
- Misconfiguration fails loudly rather than silently charging a wrong amount.

## Scope

In scope: every task channel that generates video.

| Channel | Current billing | Change |
| --- | --- | --- |
| `modelapiseedance` | per-second, hardcoded USD | migrate to config |
| `doubao` | per-call + `video_input` ratio only | add seconds, migrate to config |
| `byteplus` | **token-settled** (see Decision Change) | convert to per-second |
| `sora` | per-second, hardcoded `size` ratio | migrate to config |
| `vertex`, `gemini` | per-second, hardcoded resolution table | migrate to config |
| `ali`, `hailuo_v2`, `sonilo`, `xaigrok`, `techmobi` | per-second, hardcoded | migrate to config |
| `kling`, `vidu`, `kuaizi`, `hailuo`, `jimeng`, `jimengproxy`, `jimengzhizinan`, `blockrunseedance`, `blockrunvideo` | per-call, duration ignored | implement per-second |

Out of scope: `suno` (music, not video). Frontend configuration UI — prices are
edited through the existing options JSON surface. `web/classic` — not updated.

## Decision Change: BytePlus Leaves Token Settlement

`docs/superpowers/specs/2026-07-31-byteplus-seedance-tiered-billing-design.md`
established that BytePlus Seedance bills on upstream `total_tokens`. This design
supersedes that decision. That document must be updated with a pointer here so
the two do not contradict each other.

This is a knowing trade-off, not a repeat of the misconfiguration that document
diagnosed. The mechanism is the same one it warned about — a `ModelPrice` entry
marks the task `PerCallBilling` and completion settlement stops reconciling
`total_tokens` (`relay/helper/price.go:153`, `controller/relay.go`). The
difference is intent: the earlier defect misread headline dollar figures as
per-call prices; this design deliberately bills the upstream's **published
per-second price**.

### Rationale: published price, not metered cost

Flatkey is a router. What a customer is charged is the upstream's publicly
published rate. What the upstream actually costs is a supplier-reconciliation
concern handled out of band, on the supplier's own usage reports.

Token settlement conflated the two. It made customer-facing price depend on a
metered quantity that only the supplier can compute, which is why BytePlus
priced differently from every other video channel and why its adapter needed a
bespoke settlement path.

Separating them is the point of this design:

- **Customer price** — published per-second rate, uniform across channels,
  known before submission, quotable to the customer.
- **Supplier cost** — whatever the supplier meters, reconciled against supplier
  invoices elsewhere.

Under this framing, `total_tokens` settlement is not accuracy being given up. It
is a supplier-side quantity that was leaking into customer-facing pricing.

Note this decision is about the *basis*, not the *margin*. Per-second rates are
configured, so any markup or discount is a configuration value, and `GroupRatio`
remains the only customer-specific adjustment.

### Sourcing per-second rates

Prefer the upstream's published per-second price verbatim. Volcengine and
BytePlus both publish per-second reference prices alongside token rates
(e.g. Seedance 2.5 at 720p: ¥1.51/s domestic, $0.231/s overseas).

Derive from the token rate only where no per-second price is published:

```text
tokens_per_second = width * height * fps / 1024
usd_per_second    = tokens_per_second / 1e6 * usd_per_1m_tokens
```

Worked example — `seedance-2.0` at 720p, 24fps, `$7.0 / 1M tokens`:

```text
1280 * 720 * 24 / 1024 = 21600 tokens/s
21600 / 1e6 * 7.0      = $0.1512 /s
```

A lower per-token rate does not imply a lower per-second rate — 4K carries a
cheaper token rate but ~9x the pixels. Derived values must be computed per
resolution, never inferred from the token rate's relative size.

Derived entries record `source_rate_per_1m_tokens` and `assumed_fps` so that an
upstream frame-rate change can be traced to the entries needing recomputation;
a derived rate assumes a fixed fps and does not self-correct. Entries taken
verbatim from a published per-second price need neither field.

## Configuration Contract

One new configuration key holds an ordered list of pricing rules.

```json
[
  {
    "model": "doubao-seedance-2-5-260628",
    "match": { "resolution": "720p", "has_video": "true" },
    "price_per_second": 0.188,
    "basis": "total_duration",
    "fallback_seconds": 30
  },
  {
    "model": "doubao-seedance-2-5-260628",
    "match": { "resolution": "720p" },
    "price_per_second": 0.314,
    "basis": "output_duration"
  },
  {
    "model": "seedance-2.0",
    "match": { "resolution": "720p" },
    "price_per_second": 0.1512,
    "basis": "output_duration",
    "source_rate_per_1m_tokens": 7.0,
    "assumed_fps": 24
  }
]
```

### Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `model` | yes | Exact public model name, matched against `info.OriginModelName` |
| `match` | yes | Dimension constraints; `{}` matches any request for the model |
| `price_per_second` | yes | USD per second; must be positive and finite |
| `basis` | yes | `output_duration` or `total_duration` |
| `fallback_seconds` | when `basis` is `total_duration` | Reservation seconds when input media duration is unknown |
| `source_rate_per_1m_tokens` | no | Documentation only; records the token rate a value was derived from |
| `assumed_fps` | no | Documentation only; records the fps assumed during derivation |

`source_rate_per_1m_tokens` and `assumed_fps` do not affect billing. They exist
so that an upstream frame-rate or token-rate change can be traced to the entries
that need recomputing.

### `basis` semantics

`basis` is mandatory because upstream multiplies different quantities depending
on input. Seedance charges `price * output_duration` with no reference video and
`price * (input_duration + output_duration)` with one. Encoding this as a bare
per-second number would recreate the implicit convention this design removes.

`total_duration` requires `fallback_seconds` because remote media duration
cannot be determined without fetching customer-controlled URLs — rejected under
Alternatives. The reservation uses `fallback_seconds`; a later upstream estimate
may correct it through the existing `AdjustBillingOnSubmit` seam.

### Matching

A rule is a candidate when `model` matches exactly and **every** key in `match`
equals the corresponding dimension the adapter resolved. Keys absent from
`match` are wildcards.

Among candidates, the rule with the **most** `match` constraints wins. Ties are
a configuration error, not a runtime coin flip.

A `match` key the adapter does not produce makes the rule non-candidate. This
guarantees that configuring a dimension the code cannot yet resolve degrades to
"no match" — and therefore to an explicit error — rather than to silent
mispricing.

### Validation at load time

Configuration is rejected, leaving the previous configuration in force, when:

- `price_per_second` is absent, non-positive, `NaN`, or infinite;
- `basis` is absent or not one of the two permitted values;
- `basis` is `total_duration` and `fallback_seconds` is absent or non-positive;
- two rules for the same model have equal constraint counts and can both match.

Ambiguity is rejected rather than resolved because an arbitrary winner in a
billing table is a latent, silent defect.

## Whitelist-Strict Mode

Strictness is per model, determined by presence in the table.

| Model in table | Behaviour |
| --- | --- |
| yes | Per-second billing. No matching rule for the resolved dimensions is a **hard error** — the request is rejected before upstream submission. |
| no | Existing billing path, unchanged, plus one `WARN` log naming the model and channel. |

This is what lets full-scope rollout coexist with incremental configuration.
Configured models get the new behaviour and its strict guarantees; unconfigured
models keep working while the table is filled in. The `WARN` log is the work
queue. When it falls silent, coverage is complete and behaviour is uniformly
strict without a second deploy or a mode switch.

Rejection reuses the existing `modelPriceNotConfiguredError` presentation in
`relay/helper/price.go:20-33`, which already distinguishes administrator from
end-user messaging.

## Adapter Contract

Adapters gain one method. They resolve dimensions; they never hold prices.

```go
// ResolveBillingDimensions reports the billable characteristics of the request.
// Values are normalized strings. Returning nil means the adapter cannot
// determine dimensions and per-second billing must not be attempted.
func (a *TaskAdaptor) ResolveBillingDimensions(c *gin.Context, info *relaycommon.RelayInfo) map[string]string
```

Initial dimension vocabulary:

| Dimension | Values |
| --- | --- |
| `resolution` | `480p`, `720p`, `1080p`, `4k` |
| `has_video` | `true`, `false` |

Seconds are returned separately from dimensions, since seconds are a quantity
rather than a matched attribute.

### Resolution normalization

Channels currently express resolution three ways: labels (`doubao`), pixel
dimensions (`sora`, e.g. `1792x1024`), and unnormalized passthrough
(`modelapiseedance`). Adapters normalize to the label vocabulary, mapping pixel
dimensions to the nearest label. Case and known aliases (`4K`, `2160p`) fold
into the canonical form.

Normalization lives in adapters, not in the matcher, because only the adapter
knows its upstream's encoding. The matcher compares already-normalized strings.

## Price Snapshot Freezing

**Settlement must not re-read the price table.**

Reservation and settlement are separated by an asynchronous window of minutes
(`relay/relay_task.go` submit path, `service/task_polling.go` completion path).
If an administrator edits a price during that window and settlement re-reads
configuration, the settled amount differs from the amount contracted at
submission — an overcharge when prices rise.

At reservation, the resolved price is converted to a multiplier and written into
`OtherRatios`, which is persisted in `TaskBillingContext`
(`model/task.go`). Settlement reads the frozen multiplier. `hailuo_v2` already
does exactly this with its `billableUnits` key; this design generalizes that
pattern rather than inventing a new snapshot format.

Consequently `TaskBillingContext` needs no schema change, and previously
persisted snapshots stay readable.

## Quota Computation

The existing chain is unchanged; only the source of the multiplier moves.

```text
quota = ModelPrice * QuotaPerUnit * GroupRatio * billable_units
billable_units = price_per_second * seconds / ModelPrice
```

`ModelPrice` remains the per-call base that `ModelPriceHelperPerCall`
(`relay/helper/price.go:150`) resolves; `billable_units` folds the entire
per-second calculation into one multiplier. A single combined multiplier is used
rather than separate `seconds` and `resolution` ratios so that repeated
`int()` truncation in `applyTaskOtherRatios` cannot compound. This mirrors
`modelAPIBillingUnits` in `relay/channel/task/modelapiseedance/adaptor.go:551`.

Group ratio, wallet, subscription weighting, refunds, and pre-consumption are
untouched. This design supplies billable units and nothing else.

## Multi-Node Behaviour

Production is multi-node (Rule 11).

Rule evaluation is deterministic and stateless: identical request plus identical
configuration yields an identical price on any node. No process-local state is
introduced.

Configuration propagation is eventually consistent. Existing caches are
per-process — `setting/ratio_setting/exposed_cache.go` (30s TTL) and
`model/pricing.go` (60s TTL) — so a price edit reaches all router nodes within
roughly a minute. During that window different nodes may quote different prices.

This is pre-existing behaviour, but per-second billing amplifies it: a 30-second
4K job spans a far wider absolute spread than a token ratio change. Price edits
should be treated as a rollout, not an instant switch. Snapshot freezing bounds
the damage — a request is settled at the price its own node quoted, so no
request is ever charged a price that never applied to it.

## Error and Privacy Behaviour

- Invalid configuration is rejected at load; the prior configuration stays live.
- A configured model with no matching rule fails before upstream submission, so
  no upstream cost is incurred by a request that cannot be priced.
- An unconfigured model logs `WARN` once per request and bills as before.
- Upstream supplier names, hosts, internal model names, and raw responses stay
  out of client-visible responses and logs (Rule 8 whitelabel).
- No new client-visible endpoint or response field.

## Extension Guide

Two cases, and they differ in whether code changes.

**Adding a value to an existing dimension — configuration only.** Pricing 1080p
separately when `resolution` is already resolved is a new rule and a config
reload. No deploy.

**Adding a new dimension — one line per channel that needs it.** A new `fps`
dimension requires the adapter to emit it:

```go
return map[string]string{
    "resolution": resolution,
    "has_video":  hasVideo,
    "fps":        strconv.Itoa(fps),   // new
}
```

The configuration layer and the matcher do not change. Existing rules do not
change: they carry no `fps` constraint and therefore continue to match any fps.
Only channels that need the dimension emit it.

**Checklist for a new dimension**

1. Emit the key from every adapter that should support it.
2. Normalize values to a closed vocabulary; document it here.
3. Add rules with the new constraint. More-constrained rules win automatically.
4. Verify no ambiguous pairs are introduced (equal constraint counts).

A rule constraining a dimension no adapter emits will never match, and for a
configured model that surfaces as a hard error. This is deliberate: it makes a
forgotten step one fail loudly at configuration time rather than silently
mispricing.

## Alternatives Considered

**Flat composite keys** (`"model|720p|video"` → price). Rejected: adding a
fourth dimension invalidates the key format of every existing entry, forcing a
full migration of hundreds of rows. The stated requirement is that new
dimensions must not disturb existing configuration.

**Reusing `pkg/billingexpr`.** Rejected on two independent grounds. Its variable
environment is a hardcoded set of ten token dimensions
(`pkg/billingexpr/compile.go:41-66`, `run.go:55-101`) with no `duration`,
`resolution`, or extension point; reading request JSON through `param()` instead
would bypass the adapters' default-value normalization and change semantics.
Separately, the task chain has never been wired to tiered settlement — the
synchronous chain's snapshot lives in memory on `RelayInfo` while a task
snapshot must be persisted across nodes and minutes, and
`AdjustBillingOnComplete(task, taskResult)` cannot reach a `RelayInfo`. Wiring
it is roughly 350 lines of infrastructure touching AST introspection that
`pkg/billingexpr/AGENTS.md` flags as core mechanism.

**Local media probing** to determine `total_video_duration`. Rejected: fetching
customer-controlled URLs during preflight adds SSRF, latency, and timeout
exposure without guaranteeing parity with upstream's duration definition.

**A global strict-mode switch** instead of whitelist-strict. Rejected as
redundant. Per-model presence already provides staged rollout, and a switch
would add a second, deletable state to reason about.

## Test Contract

- Rule matching: exact model, wildcard `match`, most-constrained wins, unknown
  dimension key yields no match.
- Load validation rejects each invalid form, and rejection preserves the prior
  configuration.
- Ambiguous rule pairs are rejected.
- Both `basis` values, including `total_duration` with `fallback_seconds`.
- Whitelist-strict: configured-and-matched bills per second;
  configured-and-unmatched hard-errors; unconfigured falls back and warns.
- **Snapshot freezing: a price edit between reservation and settlement does not
  change the settled amount.** This is the regression test for the highest-risk
  behaviour in this design.
- Per-channel dimension resolution, including resolution normalization from
  pixel dimensions and alias folding.
- BytePlus conversion: rates taken from a published per-second table are used
  verbatim; derived rates reproduce the worked example; `ModelPrice` presence
  marks the task per-call as intended, and settlement no longer consults
  `total_tokens`.
- `ModelPriceHelperPerCall` currently has no test coverage; add it.

## Deployment Impact

`Router deploy: required` — changes land in `relay/channel/task/*`,
`relay/helper/`, and `setting/`, all on the `/v1` video billing path.

`newapi-console` also requires the same build so configuration can be edited and
validated. `newapi-web`, Terraform, and Cloudflare are not involved.

Rollout risk concentrates in the BytePlus conversion, which changes an existing
channel's billing basis rather than adding to an unpriced one. Minimum
validation: submit a video job on two nodes and compare quoted amounts; submit a
long job, edit its price mid-flight, and confirm settlement matches the quote;
for BytePlus, confirm each configured per-second rate against the upstream's
published price table before enabling.

Expect BytePlus customer-facing amounts to move relative to token settlement.
That is the intended effect — charges become the published rate rather than a
metered derivative — but the direction and size per resolution should be
measured before rollout, not discovered from support tickets.
