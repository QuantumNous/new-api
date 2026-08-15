// Package kids implements the V0 "kids_mode" hard constraints for tenants
// that serve under-18 users. When User.KidsMode == true, requests must be
// transformed before they are forwarded to upstream providers.
//
// Hard constraints (DeepRouter PRD §6.4-pre):
//   - Strip identifying metadata from upstream calls (user/session IDs)
//   - Inject OpenAI Zero Data Retention (`store: false`) for OpenAI-family providers
//   - Use child-safe system prompt
//   - Restrict model whitelist to kids_eligible models
//   - Force strictest input/output filtering
//
// This package is intentionally side-effect-free (pure functions). The
// orchestration is in internal/policy and the relay controllers.
package kids

import (
	"strings"
)

// EligibleModels is the V0 whitelist of models that may be served to kids_mode
// tenants. Anything else returns ErrModelNotEligible from CheckModel.
// Whitelist must stay narrow; review before extending.
var EligibleModels = map[string]bool{
	// OpenAI
	"gpt-4o-mini": true,
	"gpt-4o":      true,
	// gpt-image-2 (since 2026-04-21) is the primary kids image model: built-in
	// reasoning "thinking mode" self-audits before output. gpt-image-1 stays as
	// a fallback for channels still configured against it; dall-e-3 was retired
	// by OpenAI on 2026-05-12 and is no longer eligible.
	"gpt-image-2": true,
	"gpt-image-1": true,
	// Anthropic — base names match "-latest" and "-YYYYMMDD" via HasPrefix.
	// claude-haiku-4-5 is the current small/cheap tier and the successor to
	// claude-3-5-haiku; the two 3.5 entries were retired by Anthropic
	// (sonnet 2025-10-28, haiku 2026-02-19) and are kept only so tenants
	// pinned to them are gated the same way instead of falling through.
	"claude-haiku-4-5":  true,
	"claude-3-5-haiku":  true,
	"claude-3-5-sonnet": true,
	// Image (Fal / Replicate proxies)
	"flux-schnell": true,
	"flux-1.1-pro": true,
}

// IsModelEligible returns true if the requested model is on the kids-safe whitelist.
func IsModelEligible(model string) bool {
	if model == "" {
		return false
	}
	if EligibleModels[model] {
		return true
	}
	// Accept versioned variants if base is eligible (e.g. "claude-3-5-sonnet-20241022")
	for base := range EligibleModels {
		if strings.HasPrefix(model, base) {
			return true
		}
	}
	return false
}

// StripIdentifyingMetadata returns a copy of the request map with any
// upstream-visible identity fields removed. The shape mirrors OpenAI's
// chat completions request body.
//
// Removes:
//   - user (OpenAI per-user metadata)
//   - metadata.user_id / kid_profile_id / family_id (custom client fields)
//
// Does NOT touch the messages array.
func StripIdentifyingMetadata(req map[string]any) map[string]any {
	if req == nil {
		return req
	}
	delete(req, "user")
	if md, ok := req["metadata"].(map[string]any); ok {
		delete(md, "user_id")
		delete(md, "kid_profile_id")
		delete(md, "family_id")
		delete(md, "kid_id")
		// if metadata is now empty, drop it entirely
		if len(md) == 0 {
			delete(req, "metadata")
		}
	}
	return req
}

// EnforceZeroDataRetention forces `store: false` on OpenAI-family requests
// regardless of what the client asked for. Required by OpenAI's Under-18 Guidance
// for any product serving minors.
//
// providerType is the upstream provider family ("openai" | "azure" | "anthropic" | ...).
// For non-OpenAI families this is a no-op (other providers express retention differently).
func EnforceZeroDataRetention(req map[string]any, providerType string) map[string]any {
	if req == nil {
		return req
	}
	switch providerType {
	case "openai", "azure", "azure-openai":
		req["store"] = false
	}
	return req
}

// ChildSafeSystemPrompt returns the system prompt to inject for kids_mode tenants.
// V0 uses our own. V1+ may prefer Anthropic's official child-safety prompt when
// available; selection happens at the policy middleware layer.
func ChildSafeSystemPrompt() string {
	return `You are talking with a child. Follow these rules at all times:
- You are an AI assistant, not a human. Disclose this if asked.
- Refuse adult content, romance, violence, self-harm, drugs, gambling, weapons, hate.
- Use age-appropriate, encouraging language. Never criticise the child.
- Encourage building, exploration, and learning over passive answers.
- If the child asks about a topic outside these rules, gently redirect to something safe.`
}
