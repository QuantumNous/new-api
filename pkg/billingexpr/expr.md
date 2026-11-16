# Billing Expression System (billingexpr)

## Design Philosophy

**One expression, one truth.** A single expression string completely defines a model's billing logic — pricing, tier conditions, cache/image/audio differentiation, time-based discounts, request-aware multipliers — all in one line. No scattered configuration, no implicit rules, no magic numbers.

The expression is the billing contract between the administrator and the system. What you write is what gets executed. The system's job is to evaluate it faithfully, not to interpret it.

### Core Principles

1. **Expression is self-contained** — The expression string alone determines billing. No external ratio tables, no implicit completion multipliers, no hidden conversion factors. Given the same token counts and request context, the same expression always produces the same cost.

2. **Variables are opt-in** — `p` (prompt) and `c` (completion) are the base. Cache (`cr`, `cc`, `cc1h`, `cc12h`), image (`img`), and audio (`ai`, `ao`) variables are optional. If omitted, those tokens are included in `p`/`c` and priced at their rate; an omitted long-lived cache write keeps its fixed multiple of the short write price. The system automatically detects which variables the expression uses (via AST introspection) and adjusts token normalization accordingly.

3. **Prices are real prices** — Token coefficients are actual $/1M tokens prices as published by providers. `p * 2.5` means $2.50 per 1M prompt tokens; `fixed(0.01)` means $0.01 per request. No ratio conversion or `/2` convention is required.

4. **Upstream-agnostic** — The expression doesn't need to know whether the upstream API is OpenAI-format (prompt_tokens includes cache) or Claude-format (input_tokens excludes cache). The system normalizes token counts before evaluation based on the upstream response format.

5. **Version-aware** — Expressions carry a version tag (`v1:`, default when omitted). The version controls the compile environment, token normalization, and quota conversion formula, enabling future evolution without breaking existing expressions.

---

## Expression Language

