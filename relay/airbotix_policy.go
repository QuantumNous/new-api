package relay

// Airbotix policy hooks for the V0 kids_mode hard constraints.
//
// Applied to the typed request struct in each relay handler BEFORE the request
// is converted to a provider-specific payload, so that downstream adapters
// translate the kid-safe constraints automatically.
//
// Behaviours (all gated by policy.Decision from middleware/policy.go):
//   - EnforceModelWhitelist: reject early with HTTP 400 if request.Model is
//     not on kids.EligibleModels. Runs in every relay handler.
//   - InjectChildSafePrompt: prepend (or replace, when KidsMode=true) the
//     child-safe system prompt. Chat-shaped endpoints only.
//   - StripIdentifying: clear User / SafetyIdentifier / Metadata.user_id.
//     Applied per-format where these fields exist.
//   - EnforceZDR + OpenAI-family channel: force Store=false. OpenAI shapes
//     only (chat/completions, responses).
//
// See internal/kids and internal/policy for the source semantics.

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/kids"
	"github.com/QuantumNous/new-api/internal/policy"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// maxTokensHardCap is the global ceiling for max_tokens / max_completion_tokens
// across all request shapes and all tenants. Prevents a single request from
// consuming unbounded upstream tokens regardless of quota settings.
const maxTokensHardCap uint = 2048

// policyDecisionFromContext returns the policy.Decision stashed by
// middleware/policy.go, or zero (passthrough) + false when none is present.
func policyDecisionFromContext(c *gin.Context) (policy.Decision, bool) {
	raw, ok := common.GetContextKey(c, constant.ContextKeyPolicyDecision)
	if !ok || raw == nil {
		return policy.Decision{}, false
	}
	d, ok := raw.(policy.Decision)
	return d, ok
}

// rejectAirbotixModel builds the consistent 400 error returned by every relay
// handler when a kids_mode tenant requests a non-whitelisted model.
func rejectAirbotixModel(model string) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		fmt.Errorf("model_not_eligible_for_kids_mode: %s", model),
		types.ErrorCodeChannelModelMappedError,
		http.StatusBadRequest,
		types.ErrOptionWithSkipRetry(),
	)
}

// checkAirbotixModelWhitelist is the minimal universal guard: every relay
// handler calls this after request parsing to enforce kids.EligibleModels.
// Returns non-nil error to abort the request; nil means continue.
func checkAirbotixModelWhitelist(c *gin.Context, model string) *types.NewAPIError {
	d, ok := policyDecisionFromContext(c)
	if !ok || !d.EnforceModelWhitelist {
		return nil
	}
	if kids.IsModelEligible(model) {
		return nil
	}
	return rejectAirbotixModel(model)
}

// prependKidsSystemPrompt mutates request.Messages so that the child-safe
// system prompt is the effective system message seen by upstream.
//
// kidsMode=true is a hard constraint: any incoming system message is replaced.
// kidsMode=false (i.e. kid-safe profile alone) is softer: prepend only if no
// system message exists.
func prependKidsSystemPrompt(request *dto.GeneralOpenAIRequest, kidsMode bool) {
	if request == nil {
		return
	}
	role := request.GetSystemRoleName()
	prompt := kids.ChildSafeSystemPrompt()
	for i, m := range request.Messages {
		if m.Role == role || m.Role == "system" || m.Role == "developer" {
			if kidsMode {
				request.Messages[i].Role = role
				request.Messages[i].SetStringContent(prompt)
			}
			return
		}
	}
	sysMsg := dto.Message{Role: role}
	sysMsg.SetStringContent(prompt)
	request.Messages = append([]dto.Message{sysMsg}, request.Messages...)
}

// isOpenAIFamilyChannel returns true for channels where OpenAI's `store: false`
// Zero-Data-Retention flag is honoured. Non-OpenAI providers ignore the field
// (or worse, reject it), so we limit ZDR injection to the OpenAI family.
func isOpenAIFamilyChannel(channelType int) bool {
	switch channelType {
	case constant.ChannelTypeOpenAI,
		constant.ChannelTypeAzure,
		constant.ChannelTypeOpenAIMax:
		return true
	}
	return false
}

// clampUint returns v clamped to ceiling. If v == nil, returns nil unchanged.
func clampUint(v *uint, ceiling uint) *uint {
	if v != nil && *v > ceiling {
		return &ceiling
	}
	return v
}

// applyAirbotixPolicy is the single mutation entry-point called from TextHelper.
// Returns a non-nil reject string when the model whitelist check denies the
// request; otherwise mutates request in place and returns "".
func applyAirbotixPolicy(decision policy.Decision, channelType int, request *dto.GeneralOpenAIRequest) (rejectReason string) {
	if request == nil {
		return ""
	}
	request.MaxTokens = clampUint(request.MaxTokens, maxTokensHardCap)
	request.MaxCompletionTokens = clampUint(request.MaxCompletionTokens, maxTokensHardCap)
	if decision.EnforceModelWhitelist && !kids.IsModelEligible(request.Model) {
		return "model_not_eligible_for_kids_mode: " + request.Model
	}
	if decision.InjectChildSafePrompt {
		prependKidsSystemPrompt(request, decision.KidsMode)
	}
	if decision.StripIdentifying {
		request.User = nil
		request.SafetyIdentifier = nil
	}
	if decision.EnforceZDR && isOpenAIFamilyChannel(channelType) {
		request.Store = json.RawMessage("false")
	}
	return ""
}

