# internal/skill/errcodes

Stable API error codes, HTTP status mappings, and BlockReason-to-ErrorCode helpers
for the Skill Marketplace. Source of truth:
`docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md §7.2`.

## Public API

| Symbol | Type | Description |
|---|---|---|
| `ErrorCode` | `type string` | Uppercase API error code, for example `"SKILL_NOT_FOUND"` |
| `ErrInvalidRequest` ... `ErrSkillInternalError` | `ErrorCode` constants | 14 stable error codes |
| `ErrorCode.Valid()` | method | Reports whether the code is catalog-registered |
| `HTTPStatusFor(code)` | func | Returns canonical HTTP status; 500 for unknown codes |
| `HTTPStatusCatalog()` | func | Returns a defensive copy of the full code-to-status map |
| `AllErrorCodes()` | func | Returns a defensive copy of all 14 codes in declaration order |
| `ErrorCodeFor(BlockReason)` | func | Translates data-model BlockReason to API ErrorCode |
| `BlockReasonFor(ErrorCode)` | func | Generic reverse translation |
| `SkillBlockedReasonFor(ErrorCode)` | func | DR-70 blocked-event reverse translation |
| `RateLimitedCode` | const | Alias for `ErrSkillRateLimited`, the one code requiring a Retry-After header |

## Why httpStatusByCode is unexported

The internal `httpStatusByCode` map is unexported to prevent callers from mutating
the catalog at runtime. Use `HTTPStatusFor` for single lookups or `HTTPStatusCatalog`
for a full defensive copy. Direct map access would allow code like
`errcodes.HTTPStatus[ErrAuthRequired] = 200`, silently breaking every downstream
HTTP response.

## SKILL_SAFETY_VIOLATION = 403

`tasks/01 §8` lists `"200 or 403"` for safety violations, covering two scenarios:

- Streaming output replacement (200): the streaming layer replaces content but
  returns HTTP 200. This is a streaming-layer behavior, not an error envelope response.
- Pre-injection blocking (403): the request is blocked before or during processing
  and an error envelope is returned.

`tasks/03 §7.2` (authoritative API contract) defines 403 for the error envelope.
`DR-39` only defines the error envelope HTTP status, so `SKILL_SAFETY_VIOLATION = 403`.

## BlockReason to ErrorCode mapping

The mapping is explicit (`blockReasonToCode` table) because string manipulation
cannot reconstruct it reliably:

| BlockReason | ErrorCode |
|---|---|
| `auth_required` | `AUTH_REQUIRED` (no SKILL_ prefix on either side) |
| `plan_required` | `SKILL_PLAN_REQUIRED` (SKILL_ added on error code side) |
| `skill_not_found` | `SKILL_NOT_FOUND` (SKILL_ present on both sides but for different reasons) |

Never use `strings.ToUpper` or prefix manipulation to derive an `ErrorCode` from a `BlockReason`.

## DR-70 `skill_blocked` mapping

`BlockReasonFor` is the generic reverse translation for the shared catalog.
`SkillBlockedReasonFor` is narrower: it returns only the codes that DR-70 treats
as part of the default `skill_blocked` taxonomy.

Excluded by default from `SkillBlockedReasonFor`:

- `INVALID_REQUEST`
- `FORBIDDEN`
- `SKILL_EVALUATION_NOT_PASSED`
- `SKILL_INTERNAL_ERROR`
- `SKILL_SAFETY_VIOLATION`

`SKILL_TIMEOUT` remains present in `SkillBlockedReasonFor` as a canonical
mapping-only entry until a real pre-injection timeout path exists.

## Exhaustiveness guarantees

`TestCatalog_Exhaustiveness` asserts at test time that:

- `len(allErrorCodes) == len(httpStatusByCode)`: no code is missing a status
- `len(allBlockReasons) == len(blockReasonToCode)`: no block reason is missing a mapping
- `len(blockReasonToCode) == len(codeToBlockReason)`: forward and reverse maps are symmetric
- Every key in `httpStatusByCode` satisfies `Valid()`
- Every value in `blockReasonToCode` satisfies `Valid()`

When adding a new error code, update: the `const` block, `httpStatusByCode`,
`allErrorCodes`, `blockReasonToCode` (if it has a BlockReason), and `allBlockReasons`.
`TestCatalog_Exhaustiveness` will fail if any of these are out of sync.