Powered by [expr-lang/expr](https://github.com/expr-lang/expr). Expressions are compiled, cached, and evaluated against a runtime environment.

### Token Variables

**Input side variables:**

| Variable | Meaning |
|------|------|
| `p` | Enter the number of tokens (**for pricing**). **Automatically exclude** separately priced subcategories in expressions (see instructions below) |
| `len` | Enter the total length of the context (**used for conditional judgment). Is not affected by automatic exclusion and always reflects the full input length. Non-Claude: equal to original `prompt_tokens`; Claude: equal to text input + cache read + cache create |
| `cr` | Number of cache hit (read) tokens |
| `cc` | Number of cache creation tokens (Claude 5 minutes TTL / OpenAI 30 minutes TTL / Universal) |
| `cc1h` | Number of cache creation tokens — 1 hour TTL (exclusively for Claude) |
| `cc12h` | Number of cache creation tokens — 12 hours TTL (OpenAI only) |
| `img` | Image input token number |
| `img_cr` | The number of image cache read tokens; split separately only if the expression explicitly references it and the upstream provides valid cache modal details |
| `ai` | Number of audio input tokens |

**Output side variables:**

| Variable | Meaning |
|------|------|
| `c` | Output the number of tokens. **Automatically exclude** separately priced subcategories in expressions (see instructions below) |
| `img_o` | Image output token number |
| `ao` | Number of audio output tokens |

#### Automatic exclusion mechanism for `p` and `c`

`p` and `c` are "catch variables" - they represent all tokens that are not individually priced by an expression. The system will automatically subtract the corresponding subcategory token from `p` / `c` based on which variables are actually used in the expression to avoid repeated billing.

**Rule: If an expression uses a subcategory variable, the corresponding token will be deducted from `p` or `c`; if not used, those tokens will remain in `p` or `c` and billed according to the basic price. **

> **Important: `len` is not affected by automatic exclusion. ** `len` always represents the full input context length, regardless of whether the expression prices cache/image/audio separately. Therefore, **ladder condition should use `len` instead of `p`** to avoid cache hits causing `p` to decrease and misjudgment of gears.

For example (assuming the original data returned by the upstream: prompt_tokens=1000, which contains 200 cache read, 100 image):

| Expression | Value of `p` | Description |
|--------|---------|------|
| `p * 3 + c * 15` | 1000 | Useless `cr`/`img`, so cache and images are included in `p`, all billed at $3 |
| `p * 3 + c * 15 + cr * 0.3` | 800 | Using `cr`, the cache 200 is deducted from `p` and billed separately at $0.3; the image is still billed at $3 in `p` |
| `p * 3 + c * 15 + cr * 0.3 + img * 2` | 700 | If `cr` and `img` are used, they will be deducted from `p`, and each will be billed at its own price |

The same goes for the output side (assuming completion_tokens=500, which contains 100 audio output):

| Expression | Value of `c` | Description |
|--------|---------|------|
| `p * 3 + c * 15` | 500 | Not used `ao`, audio output is included in `c` and is billed at $15 |
| `p * 3 + c * 15 + ao * 50` | 400 | `ao` used, audio 100 deducted from `c` and billed at $50 |

When long-term cache writes (Claude `cc1h`, OpenAI `cc12h`) are not priced separately, they are billed at a fixed multiple of the short-term write price:
OpenAI is 2x in 12 hours and Claude is 6÷3.75x in 1 hour. The short-term writing price is `cc`, and when `cc` is not priced, it is `p`.

#### Image caching and compatibility

OpenAI compatible picture interface can report
`usage.input_tokens_details.cached_tokens_details.{text_tokens,image_tokens,audio_tokens}`。
Unified DTOs retain missing and explicit zero values for fields; replication, usage consolidation, and billing transformations must not lose this information.
The current public Images API documentation does not explicitly cache modal fields, and synthetic testing of compatible structures cannot replace real upstream cache return packet verification.

When an expression uses `img_cr` and the details are valid, `img_cr` is moved out of both `cr` and `img`,
Then subtract non-overlapping categories from `p` according to the variables referenced by the expression. `len` maintains the original total input length.
For example, the total input is 1000, the image input is 600, the total cache is 300, and the image cache is 200:
`p * 5 + cr * 1.25 + img * 8 + img_cr * 2 + c * 30` corresponds
`p=300, cr=100, img=400, img_cr=200`; costs $0.008225 when outputting 100.

When the image cache details are missing, `img_cr=0`, the total cache amount will continue to enter `cr`, and the original general cache billing will be used.
Does not speculate on image cache ratio. Existing expressions that do not reference `img_cr` retain the original normalization behavior.
Details that are negative, exceed the total, or cannot form a valid input set will log a diagnosis and roll back the original logic.
Anthropic's independent cache count semantics do not employ this OpenAI image splitting.

The consumption log of the image cache expression saves `image_cache_tokens` and `billing_tokens`, the latter is carried by the settlement result.
Record the billing usage actually participating in settlement through public log injection, covering text, audio and realtime entries.
The actual usage will not be forged when the evaluation fails and the withholding is rolled back; fixed prices and expressions that do not reference `img_cr` will not add these fields.
`cache_tokens` for text/image logs continues to retain the upstream cache total. `output_tokens` of Images is the image output,
Built-in image prices use `c`, no additional upstream reporting is required `output_tokens_details.image_tokens`.

### Old Pricing Conversion

The old rate and pay-per-view modes can still run, the management interface is marked as deprecated, and new pricing uses expressions by default.
`POST /api/option/model_pricing/convert` receives `{model_name, pricing}` where `pricing`
For complete old pricing drafts, missing keys inherit runtime defaults. The interface returns the expression and the effective pricing snapshot used for this conversion, or the specific reason is not supported and the database is not written.
The management interface first uses the snapshot to display a left-right preview, and then updates the draft after confirmation; canceling does not change the original draft.
Save still uses the existing `PATCH /api/option/model_pricing` and `expected_version` conflict checks.

The multiplier conversion is `ModelRatio * 1000000 / QuotaPerUnit` to get the basic unit price of USD/million tokens,
Preserves effective magnification and explicit zero values for output, cache reads, cache creation where applicable, and image input.
Regular pay-per-view prices convert to `tier("request", fixed(price))`. The old price field continues to be saved for use when switching back to the old mode.
Expression rules are used for withholding and rounding after conversion, and there is no guarantee that the rounding results of each transaction in the old mode will be exactly the same.
Migration, saved price display and draft price preview share effective price analysis: the output uses the hard-coded bottom-line/forced magnification of the model family;
Cache reading, cache creation, and image input without configuration use 1, 1.25, and 1 times the runtime respectively.
When the image magnification is 1, the conversion does not generate an independent `img` item, and the image input continues to be included in `p` and is billed at the same price;
The `img` entry is generated only when the image magnification is other values (including explicit 0).
When the cache read ratio is 1, it is merged into the input price in the price preview; when there is no independent image input or cache write item, the conversion also omits `cr`.
When these independent items exist, the cache counts may overlap, and the zero lower bound of the input margin makes a direct merge no longer equivalent, so the original `cr` calculation is retained without a separate column for the same price.
When the basic input price is 0, the `cr` with a multiplier of 1 can be directly omitted; other cached read multipliers (including explicit 0) retain independent items.
When `cr` is omitted, the number of cache reads reported separately in Anthropic usage is added back to `p`, while `len` maintains the full context length.
Cache creation is handled by external billing name and original configuration: `cc` and `cc1h` are retained when the name contains `claude` (case-insensitive),
Among them, the 1h price inherits the `CreateCacheRatio * 6 / 3.75` of the old engine; other names are only configured in the draft `CreateCacheRatio`
Generic `cc` (including explicit 0) is generated, `cc1h` is not generated. At this time, models whose names contain `gpt` (case-insensitive) also generate `cc12h`.
Prices follow `CreateCacheRatio * 2` from the old engine. The universal 1.25 times bailout without configuration will not generate new billing items.
Cache types are not expanded by channel mapping or model whitelisting, nor do administrators be required to select another type.
Pricing snapshot entries, draft preview responses and conversion results come with read-only `cache_write_mode` (`none` / `standard` / `claude_ttl` / `openai_ttl`),
For unified display. The response of `POST /api/option/model_pricing/preview` is unified as
`{success, message, data: {effective, cache_write_mode, billing_details}}`, caller from `data.effective`
Read the effective price; the JSON structure of the conversion interface and snapshot entry is unchanged. Metainformation is not saved and does not participate in expression execution.
Unset and explicit 0 must be distinguished. After a draft closes an overwrite, it is parsed according to the rollback rules after saving, and it cannot continue to read the old values ​​in the running process that have not been saved and replaced.
Both image and common audio rules can be automatically migrated. The specific rules are as follows; task plug-ins, videos, Realtime, and dependency on upstream cost
The OpenRouter Claude branch that reverses cache write usage still returns specific reasons and does not block by channel type or unknown endpoint.

Gemini audio input uses the US dollar unit price actually used in the old settlement to generate `ai`, without multiplying the ordinary input multiplier, so when the ordinary input price is zero
Standalone audio fees remain. The unit price of `ai` for ordinary audio is the basic input price multiplied by AudioRatio, `ao` multiplied by AudioCompletionRatio,
Default magnification is treated as 1, explicit zero is retained. Ordinary audio settlement does not use cache/image magnification; when the model configures these prices at the same time,
The conversion generates two branches: audio request and plain text request. Audio branch uses `max(len - ai, 0)` to measure normal input and avoid plain text
Cache variable referenced in branch changes audio charge. Gemini text settlement still preserves a zero lower bound on input margin after cache/audio overlap.
Read-only `billing_details` provides the actual audio unit price, image quantity and request magnification rules for preview, and does not become a new persistent price source.
When there are conflicting unit prices for the same billing name on the Gemini/compatible audio portal,
The transformation returns that specific conflict and one of the rules cannot be silently selected to override the other entry.

The price per view of the image is converted to `tier("image", fixed(price)) * image_count`, and the old size and quality conditions are added.
DALL·E size/mass rules are generated based on the original request model name, and model mapping does not introduce these rules additionally.
OpenAI has been offline DALL·E 2/3 on 2026-05-12; its checksum, default value and magnification are retained in independent legacy files.
Only used for historical configuration and compatible upstream. The conversion takes the multiplier from the DTO's old billing logic and does not maintain a second price list.
Image token pricing is not multiplied by quantity. All amounts and ratios are solidified in the expression and old OtherRatios are no longer superimposed.

### Image Quantity

`image_count` is the billing quantity independent of token. Defaults to 1 when context is omitted; the number provided must be between 1 and
`dto.MaxImageN` (128) integer. The fixed price syntax allows it to be used as a multiplier, but multiplying a token with a fixed price is still prohibited.
The image entry only parses the provider billing scalar once and carries it with the request. quantity from top-level `n` (`n=0` is compatible with 1);
`parameters.n` is still within the entry verification range, but no longer covers the billing quantity. After each channel retry or parameter override, the final upstream quantity is verified and the reservation is made up before sending.
Image wallet reservations use atomic balance checks and cannot be submitted after the amount is in arrears by increasing the amount.
`estimated_image_count` saves the quantity before sending this time; the JSON/multipart image parameter context only retains the scalar required for billing, and does not retain the image or prompt word content.
The settlement uses an independent actual quantity and does not modify the frozen `param("n")`. End normally
SSE can reduce the quantity, but early client disconnection cannot reduce the quantity receivable. Final consumption log record `image_count`.
Ali Bailian image models (Wanxiang, Qwen-Image, Z-Image) are undertaken by the alibaba task plug-in through the `openai_image` host protocol:
Its quantity is the task usage fact `u("image_count")`, which is reserved according to the requested quantity when submitted and upstream `usage.image_count` when completed.
(Qwen-Image-3.0 is `usage.output_image_count`) or press each `choices[].message.content[]` / `results[]`
The number of image loads in is settled, and the task consumption log also records `image_count`.

> **Note:** Automatic deduction for APIs targeting GPT/OpenAI formats (prompt_tokens contains subcategories). The Claude-formatted API does not deduct cache repeatedly; cache reads and cache writes that are not priced independently add back the input. The system automatically processes it according to the upstream return format.

### Built-in Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `tier` | `tier(name, value) → float64` | Records which pricing tier matched; must wrap the cost expression |
| `fixed` | `fixed(amount) → float64` | A USD price per request, used only as the complete price in `tier(name, fixed(amount))` |
| `param` | `param(path) → any` | Reads a JSON path from the request body (uses ojson, gjson path syntax) |
| `header` | `header(key) → string` | Reads a request header value |
| `has` | `has(source, substr) → bool` | Substring check |
| `hour` | `hour(tz) → int` | Current hour in timezone (0-23) |
| `minute` | `minute(tz) → int` | Current minute (0-59) |
| `weekday` | `weekday(tz) → int` | Day of week (0=Sunday, 6=Saturday) |
| `month` | `month(tz) → int` | Month (1-12) |
| `day` | `day(tz) → int` | Day of month (1-31) |
| `max` | `max(a, b) → float64` | Math max |
| `min` | `min(a, b) → float64` | Math min |
| `abs` | `abs(x) → float64` | Absolute value |
| `ceil` | `ceil(x) → float64` | Ceiling |
| `floor` | `floor(x) → float64` | Floor |

### Expression Examples

```
# Simple flat pricing
tier("base", p * 2.5 + c * 15 + cr * 0.25)

# Conditional per-request pricing, with token pricing for the fallback
len <= 32000
  ? tier("short", fixed(0.01))
  : tier("long", p * 2 + c * 8)

# Multi-tier (Claude Sonnet style) — use len for tier conditions
len <= 200000
  ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6)
  : tier("long_context", p * 6 + c * 22.5 + cr * 0.6 + cc * 7.5 + cc1h * 12)

# Image model (no separate cache/audio pricing — those tokens stay in p/c)
tier("base", p * 2 + c * 8 + img * 2.5)

# Multimodal with audio
tier("base", p * 0.43 + c * 3.06 + img * 0.78 + ai * 3.81 + ao * 15.11)
```

### Fixed Request Prices

`tier("request", fixed(0.01))` replaces all token charges in the selected leaf
with a $0.01 base price for one successful HTTP/SSE request. Other leaves may
still use token pricing. Group ratios and request multipliers continue to apply;
existing tool surcharges are calculated separately and added as before. A stream
does not incur a fixed fee per chunk. Realtime and task usage expressions reject
`fixed()` before upstream submission or reservation.

The amount must be a finite, non-negative numeric literal whose v1 scaled value
is finite. Explicit `fixed(0)` is valid and stays free. Expressions using `fixed`
must consist of a conditional pricing tree and the standard request multiplier
factors described below, with each leaf wrapped in `tier()`. Adding fixed and
token charges in one leaf, adding multiple tiers together, or multiplying a
fixed price by tokens is rejected. Validation examines the original AST,
including branches that optimization or short-circuiting would skip. Existing
expressions without `fixed()` retain their original grammar and behavior.

`fixed(amount)` returns `amount * 1,000,000` internally, preserving v1's existing
quota conversion and rounding. Pre-consume matches conditions using estimates;
settlement reevaluates against actual or existing locally estimated usage and
reconciles any change of branch through the normal billing session. Missing
upstream usage retains the existing estimation path; an actual request-priced
branch can charge even with zero tokens. Failures retain the normal refund
policy. Settlement evaluation errors retain the reservation and its estimated
billing unit.

Evaluation results expose `billing_unit` (`token` or `request`) and, for a
request-priced leaf, `fixed_price` in USD before multipliers. Pre-consume snapshots
carry `estimated_billing_unit` and `estimated_fixed_price`; consume logs append
the actual values to `other`. An explicit zero price is present in these fields.
Older snapshots and logs need no migration. The expression remains the sole
pricing configuration.

### Request Rules (appended after `|||`)

Request-conditional multipliers are appended to the expression after a `|||` separator:

```
tier("base", p * 5 + c * 25)|||when(header("anthropic-beta") has "fast-mode") * 6
```

These factors are stored as ordinary multiplication in the final expression (for example, `(tier(...)) * (condition ? 6 : 1)`) and run in the same billing program.

### Request Rule Tracing

At compile time, the engine instruments ternary factors with this exact shape:

```
<request-probe condition> ? <numeric literal> : 1
```

The condition must reference at least one request probe (`param`, `header`, `hour`, `minute`, `weekday`, `month`, or `day`). Both branches must be numeric literals and the fallback must equal `1`. Other conditionals, including `(condition ? 2 : 1.5)`, are evaluated normally but are not traced. Integer-only factors use an integer-preserving trace callback, so instrumentation does not change expressions that require an integer operand (for example, `%`). The internal trace callback names are reserved and cannot be used in stored expressions.

The compiled cache stores the canonical condition and multiplier for every instrumented node. Each run starts with the full detected rule list marked as unmatched; callbacks mark rules that actually evaluate true. Rules skipped by normal expression short-circuiting remain unmatched. This keeps the expression's numeric result unchanged and avoids reparsing it on each request.

Settlement copies the actual run's traces into the consume log as:

```json
{
  "request_rules": [
    { "cond": "param(\"service_tier\") == \"fast\"", "multiplier": 2, "matched": true }
  ]
}
```

The usage-log UI treats `request_rules` as the authoritative rule list and renders directly from it. It parses `cond` only to produce a friendly label and falls back to the canonical condition text when that parser does not recognize the condition. Pricing pages without log context continue to parse the stored expression for display.

---

## Task Usage Expressions

Task plugins can expose validated, provider-specific billing facts through
`meta.usageSchema`. Expressions read those facts with `u("key")`. A literal key
must be declared by the plugin schema before the expression can be saved. A
single-plugin model's unchanged stored expression, and its unchanged provider
override, stay saveable after the plugin narrows the model's profile; any edit
must follow the current profile.

Multiple plugins may serve the same model with different usage schemas. The
executing channel identifies the plugin; clients do not select a billing
provider. Task expression resolution uses this order:

1. `billing_setting.plugin_billing_expr["<pluginKey>::<clientModel>"]`
2. The same plugin's override for the final mapped model, when present
3. The client model's expression when its billing mode is `tiered_expr`
4. The final mapped model's expression when the client model has no expression
   billing mode

Plugin overrides always use task-usage semantics, independently of the model's
billing mode. The flat override map is a separate option and never contributes
composite keys to model names or model-price synchronization exports. Existing
prices are not rewritten. The billing snapshot freezes the selected expression;
completion uses that snapshot even if provider pricing later changes.

Chat request quantities never price a task: the token variables (`p`, `c`,
`len`, cache, image and audio token counts) would read 0, and bare
`image_count` would read 1 whatever the task makes. Task image counts come only
from `u("image_count")`. Submission rejects an override or model-level
expression that reads a chat request quantity with 400 `model_price_error`,
override saves reject them, and no expression may mix them with `u()`. A
model-level expression reading them stays saveable as the model's chat price;
its plugins show as unconfigured.

A plugin can also relay a model: one of its relay routes other than the model
list and balance routes accepts the client model. The model-level price is then
that model's chat price too. Without the plugin's own override, its tasks use
it only when it is a per-call price or an expression that reads `u()`; a token
ratio alone or an expression without `u()` leaves the plugin unconfigured, and
submission rejects its tasks with 400 `model_price_error`. A model the plugin
does not relay keeps the legacy per-call charge derived from a token ratio.

A model-level expression save smoke-tests each candidate's selected schema,
skipping candidates with their own override in the same complete draft.
Provider expression saves validate the plugin/model binding and that plugin's
schema; errors identify both model and plugin. For a shared model, an effective
expression referencing an undeclared literal `u()` key is unconfigured for that
provider, including references in branches skipped by the current request.
Submission rejects it with 400 `model_price_error`; administration and public
pricing expose the unconfigured state. Public model-level metadata remains the
first plugin's view in ascending key order, with provider variants added
separately.

Saved provider overrides remain visible when only one provider remains.
Administration exposes unavailable plugin/model bindings as `stale` and permits
preserving or removing their existing expressions. Changes to those expressions
still require a valid binding; writes compare against the locked database
snapshot rather than the process cache. No overrides are silently pruned.
Public provider variants include their effective `billing_mode` so inherited
ratio/per-call pricing is distinct from an unconfigured usage expression.

Plugins serving different model families can optionally declare
`meta.usageProfiles: [{models: ["image-model"], schema: {...}, examples: [...]}]`.
Each profile provides the complete usage schema and optional display examples
for its declared models. It replaces, rather than merges with, the plugin's
default `usageSchema` and `usageExamples`. A model may belong to only one
profile, and profile model names must use the spelling declared in `meta.models`.
An empty profile schema is allowed; a missing or null schema is not. Token-unit
profiles require their own examples, using the same validation as the defaults.

The host resolves model aliases before selecting usage metadata. Model-level
pricing and expression-save APIs use the declared target; an ambiguous alias
with multiple targets in the same plugin retains the plugin defaults. Usage
validation uses the executing plugin and final upstream model. Polling
selects metadata from each saved task's model, including in mixed-model batches.
An upstream name that no profile declares, such as a channel mapping to a vendor
endpoint ID, falls back to the client-facing model's profile. Unmatched models
and plugins without profiles retain the plugin defaults.

Profiles do not introduce a request-body whitelist or remove legacy multiplier
extensions. Numeric hook facts retain a consistent floating-point representation
for expression evaluation, including fields outside the selected profile.
Saving an expression checks literal usage keys against the selected schema;
already stored expressions are not migrated. Single-plugin submissions retain
the existing key-check behavior; shared models enforce the compatibility rule
above. Existing runtime error and quota safety checks still apply.
Completion continues to evaluate the frozen expression after overlaying measured
facts; no schema snapshot or database migration is introduced.

This is an optional addition to plugin API version 1. New hosts accept existing
plugins unchanged. Older hosts reject the new metadata field, so upgrade the
host before installing a plugin that declares profiles.

Numeric facts are finite, non-negative values in the declared canonical unit
(`second`, `count`, `token`, or `credit`); enum facts are exact strings from the
declared value list. The schema description is display-only metadata and never
affects evaluation. `token` is the host unit for upstream billing tokens (for
example doubao `usage.completion_tokens`). `credit` is the host unit for vendor
resource-pack units (for example kling `final_unit_deduction`). Both share the
int32 quota bound, not the 3600-second / 128-count limits.

Task usage billing has a deliberately different conversion rule from token
billing:

```
task quota = expression output in USD * QuotaPerUnit * groupRatio
token quota = expression output in $/1M tokens / 1,000,000 * QuotaPerUnit * groupRatio
```

In other words, a task expression already returns the request's dollar cost.
For example, `u("seconds") * 0.4` means $0.40 per second. Engine semantics do
not divide task output by one million.

The visual editor generates, and public pricing displays recognize, exactly
these canonical task shapes. Expressions outside these shapes remain valid in
raw mode but fall back to the special-expression display:

```
# Flat unit pricing
tier("base", u("seconds") * 0.4)

# Enum tiers (conditions may combine enum comparisons with &&)
u("mode") == "pro"
  ? tier("pro", u("seconds") * 0.8)
  : tier("std", u("seconds") * 0.4)

# Optional constant plus multiple numeric usage terms
tier("base", 0.1 + u("seconds") * 0.4 + u("clips") * 0.05)

# Upstream token overlay (doubao Seedance tokens)
# The editor takes a $/1M token input and emits the / 1000000 literal.
# Engine semantics are unchanged: the expression still returns USD.
tier("base", u("tokens") * 9.8 / 1000000)

# Vendor credit overlay (kling resource-pack units)
# The coefficient is the real $/credit price; no /1M scale.
tier("base", u("units") * 0.14)
```

The tier body is an optional non-negative constant plus one or more
`u("<number field>") * <unit price>` terms. Token-unit fields use the
canonical scaled shape `u("<field>") * <dollars per 1M tokens> / 1000000`.
Credit, second, and count fields keep the bare `u("<field>") * <unit price>`
shape. Tier conditions are equality checks
between declared enum fields and values, optionally joined by `&&`, with
chained ternaries following the same ordering rules as token tiers. Numeric
range tiers are not part of the current canonical shape. Request rules after
`|||` remain orthogonal and use the same syntax as token expressions.

Before saving, the host compiles every expression, rejects literal `u()` keys
that the selected task plugin did not declare, and smoke-tests usage vectors.
Every numeric field is exercised at 0, 1, and its host-owned unit ceiling
(`second` 3600, `count` 128, `token`/`credit` int32 max). Enum values are exercised as a
Cartesian product. Smoke vectors are capped at
64, reducing oversized enum dimensions to their first and last values. Every
evaluated result must be finite and non-negative.

Submission evaluates the expression with request-derived usage facts and
freezes both the expression and those facts in the billing snapshot. On
completion, the host overlays completion facts on the frozen submission facts
key by key, so measured values replace estimates while facts omitted by the
completion hook retain their submission values. The same expression is then
evaluated again; a changed fact can therefore produce a settlement delta and a
different matched tier. Evaluation failure keeps the pre-consumed charge.

---

## Architecture

### Data Flow

```
Frontend Editor → Storage → Pre-consume → Settlement → Log Display
```

### 1. Frontend Editor

**File**: `web/src/pages/Setting/Ratio/components/TieredPricingEditor.jsx`

Two editing modes:
- **Visual mode**: Fill in prices per variable, conditions per tier. Generates expression via `generateExprFromVisualConfig()`.
- **Raw mode**: Edit the expression string directly. Includes preset templates for common models.

The editor outputs a billing expression string and an optional request rule expression string. These are combined via `combineBillingExpr(billingExpr, requestRuleExpr)` before storage.

### 2. Storage

**File**: `setting/billing_setting/tiered_billing.go`

Two option maps stored in the `options` DB table:
- `ModelBillingMode`: `{ "model-name": "tiered_expr" }` — activates tiered billing for a model
- `ModelBillingExpr`: `{ "model-name": "tier(\"base\", p * 2.5 + c * 15)" }` — the expression

On save, the expression is validated:
1. Compiled via `billingexpr.CompileFromCache()` — syntax check
2. Smoke-tested with sample token vectors — ensures non-negative results

### 3. Pre-consume (Quota Estimation)

**File**: `relay/helper/price.go` → `modelPriceHelperTiered()`

When a request arrives and the model uses `tiered_expr` billing:
1. Loads expression from `billing_setting.GetBillingExpr()`
2. Builds `RequestInput` (headers + body) for `param()` / `header()` functions
3. Runs the expression with locally estimated input tokens (`P` and `Len`) and zero output tokens (`C=0`). Client output limits do not affect the reservation. If request token estimation is disabled, the estimated input is zero.
4. Converts output to quota: `rawCost / 1,000,000 * QuotaPerUnit`. For token-priced leaves, multiplies this reservation by `quota_setting.pre_consume_multiplier` (default 1; any finite positive decimal). The multiplier does not change context-length tier selection, actual settlement, or request-priced leaves. The snapshot freezes the multiplier for image quantity retries; group retries reuse the multiplied reservation. Older snapshots with no multiplier retain a factor of 1.
5. Creates `BillingSnapshot` and stores it on `RelayInfo`. Expression and request state stay frozen for settlement. An auto-group retry refreshes group-dependent fields from the selected group before the next upstream attempt. If a free initial group skipped pre-consume and the retry selects a paid group, the billing session is created before that attempt. If an existing session moves to a more expensive group, its reservation is raised to that group's estimate before sending; cheaper groups are refunded only after actual usage is settled.

Wallet trust bypass uses `quota_setting.trust_quota_usd` (default 10 USD; 0 disables bypass). Both the wallet and any limited API token must exceed the threshold. The wallet must still cover the estimated reservation before bypass is considered. Subscriptions and asynchronous tasks do not use this bypass. Legacy token-ratio pricing also reserves estimated input cost times the multiplier, without the former `PreConsumedQuota` floor or output-token estimate. Task usage pricing is unchanged.

### 4. Settlement (Actual Billing)

**Files**: `service/tiered_settle.go`, `pkg/billingexpr/settle.go`

After the upstream response returns with actual token usage:

1. `BuildTieredTokenParams(usage, isClaudeUsageSemantic, usedVars)`:
   - Reads actual token counts from `dto.Usage`
   - For GPT-format APIs (prompt_tokens includes everything): subtracts sub-categories from P/C **only when** the expression uses their variables (detected via AST introspection of the compiled expression)
   - For Claude-format APIs: cache reads and writes omitted from the expression are added to input; separately priced cache remains separate

2. `TryTieredSettle(relayInfo, params)`:
   - Uses the captured `BillingSnapshot`, whose group-dependent fields have been refreshed from the final selected group
   - Re-runs the expression with actual token counts
   - Converts via `quotaConversion()` (version-dispatched)
   - Returns actual quota

### 5. Log Display

**Files**: `service/log_info_generate.go`, `web/src/helpers/render.jsx`

Backend: `InjectTieredBillingInfo()` adds `billing_mode`, `expr_b64` (base64 expression), `matched_tier`, and the structured `request_rules` trace list to the log's `other` JSON.

Frontend: Detects `billing_mode === "tiered_expr"`, decodes `expr_b64`, parses tiers via shared `parseTiersFromExpr()`, and renders request multipliers from `request_rules` when present. Without log traces, it falls back to parsing the stored expression.

---

## Key Design Decisions

### Token Normalization via AST Introspection

Different upstream APIs report `prompt_tokens` differently:
- **OpenAI/GPT**: `prompt_tokens` = total (text + cache + image + audio)
- **Claude**: `input_tokens` = text only (cache reported separately)

The system normalizes `p` to mean "tokens not separately priced" by subtracting sub-categories **only when the expression references them**. This is determined by walking the compiled AST to find `IdentifierNode` references — zero runtime cost after first compilation (cached).

Example: `p * 2.5 + c * 15 + cr * 0.25`
- Expression uses `cr` → cache read tokens subtracted from `p`
- Expression doesn't use `img` → image tokens stay in `p`, priced at $2.50

### `len` — Context Length Variable

`len` represents the total input context length, designed for **tier condition evaluation** (e.g. `len <= 200000 ? ...`). Unlike `p`, `len` is never reduced by sub-category exclusion.

**Computation rules:**
- **Non-Claude (GPT/OpenAI format)**: `len = prompt_tokens` (the raw total from the upstream response)
- **Claude format**: `len = input_tokens + cache_read_tokens + cache_creation_tokens` (since Claude's `input_tokens` is text-only, cache must be added back to reflect full context length)

This ensures that heavy cache usage doesn't cause the tier condition to incorrectly evaluate to a lower tier. For example, if a request has 300K total context but 250K is cached, `p` with cache subtracted would be only 50K (standard tier), while `len` correctly reports 300K (long-context tier).

### Quota Conversion

Expression coefficients are $/1M tokens. Conversion to internal quota:

```
quota = exprOutput / 1,000,000 * QuotaPerUnit * groupRatio
```

This matches the per-call billing pattern: `quota = modelPrice * QuotaPerUnit * groupRatio`.

### Expression Versioning

Expressions can carry a version prefix: `v1:tier(...)`. No prefix = v1.

Version controls:
- Compile environment (available variables and functions)
- Token normalization logic
- Quota conversion formula

This enables future evolution without breaking existing expressions.

---

## File Map

| Layer | Files |
|-------|-------|
| Expression engine | `pkg/billingexpr/compile.go`, `run.go`, `settle.go`, `round.go`, `types.go` |
| Storage | `setting/billing_setting/tiered_billing.go` |
| Pre-consume | `relay/helper/price.go`, `relay/helper/billing_expr_request.go` |
| Settlement | `service/tiered_settle.go`, `service/quota.go` |
| Log injection | `service/log_info_generate.go` |
| Frontend editor | `web/src/pages/Setting/Ratio/components/TieredPricingEditor.jsx` |
| Frontend display | `web/src/helpers/render.jsx`, `web/src/helpers/utils.jsx` |
| Model detail | `web/src/components/table/model-pricing/modal/components/DynamicPricingBreakdown.jsx` |
| Log display | `web/src/hooks/usage-logs/useUsageLogsData.jsx`, `web/src/components/table/usage-logs/UsageLogsColumnDefs.jsx` |