// applyAirbotixPolicyToClaude mutates a *dto.ClaudeRequest (Anthropic native
// /v1/messages shape) in place. Returns non-nil error if the model is blocked.
//
// Anthropic-specific semantics:
//   - System: replace under kids_mode (hard); prepend-if-empty under kid-safe
//     profile only. The field is `any` (string OR array of content blocks);
//     we always normalise to a string for simplicity.
//   - Metadata: cleared entirely under StripIdentifying. The kids package's
//     StripIdentifyingMetadata operates on map[string]any; the field here is
//     json.RawMessage, and Anthropic accepts a missing metadata field, so we
//     just drop it rather than parse + filter + re-marshal.
//   - Store: N/A for Anthropic.
func applyAirbotixPolicyToClaude(c *gin.Context, request *dto.ClaudeRequest) *types.NewAPIError {
	if request == nil {
		return nil
	}
	request.MaxTokens = clampUint(request.MaxTokens, maxTokensHardCap)
	request.MaxTokensToSample = clampUint(request.MaxTokensToSample, maxTokensHardCap)
	d, ok := policyDecisionFromContext(c)
	if !ok {
		return nil
	}
	if d.EnforceModelWhitelist && !kids.IsModelEligible(request.Model) {
		return rejectAirbotixModel(request.Model)
	}
	if d.InjectChildSafePrompt {
		prompt := kids.ChildSafeSystemPrompt()
		// kids_mode is hard: replace whatever the client sent.
		// kid-safe profile alone is soft: only fill if empty.
		if d.KidsMode || request.System == nil {
			request.System = prompt
		} else if s, isStr := request.System.(string); isStr && s == "" {
			request.System = prompt
		}
	}
	if d.StripIdentifying {
		request.Metadata = nil
	}
	return nil
}

// applyAirbotixPolicyToResponses mutates a *dto.OpenAIResponsesRequest in
// place (OpenAI /v1/responses shape). Returns non-nil error if the model is
// blocked.
//
// Notes vs the chat/completions shape:
//   - Instructions is json.RawMessage (string-or-array); we only replace it
//     under hard kids_mode and only with a JSON-encoded string. For kid-safe
//     profile we only fill when empty, to avoid clobbering caller intent.
//   - Store + User + SafetyIdentifier match the chat shape and are cleared
//     /forced the same way.
func applyAirbotixPolicyToResponses(c *gin.Context, channelType int, request *dto.OpenAIResponsesRequest) *types.NewAPIError {
	if request == nil {
		return nil
	}
	request.MaxOutputTokens = clampUint(request.MaxOutputTokens, maxTokensHardCap)
	d, ok := policyDecisionFromContext(c)
	if !ok {
		return nil
	}
	if d.EnforceModelWhitelist && !kids.IsModelEligible(request.Model) {
		return rejectAirbotixModel(request.Model)
	}
	if d.InjectChildSafePrompt {
		promptJSON, mErr := common.Marshal(kids.ChildSafeSystemPrompt())
		if mErr == nil {
			if d.KidsMode || len(request.Instructions) == 0 || string(request.Instructions) == "null" {
				request.Instructions = json.RawMessage(promptJSON)
			}
		}
	}
	if d.StripIdentifying {
		request.User = nil
		request.SafetyIdentifier = nil
	}
	if d.EnforceZDR && isOpenAIFamilyChannel(channelType) {
		request.Store = json.RawMessage("false")
	}
	return nil
}

// applyAirbotixPolicyToGemini mutates a *dto.GeminiChatRequest in place.
// Returns non-nil error if the model is blocked.
//
// Notes:
//   - GeminiChatRequest does NOT carry the model name (the model is on
//     RelayInfo, taken from the URL path) — the caller passes it explicitly.
//   - SystemInstructions: replace under kids_mode with a single-text content
//     block; under kid-safe profile, only fill when nil.
//   - Gemini has no User/Store equivalents to strip.
func applyAirbotixPolicyToGemini(c *gin.Context, model string, request *dto.GeminiChatRequest) *types.NewAPIError {
	// Clamp before the policy check so the hard cap applies even when
	// policyDecisionFromContext returns !ok (transient DB error → passthrough).
	if request != nil {
		request.GenerationConfig.MaxOutputTokens = clampUint(request.GenerationConfig.MaxOutputTokens, maxTokensHardCap)
	}
	d, ok := policyDecisionFromContext(c)
	if !ok {
		return nil
	}
	if d.EnforceModelWhitelist && !kids.IsModelEligible(model) {
		return rejectAirbotixModel(model)
	}
	if request == nil {
		return nil
	}
	request.GenerationConfig.MaxOutputTokens = clampUint(request.GenerationConfig.MaxOutputTokens, maxTokensHardCap)
	if d.InjectChildSafePrompt {
		if d.KidsMode || request.SystemInstructions == nil {
			request.SystemInstructions = &dto.GeminiChatContent{
				Role: "system",
				Parts: []dto.GeminiPart{
					{Text: kids.ChildSafeSystemPrompt()},
				},
			}
		}
	}
	return nil
}
