# Billing Expression System (billingexpr)

## Design Philosophy

**One expression, one truth.** A single expression string completely defines a model's billing logic — pricing, tier conditions, cache/image/audio differentiation, time-based discounts, request-aware multipliers — all in one line. No scattered configuration, no implicit rules, no magic numbers.

The expression is the billing contract between the administrator and the system. What you write is what gets executed. The system's job is to evaluate it faithfully, not to interpret it.

### Core Principles

1. **Expression is self-contained** — The expression string alone determines billing. No external ratio tables, no implicit completion multipliers, no hidden conversion factors. Given the same token counts and request context, the same expression always produces the same cost.

2. **Variables are opt-in** — `p` (prompt) and `c` (completion) are the base. Cache (`cr`, `cc`, `cc1h`), image (`img`), and audio (`ai`, `ao`) variables are optional. If omitted, those tokens are included in `p`/`c` and priced at their rate. The system automatically detects which variables the expression uses (via AST introspection) and adjusts token normalization accordingly.

3. **Prices are real prices** — Expression coefficients are actual $/1M tokens prices as published by providers. No ratio conversion, no `/2` convention. `p * 2.5` means $2.50 per 1M prompt tokens.

4. **Upstream-agnostic** — The expression doesn't need to know whether the upstream API is OpenAI-format (prompt_tokens includes cache) or Claude-format (input_tokens excludes cache). The system normalizes token counts before evaluation based on the upstream response format.

5. **Version-aware** — Expressions carry a version tag (`v1:`, default when omitted). The version controls the compile environment, token normalization, and quota conversion formula, enabling future evolution without breaking existing expressions.

---

## Expression Language

Powered by [expr-lang/expr](https://github.com/expr-lang/expr). Expressions are compiled, cached, and evaluated against a runtime environment.

### Token Variables

**输入侧变量：**

| 变量 | 含义 |
|------|------|
| `p` | 输入 token 数（**计价用**）。**自动排除**表达式中单独计价的子类别（见下方说明） |
| `len` | 输入上下文总长度（**条件判断用**）。不受自动排除影响，始终反映完整输入长度。非 Claude：等于原始 `prompt_tokens`；Claude：等于文本输入 + 缓存读取 + 缓存创建 |
| `cr` | 缓存命中（读取）token 数 |
| `cc` | 缓存创建 token 数（Claude 5分钟 TTL / 通用） |
| `cc1h` | 缓存创建 token 数 — 1小时 TTL（Claude 专用） |
| `img` | 图片输入 token 数 |
| `ai` | 音频输入 token 数 |

**输出侧变量：**

| 变量 | 含义 |
|------|------|
| `c` | 输出 token 数。**自动排除**表达式中单独计价的子类别（见下方说明） |
| `img_o` | 图片输出 token 数 |
| `ao` | 音频输出 token 数 |

#### `p` 和 `c` 的自动排除机制

`p` 和 `c` 是"兜底变量"——它们代表**所有没有被表达式单独定价的 token**。系统会根据表达式实际使用了哪些变量，自动从 `p` / `c` 中减去对应的子类别 token，避免重复计费。

**规则：如果表达式使用了某个子类别变量，对应的 token 就从 `p` 或 `c` 中扣除；如果没使用，那些 token 就留在 `p` 或 `c` 里按基础价格计费。**

> **重要：`len` 不受自动排除影响。** `len` 始终代表完整的输入上下文长度，不管表达式是否单独对缓存/图片/音频定价。因此**阶梯条件应使用 `len` 而非 `p`**，以避免缓存命中导致 `p` 降低而误判档位。

举例说明（假设上游返回的原始数据：prompt_tokens=1000，其中包含 200 cache read、100 image）：

| 表达式 | `p` 的值 | 说明 |
|--------|---------|------|
| `p * 3 + c * 15` | 1000 | 没用 `cr`/`img`，所以缓存和图片都包含在 `p` 里，全按 $3 计费 |
| `p * 3 + c * 15 + cr * 0.3` | 800 | 用了 `cr`，缓存 200 从 `p` 中扣除，按 $0.3 单独计费；图片仍在 `p` 里按 $3 计费 |
| `p * 3 + c * 15 + cr * 0.3 + img * 2` | 700 | 用了 `cr` 和 `img`，都从 `p` 中扣除，各自按自己的价格计费 |

输出侧同理（假设 completion_tokens=500，其中包含 100 audio output）：

| 表达式 | `c` 的值 | 说明 |
|--------|---------|------|
| `p * 3 + c * 15` | 500 | 没用 `ao`，音频输出包含在 `c` 里按 $15 计费 |
| `p * 3 + c * 15 + ao * 50` | 400 | 用了 `ao`，音频 100 从 `c` 中扣除按 $50 计费 |

> **注意：** 这个自动排除仅针对 GPT/OpenAI 格式的 API（prompt_tokens 包含所有子类别）。Claude 格式的 API（input_tokens 本身就只包含纯文本）不做任何减法。系统根据上游返回格式自动判断，表达式作者无需关心。

### Built-in Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `tier` | `tier(name, value) → float64` | Records which pricing tier matched; must wrap the cost expression |
| `param` | `param(path) → any` | Reads a JSON path from the request body (uses gjson) |
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

# Multi-tier (Claude Sonnet style) — use len for tier conditions
len <= 200000
  ? tier("standard", p * 3 + c * 15 + cr * 0.3 + cc * 3.75 + cc1h * 6)
  : tier("long_context", p * 6 + c * 22.5 + cr * 0.6 + cc * 7.5 + cc1h * 12)

# Image model (no separate cache/audio pricing — those tokens stay in p/c)
tier("base", p * 2 + c * 8 + img * 2.5)

# Multimodal with audio
tier("base", p * 0.43 + c * 3.06 + img * 0.78 + ai * 3.81 + ao * 15.11)
```

### Request Rules (appended after `|||`)

Request-conditional multipliers are appended to the expression after a `|||` separator:

```
tier("base", p * 5 + c * 25)|||when(header("anthropic-beta") has "fast-mode") * 6
```

These are parsed and applied separately by the request rule system.

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
3. Runs expression with estimated tokens: `RunExprWithRequest(expr, {P, C}, requestInput)`
4. Converts output to quota: `rawCost / 1,000,000 * QuotaPerUnit`
5. Creates `BillingSnapshot` (frozen state for settlement) and stores on `RelayInfo`

### 4. Settlement (Actual Billing)

**Files**: `service/tiered_settle.go`, `pkg/billingexpr/settle.go`

After the upstream response returns with actual token usage:

1. `BuildTieredTokenParams(usage, isClaudeUsageSemantic, usedVars)`:
   - Reads actual token counts from `dto.Usage`
   - For GPT-format APIs (prompt_tokens includes everything): subtracts sub-categories from P/C **only when** the expression uses their variables (detected via AST introspection of the compiled expression)
   - For Claude-format APIs (input_tokens is text-only): no adjustment needed

2. `TryTieredSettle(relayInfo, params)`:
   - Uses the frozen `BillingSnapshot` from pre-consume
   - Re-runs the expression with actual token counts
   - Converts via `quotaConversion()` (version-dispatched)
   - Returns actual quota

### 5. Log Display

**Files**: `service/log_info_generate.go`, `web/src/helpers/render.jsx`

Backend: `InjectTieredBillingInfo()` adds `billing_mode`, `expr_b64` (base64 expression), and `matched_tier` to the log's `other` JSON.

Frontend: Detects `billing_mode === "tiered_expr"`, decodes `expr_b64`, parses tiers via shared `parseTiersFromExpr()`, and renders pricing breakdown.

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
