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
//   - InjectSystemPrompt: prepend (or replace, when KidsMode=true) the
//     per-profile system prompt. Chat-shaped endpoints only.
//   - RunInputFilter: reject entry input text that matches the profile denylist.
//   - StripIdentifying: clear User / SafetyIdentifier / Metadata.user_id.
//     Applied per-format where these fields exist.
//   - EnforceZDR + OpenAI-family channel: force Store=false. OpenAI shapes
//     only (chat/completions, responses).
//
// See internal/kids and internal/policy for the source semantics.

import (
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

func rejectAirbotixInput(deny *policy.InputDeny) *types.NewAPIError {
	reason := "policy_input_blocked"
	if deny != nil {
		reason = deny.Reason()
	}
	return types.NewErrorWithStatusCode(
		fmt.Errorf("%s", reason),
		types.ErrorCodeInvalidRequest,
		http.StatusUnprocessableEntity,
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

// prependProfileSystemPrompt mutates request.Messages so that the profile
// system prompt is the effective system message seen by upstream.
//
// kidsMode=true is a hard constraint: any incoming system message is replaced.
// kidsMode=false (i.e. profile alone) is softer: prepend only if no
// system message exists.
func prependProfileSystemPrompt(request *dto.GeneralOpenAIRequest, decision policy.Decision) {
	if request == nil {
		return
	}
	prompt, ok := policy.SystemPromptFor(decision)
	if !ok {
		return
	}
	role := request.GetSystemRoleName()
	for i, m := range request.Messages {
		if m.Role == role || m.Role == "system" || m.Role == "developer" {
			if decision.KidsMode {
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

func rawJSON(v any) []byte {
	data, err := common.Marshal(v)
	if err != nil {
		return nil
	}
	return data
}

// clampUint returns v clamped to ceiling. If v == nil, returns nil unchanged.
func clampUint(v *uint, ceiling uint) *uint {
	if v != nil && *v > ceiling {
		return &ceiling
	}
	return v
}

func collectGeneralOpenAIInputTexts(request *dto.GeneralOpenAIRequest) []string {
	if request == nil {
		return nil
	}
	texts := make([]string, 0, len(request.Messages)+3)
	for _, message := range request.Messages {
		if message.Role == "user" || message.Role == "" {
			texts = append(texts, message.StringContent())
		}
	}
	texts = append(texts, collectAnyText(request.Prompt)...)
	texts = append(texts, collectAnyText(request.Input)...)
	if request.Instruction != "" {
		texts = append(texts, request.Instruction)
	}
	return texts
}

func collectAnyText(value any) []string {
	switch v := value.(type) {
	case nil:
		return nil
	case string:
		return []string{v}
	case []string:
		return v
	case []any:
		texts := make([]string, 0, len(v))
		for _, item := range v {
			texts = append(texts, collectAnyText(item)...)
		}
		return texts
	case map[string]any:
		var texts []string
		if text, ok := v["text"].(string); ok {
			texts = append(texts, text)
		}
		if content, ok := v["content"]; ok {
			texts = append(texts, collectAnyText(content)...)
		}
		return texts
	default:
		return nil
	}
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
	if deny := policy.CheckInput(decision, collectGeneralOpenAIInputTexts(request)...); deny != nil {
		return deny.Reason()
	}
	if decision.InjectSystemPrompt {
		prependProfileSystemPrompt(request, decision)
	}
	if decision.StripIdentifying {
		request.User = nil
		request.SafetyIdentifier = nil
	}
	if decision.EnforceZDR && isOpenAIFamilyChannel(channelType) {
		request.Store = rawJSON(false)
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
	if deny := policy.CheckInput(d, collectClaudeInputTexts(request)...); deny != nil {
		return rejectAirbotixInput(deny)
	}
	if d.InjectSystemPrompt {
		prompt, _ := policy.SystemPromptFor(d)
		// kids_mode is hard: replace whatever the client sent.
		// profile alone is soft: only fill if empty.
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
	if deny := policy.CheckInput(d, collectResponsesInputTexts(request)...); deny != nil {
		return rejectAirbotixInput(deny)
	}
	if d.InjectSystemPrompt {
		prompt, _ := policy.SystemPromptFor(d)
		promptJSON, mErr := common.Marshal(prompt)
		if mErr == nil {
			if d.KidsMode || len(request.Instructions) == 0 || string(request.Instructions) == "null" {
				request.Instructions = promptJSON
			}
		}
	}
	if d.StripIdentifying {
		request.User = nil
		request.SafetyIdentifier = nil
	}
	if d.EnforceZDR && isOpenAIFamilyChannel(channelType) {
		request.Store = rawJSON(false)
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
	if deny := policy.CheckInput(d, collectGeminiInputTexts(request)...); deny != nil {
		return rejectAirbotixInput(deny)
	}
	if d.InjectSystemPrompt {
		prompt, _ := policy.SystemPromptFor(d)
		if d.KidsMode || request.SystemInstructions == nil {
			request.SystemInstructions = &dto.GeminiChatContent{
				Role: "system",
				Parts: []dto.GeminiPart{
					{Text: prompt},
				},
			}
		}
	}
	return nil
}

func collectClaudeInputTexts(request *dto.ClaudeRequest) []string {
	if request == nil {
		return nil
	}
	texts := make([]string, 0, len(request.Messages)+1)
	if request.Prompt != "" {
		texts = append(texts, request.Prompt)
	}
	for _, message := range request.Messages {
		if message.Role == "user" || message.Role == "" {
			texts = append(texts, message.GetStringContent())
		}
	}
	return texts
}

func collectResponsesInputTexts(request *dto.OpenAIResponsesRequest) []string {
	if request == nil {
		return nil
	}
	inputs := request.ParseInput()
	texts := make([]string, 0, len(inputs))
	for _, input := range inputs {
		if input.Text != "" {
			texts = append(texts, input.Text)
		}
	}
	return texts
}

func collectGeminiInputTexts(request *dto.GeminiChatRequest) []string {
	if request == nil {
		return nil
	}
	var texts []string
	for _, content := range request.Contents {
		if content.Role != "" && content.Role != "user" {
			continue
		}
		for _, part := range content.Parts {
			if part.Text != "" {
				texts = append(texts, part.Text)
			}
		}
	}
	return texts
}
