# internal/kids

Hard-constraint helpers for `kids_mode` tenants. Pure transformations — no I/O, no DB, no side effects.

**Status**: ✅ Implemented + unit-tested + wired via `relay/airbotix_policy.go`.

## What it does

When a tenant has `kids_mode = true` (set on `model/user.go`), four constraints apply before the request is forwarded upstream:

1. **Model whitelist** — only specific safe models are allowed. Non-whitelisted models → 400.
2. **Metadata strip** — `user`, `metadata.user_id`, `metadata.kid_profile_id`, `metadata.family_id`, `metadata.kid_id` are removed so we don't leak child identifiers to the provider.
3. **OpenAI Zero-Data-Retention (ZDR)** — force `store: false` on OpenAI / Azure OpenAI calls so the upstream doesn't retain transcripts.
4. **Child-safe system prompt** — prepend a curated system message that constrains tone, topics, and refusals.

This package only provides the helper functions; the decision to apply them is made in `internal/policy/` and the orchestration is in `relay/airbotix_policy.go`.

## Public API

```go
var EligibleModels map[string]bool   // whitelist (HasPrefix-matched for versioned variants)

func IsModelEligible(model string) bool
func StripIdentifyingMetadata(req map[string]any) map[string]any
func EnforceZeroDataRetention(req map[string]any, providerType string)
func ChildSafeSystemPrompt() string
```

## The whitelist

Hardcoded in this package. Stays deliberately narrow:

| Family | Models |
|---|---|
| OpenAI chat | `gpt-4o-mini`, `gpt-4o` |
| OpenAI image | `gpt-image-2` (primary, added 2026-04-21), `gpt-image-1` (fallback) |
| Anthropic | `claude-3-5-haiku`, `claude-3-5-sonnet` |
| Image | `flux-schnell`, `flux-1.1-pro` |

DALL-E 3 was retired from the whitelist on 2026-05-12. Versioned variants (e.g. `gpt-4o-2024-08-06`) match via `HasPrefix`.

**Review before extending the whitelist** — each addition is a kids-safety decision, not a routine code change.

## Dependencies

- stdlib `strings` only

Zero imports from any other `internal/` package.

## Tests

`kids_test.go` (90 LOC) covers:
- Whitelist membership (incl. versioned variants and DALL-E removal)
- Metadata strip with selective removal + empty-metadata cleanup
- ZDR applied only for openai / azure / azure-openai provider types
- System prompt non-empty and stable

Run: `go test ./internal/kids/...`

## Versioning the whitelist

Date comments inside the source (`// 2026-04-21 added gpt-image-2`, `// 2026-05-12 dropped DALL-E 3`) document real rollouts. When extending, add a similar dated comment and an explicit test case.
