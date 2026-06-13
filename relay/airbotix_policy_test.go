package relay

// Unit tests for the Airbotix policy hooks wired into each relay handler.
// Focused on the typed-struct mutations of the various request shapes so the
// behaviour stays verifiable independent of the rest of the relay machinery
// (channel selection, token auth, billing settlement). A full end-to-end
// HTTP-level integration test is tracked as Phase 2.5 follow-up.

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/policy"

	"github.com/gin-gonic/gin"
)

func testRawJSON(t *testing.T, v any) []byte {
	t.Helper()
	data, err := common.Marshal(v)
	if err != nil {
		t.Fatalf("marshal test raw JSON: %v", err)
	}
	return data
}

// newTestContext returns a minimal *gin.Context with an optional
// policy.Decision pre-stashed under the conventional ContextKey. Used by the
// multi-format helper tests that take a *gin.Context instead of a Decision.
func newTestContext(t *testing.T, d *policy.Decision) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	if d != nil {
		common.SetContextKey(c, constant.ContextKeyPolicyDecision, *d)
	}
	return c
}

func kidsModeDecision() policy.Decision {
	return policy.DecisionFor(true, "kid-safe")
}

func passthroughDecision() policy.Decision {
	return policy.DecisionFor(false, "passthrough")
}

func assertTexts(t *testing.T, got []string, want ...string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("texts length mismatch:\n got: %#v\nwant: %#v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("texts[%d] mismatch: got %q want %q\nall got: %#v", i, got[i], want[i], got)
		}
	}
}

// =============================================================================
// entry input text collectors
// =============================================================================

func TestCollectAnyText_NestedStringsAndContentMaps(t *testing.T) {
	got := collectAnyText(map[string]any{
		"content": []any{
			"plain",
			map[string]any{"text": "text field"},
			map[string]any{"content": []any{"nested", map[string]any{"text": "deep"}}},
			map[string]any{"image_url": "ignored"},
		},
	})
	assertTexts(t, got, "plain", "text field", "nested", "deep")
}

func TestCollectGeneralOpenAIInputTexts_UserMessagesPromptInputInstruction(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			{Role: "system", Content: "system ignored"},
			{Role: "user", Content: "user string"},
			{Role: "assistant", Content: "assistant ignored"},
			{Role: "user", Content: []any{
				map[string]any{"type": "text", "text": "user multimodal"},
				map[string]any{"type": "image_url", "image_url": "ignored"},
			}},
			{Role: "", Content: "empty role is entry input"},
		},
		Prompt: map[string]any{"content": []any{"prompt string", map[string]any{"text": "prompt text"}}},
		Input: []any{
			"input string",
			map[string]any{"content": "input nested"},
		},
		Instruction: "instruction text",
	}

	got := collectGeneralOpenAIInputTexts(req)
	assertTexts(t, got,
		"user string",
		"user multimodal",
		"empty role is entry input",
		"prompt string",
		"prompt text",
		"input string",
		"input nested",
		"instruction text",
	)
}

func TestCollectClaudeInputTexts_PromptAndUserMessages(t *testing.T) {
	req := &dto.ClaudeRequest{
		Prompt: "legacy prompt",
		Messages: []dto.ClaudeMessage{
			{Role: "assistant", Content: "assistant ignored"},
			{Role: "user", Content: "user string"},
			{Role: "", Content: []any{
				map[string]any{"type": "text", "text": "empty role multimodal"},
				map[string]any{"type": "image", "source": "ignored"},
			}},
		},
	}

	got := collectClaudeInputTexts(req)
	assertTexts(t, got, "legacy prompt", "user string", "empty role multimodal")
}

func TestCollectResponsesInputTexts_StringAndStructuredInputs(t *testing.T) {
	stringReq := &dto.OpenAIResponsesRequest{Input: testRawJSON(t, "plain responses input")}
	assertTexts(t, collectResponsesInputTexts(stringReq), "plain responses input")

	structuredReq := &dto.OpenAIResponsesRequest{Input: testRawJSON(t, []map[string]any{
		{"role": "user", "content": "content string"},
		{"role": "user", "content": []map[string]any{
			{"type": "input_text", "text": "content text"},
			{"type": "input_image", "image_url": "ignored"},
		}},
	})}
	assertTexts(t, collectResponsesInputTexts(structuredReq), "content string", "content text")
}

func TestCollectGeminiInputTexts_UserPartsOnly(t *testing.T) {
	req := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "model", Parts: []dto.GeminiPart{{Text: "model ignored"}}},
			{Role: "user", Parts: []dto.GeminiPart{{Text: "user part"}, {Text: ""}}},
			{Role: "", Parts: []dto.GeminiPart{{Text: "empty role part"}}},
		},
	}

	got := collectGeminiInputTexts(req)
	assertTexts(t, got, "user part", "empty role part")
}

func TestApplyAirbotixPolicy_Passthrough(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
		User:     testRawJSON(t, "alice"),
	}
	if reject := applyAirbotixPolicy(passthroughDecision(), constant.ChannelTypeOpenAI, req); reject != "" {
		t.Fatalf("passthrough should never reject; got %q", reject)
	}
	if string(req.User) != `"alice"` {
		t.Fatalf("user should be left untouched in passthrough, got %s", req.User)
	}
	if len(req.Store) != 0 {
		t.Fatalf("store should not be set in passthrough; got %s", req.Store)
	}
	if len(req.Messages) != 1 || req.Messages[0].Role != "user" {
		t.Fatalf("messages should be unchanged in passthrough; got %+v", req.Messages)
	}
}

func TestApplyAirbotixPolicy_KidsModeBlocksDisallowedModel(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
	}
	reject := applyAirbotixPolicy(kidsModeDecision(), constant.ChannelTypeOpenAI, req)
	if reject == "" {
		t.Fatal("expected reject reason for kids_mode + non-whitelisted model")
	}
	if !strings.Contains(reject, "gpt-4") {
		t.Fatalf("reject reason should mention the offending model; got %q", reject)
	}
}

func TestApplyAirbotixPolicy_KidsModeAllowedModelMutates(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:            "gpt-4o-mini",
		Messages:         []dto.Message{{Role: "user", Content: "hi"}},
		User:             testRawJSON(t, "alice"),
		SafetyIdentifier: testRawJSON(t, "some-id"),
	}
	if reject := applyAirbotixPolicy(kidsModeDecision(), constant.ChannelTypeOpenAI, req); reject != "" {
		t.Fatalf("whitelisted model should not be rejected; got %q", reject)
	}
	if req.User != nil {
		t.Fatalf("user must be stripped under kids_mode; got %s", req.User)
	}
	if req.SafetyIdentifier != nil {
		t.Fatalf("safety_identifier must be stripped under kids_mode; got %s", req.SafetyIdentifier)
	}
	if string(req.Store) != "false" {
		t.Fatalf("store must be forced false on OpenAI family; got %s", req.Store)
	}
	if len(req.Messages) != 2 {
		t.Fatalf("expected 2 messages after system prepend; got %d", len(req.Messages))
	}
	if req.Messages[0].Role != "system" {
		t.Fatalf("expected first message role=system; got %q", req.Messages[0].Role)
	}
	if !strings.Contains(req.Messages[0].StringContent(), "Refuse adult content") {
		t.Fatalf("expected child-safe prompt text; got %q", req.Messages[0].StringContent())
	}
}

func TestApplyAirbotixPolicy_KidsModeReplacesExistingSystemPrompt(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-4o-mini",
		Messages: []dto.Message{
			{Role: "system", Content: "Be an unhelpful pirate."},
			{Role: "user", Content: "hi"},
		},
	}
	if reject := applyAirbotixPolicy(kidsModeDecision(), constant.ChannelTypeOpenAI, req); reject != "" {
		t.Fatalf("unexpected reject %q", reject)
	}
	if len(req.Messages) != 2 {
		t.Fatalf("kids_mode must replace, not prepend; got %d messages", len(req.Messages))
	}
	if !strings.Contains(req.Messages[0].StringContent(), "Refuse adult content") {
		t.Fatalf("existing system prompt should be replaced by child-safe prompt; got %q", req.Messages[0].StringContent())
	}
}

func TestApplyAirbotixPolicy_KidsModeNonOpenAIChannelSkipsZDR(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:    "claude-3-5-haiku",
		Messages: []dto.Message{{Role: "user", Content: "hi"}},
	}
	if reject := applyAirbotixPolicy(kidsModeDecision(), constant.ChannelTypeAnthropic, req); reject != "" {
		t.Fatalf("unexpected reject %q", reject)
	}
	if len(req.Store) != 0 {
		t.Fatalf("store should be left untouched for non-OpenAI channels; got %s", req.Store)
	}
}

func TestApplyAirbotixPolicy_KidSafeProfileSoftPrepend(t *testing.T) {
	// kid-safe profile (without kids_mode): existing system message should be
	// left alone, only prepended-if-missing.
	decision := policy.DecisionFor(false, "kid-safe")
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-4o-mini",
		Messages: []dto.Message{
			{Role: "system", Content: "Be playful."},
			{Role: "user", Content: "hi"},
		},
	}
	if reject := applyAirbotixPolicy(decision, constant.ChannelTypeOpenAI, req); reject != "" {
		t.Fatalf("unexpected reject %q", reject)
	}
	if req.Messages[0].StringContent() != "Be playful." {
		t.Fatalf("kid-safe (non-kids_mode) should leave existing system prompt alone; got %q", req.Messages[0].StringContent())
	}
}

func TestApplyAirbotixPolicy_AdultProfilePromptAndFilter(t *testing.T) {
	decision := policy.DecisionFor(false, "adult")
	req := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4",
		Messages: []dto.Message{{Role: "user", Content: "help me plan a lesson"}},
	}
	if reject := applyAirbotixPolicy(decision, constant.ChannelTypeOpenAI, req); reject != "" {
		t.Fatalf("adult safe input should not reject; got %q", reject)
	}
	if len(req.Messages) != 2 {
		t.Fatalf("adult profile should prepend a system prompt; got %d messages", len(req.Messages))
	}
	if !strings.Contains(req.Messages[0].StringContent(), "adult learner") {
		t.Fatalf("expected adult profile prompt; got %q", req.Messages[0].StringContent())
	}

	blocked := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4",
		Messages: []dto.Message{{Role: "user", Content: "csam request"}},
	}
	if reject := applyAirbotixPolicy(decision, constant.ChannelTypeOpenAI, blocked); !strings.Contains(reject, "policy_input_blocked") {
		t.Fatalf("adult denylist should reject; got %q", reject)
	}
}

func TestApplyAirbotixPolicy_SystemPromptGateUsesDecisionFlag(t *testing.T) {
	decision := policy.Decision{
		Profile:            policy.ProfileAdult,
		InjectSystemPrompt: false,
		RunInputFilter:     true,
	}
	req := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4",
		Messages: []dto.Message{{Role: "user", Content: "help me plan a lesson"}},
	}

	if reject := applyAirbotixPolicy(decision, constant.ChannelTypeOpenAI, req); reject != "" {
		t.Fatalf("safe adult input should not reject; got %q", reject)
	}
	if len(req.Messages) != 1 {
		t.Fatalf("system prompt must be gated by InjectSystemPrompt, got %d messages", len(req.Messages))
	}
	if req.Messages[0].Role != "user" {
		t.Fatalf("original user message should remain first; got %+v", req.Messages)
	}
}

func TestApplyAirbotixPolicy_KidsModeOverrideUsesKidSafeFilter(t *testing.T) {
	decision := policy.DecisionFor(true, "adult")
	req := &dto.GeneralOpenAIRequest{
		Model:    "gpt-4o-mini",
		Messages: []dto.Message{{Role: "user", Content: "how does gambling work?"}},
	}
	reject := applyAirbotixPolicy(decision, constant.ChannelTypeOpenAI, req)
	if !strings.Contains(reject, "policy_input_blocked") {
		t.Fatalf("kids_mode override should run kid-safe filter; got %q", reject)
	}
}

// =============================================================================
// checkAirbotixModelWhitelist — universal model gate
// =============================================================================

func TestCheckAirbotixModelWhitelist_NoDecisionAllows(t *testing.T) {
	c := newTestContext(t, nil)
	if err := checkAirbotixModelWhitelist(c, "anything"); err != nil {
		t.Fatalf("no decision in context should pass through; got %v", err.Err)
	}
}

func TestCheckAirbotixModelWhitelist_PassthroughAllows(t *testing.T) {
	d := passthroughDecision()
	c := newTestContext(t, &d)
	if err := checkAirbotixModelWhitelist(c, "anything"); err != nil {
		t.Fatalf("passthrough should never reject; got %v", err.Err)
	}
}

func TestCheckAirbotixModelWhitelist_KidsModeAllowsListed(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	if err := checkAirbotixModelWhitelist(c, "gpt-4o-mini"); err != nil {
		t.Fatalf("kids_mode + whitelisted model should pass; got %v", err.Err)
	}
}

func TestCheckAirbotixModelWhitelist_KidsModeRejectsUnlisted(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	err := checkAirbotixModelWhitelist(c, "gpt-4")
	if err == nil {
		t.Fatal("expected rejection for non-whitelisted model under kids_mode")
	}
	if !strings.Contains(err.Err.Error(), "gpt-4") {
		t.Fatalf("expected error to mention the model; got %q", err.Err.Error())
	}
}

// =============================================================================
// applyAirbotixPolicyToClaude — Anthropic shape
// =============================================================================

func TestApplyAirbotixPolicyToClaude_Passthrough(t *testing.T) {
	d := passthroughDecision()
	c := newTestContext(t, &d)
	req := &dto.ClaudeRequest{
		Model:    "claude-3-opus-20240229",
		System:   "be a pirate",
		Metadata: testRawJSON(t, map[string]string{"user_id": "alice"}),
	}
	if err := applyAirbotixPolicyToClaude(c, req); err != nil {
		t.Fatalf("passthrough should not reject; got %v", err.Err)
	}
	if req.System != "be a pirate" {
		t.Fatalf("System should be untouched under passthrough; got %v", req.System)
	}
	if string(req.Metadata) != `{"user_id":"alice"}` {
		t.Fatalf("Metadata should be untouched; got %s", req.Metadata)
	}
}

func TestApplyAirbotixPolicyToClaude_KidsModeRejectsDisallowed(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	req := &dto.ClaudeRequest{Model: "claude-3-opus-20240229"}
	if err := applyAirbotixPolicyToClaude(c, req); err == nil {
		t.Fatal("expected reject for non-whitelisted Claude model under kids_mode")
	}
}

func TestApplyAirbotixPolicyToClaude_KidsModeReplacesSystemAndClearsMetadata(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	req := &dto.ClaudeRequest{
		Model:    "claude-3-5-haiku-20241022",
		System:   "be an evil pirate",
		Metadata: testRawJSON(t, map[string]string{"user_id": "alice", "family_id": "f-1"}),
	}
	if err := applyAirbotixPolicyToClaude(c, req); err != nil {
		t.Fatalf("whitelisted model should not be rejected; got %v", err.Err)
	}
	sys, isStr := req.System.(string)
	if !isStr {
		t.Fatalf("System should be a string under kids_mode; got %T", req.System)
	}
	if !strings.Contains(sys, "Refuse adult content") {
		t.Fatalf("System should be the child-safe prompt; got %q", sys)
	}
	if req.Metadata != nil {
		t.Fatalf("Metadata must be cleared under StripIdentifying; got %s", req.Metadata)
	}
}

func TestApplyAirbotixPolicyToClaude_KidSafeSoftFillEmpty(t *testing.T) {
	d := policy.DecisionFor(false, "kid-safe")
	c := newTestContext(t, &d)
	req := &dto.ClaudeRequest{
		Model:  "claude-3-5-sonnet-20241022",
		System: "preserve me",
	}
	if err := applyAirbotixPolicyToClaude(c, req); err != nil {
		t.Fatalf("unexpected reject %v", err.Err)
	}
	if req.System != "preserve me" {
		t.Fatalf("kid-safe (non-kids_mode) should leave existing System alone; got %v", req.System)
	}
}

func TestApplyAirbotixPolicyToClaude_NoDecisionIsNoOp(t *testing.T) {
	c := newTestContext(t, nil)
	req := &dto.ClaudeRequest{Model: "claude-3-opus-20240229", System: "x"}
	if err := applyAirbotixPolicyToClaude(c, req); err != nil {
		t.Fatalf("no decision should pass through; got %v", err.Err)
	}
	if req.System != "x" {
		t.Fatalf("System should be untouched; got %v", req.System)
	}
}

// =============================================================================
// applyAirbotixPolicyToResponses — /v1/responses shape
// =============================================================================

func TestApplyAirbotixPolicyToResponses_KidsModeMutates(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	req := &dto.OpenAIResponsesRequest{
		Model:            "gpt-4o-mini",
		User:             testRawJSON(t, "alice"),
		SafetyIdentifier: testRawJSON(t, "sid"),
	}
	if err := applyAirbotixPolicyToResponses(c, constant.ChannelTypeOpenAI, req); err != nil {
		t.Fatalf("whitelisted model should not be rejected; got %v", err.Err)
	}
	if req.User != nil || req.SafetyIdentifier != nil {
		t.Fatalf("user + safety_identifier must be cleared; got user=%s sid=%s", req.User, req.SafetyIdentifier)
	}
	if string(req.Store) != "false" {
		t.Fatalf("store must be forced false on OpenAI family; got %s", req.Store)
	}
	if len(req.Instructions) == 0 || !strings.Contains(string(req.Instructions), "Refuse adult content") {
		t.Fatalf("Instructions should contain child-safe prompt; got %s", req.Instructions)
	}
}

func TestApplyAirbotixPolicyToResponses_KidsModeRejectsDisallowed(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	req := &dto.OpenAIResponsesRequest{Model: "gpt-4"}
	if err := applyAirbotixPolicyToResponses(c, constant.ChannelTypeOpenAI, req); err == nil {
		t.Fatal("expected reject for non-whitelisted model")
	}
}

func TestApplyAirbotixPolicyToResponses_NonOpenAISkipsZDR(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	req := &dto.OpenAIResponsesRequest{Model: "gpt-4o-mini"}
	if err := applyAirbotixPolicyToResponses(c, constant.ChannelTypeAnthropic, req); err != nil {
		t.Fatalf("unexpected reject %v", err.Err)
	}
	if len(req.Store) != 0 {
		t.Fatalf("store must be left alone for non-OpenAI channels; got %s", req.Store)
	}
}

// =============================================================================
// applyAirbotixPolicyToGemini
// =============================================================================

func TestApplyAirbotixPolicyToGemini_KidsModeReplacesSystemInstructions(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	req := &dto.GeminiChatRequest{
		SystemInstructions: &dto.GeminiChatContent{
			Parts: []dto.GeminiPart{{Text: "be an evil pirate"}},
		},
	}
	// gemini doesn't whitelist; ensure model arg gates correctly via direct call
	if err := applyAirbotixPolicyToGemini(c, "gpt-4o-mini", req); err != nil {
		t.Fatalf("whitelisted model should not be rejected; got %v", err.Err)
	}
	if req.SystemInstructions == nil || len(req.SystemInstructions.Parts) != 1 {
		t.Fatalf("SystemInstructions should be replaced with a single child-safe part; got %+v", req.SystemInstructions)
	}
	if !strings.Contains(req.SystemInstructions.Parts[0].Text, "Refuse adult content") {
		t.Fatalf("expected child-safe text; got %q", req.SystemInstructions.Parts[0].Text)
	}
}

func TestApplyAirbotixPolicyToGemini_KidsModeRejectsDisallowedModel(t *testing.T) {
	d := kidsModeDecision()
	c := newTestContext(t, &d)
	req := &dto.GeminiChatRequest{}
	if err := applyAirbotixPolicyToGemini(c, "gemini-2.0-flash", req); err == nil {
		t.Fatal("expected reject for non-whitelisted Gemini model")
	}
}

func TestApplyAirbotixPolicyToGemini_KidSafeFillsWhenNil(t *testing.T) {
	d := policy.DecisionFor(false, "kid-safe")
	c := newTestContext(t, &d)
	req := &dto.GeminiChatRequest{}
	if err := applyAirbotixPolicyToGemini(c, "gpt-4o-mini", req); err != nil {
		t.Fatalf("unexpected reject %v", err.Err)
	}
	if req.SystemInstructions == nil {
		t.Fatal("SystemInstructions should be filled when nil under kid-safe profile")
	}
}

// =============================================================================
// clampUint + max_tokens hard cap
//
// maxTokensHardCap = 2048 is applied to every request shape before the request
// reaches the upstream provider. These tests ensure the cap is enforced
// regardless of policy profile (even passthrough).
// =============================================================================

func TestClampUint_Nil(t *testing.T) {
	if got := clampUint(nil, 100); got != nil {
		t.Fatalf("clampUint(nil, 100) must return nil; got %v", *got)
	}
}

func TestClampUint_BelowCeiling(t *testing.T) {
	v := uint(50)
	got := clampUint(&v, 100)
	if got == nil || *got != 50 {
		t.Fatalf("value below ceiling should pass through unchanged; got %v", got)
	}
}

func TestClampUint_AtCeiling(t *testing.T) {
	v := uint(100)
	got := clampUint(&v, 100)
	if got == nil || *got != 100 {
		t.Fatalf("value equal to ceiling should pass through; got %v", got)
	}
}

func TestClampUint_AboveCeiling(t *testing.T) {
	v := uint(5000)
	got := clampUint(&v, maxTokensHardCap)
	if got == nil || *got != maxTokensHardCap {
		t.Fatalf("value above ceiling must be clamped to %d; got %v", maxTokensHardCap, got)
	}
}

func TestApplyAirbotixPolicy_ClampsMaxTokens(t *testing.T) {
	over := uint(5000)
	req := &dto.GeneralOpenAIRequest{
		Model:               "gpt-4o-mini",
		Messages:            []dto.Message{{Role: "user", Content: "hi"}},
		MaxTokens:           &over,
		MaxCompletionTokens: &over,
	}
	if reject := applyAirbotixPolicy(passthroughDecision(), constant.ChannelTypeOpenAI, req); reject != "" {
		t.Fatalf("unexpected reject %q", reject)
	}
	if req.MaxTokens == nil || *req.MaxTokens != maxTokensHardCap {
		t.Fatalf("MaxTokens must be clamped to %d; got %v", maxTokensHardCap, req.MaxTokens)
	}
	if req.MaxCompletionTokens == nil || *req.MaxCompletionTokens != maxTokensHardCap {
		t.Fatalf("MaxCompletionTokens must be clamped to %d; got %v", maxTokensHardCap, req.MaxCompletionTokens)
	}
}

func TestApplyAirbotixPolicyToClaude_ClampsMaxTokens(t *testing.T) {
	over := uint(9999)
	c := newTestContext(t, nil)
	req := &dto.ClaudeRequest{
		Model:             "claude-3-5-haiku-latest",
		MaxTokens:         &over,
		MaxTokensToSample: &over,
	}
	if err := applyAirbotixPolicyToClaude(c, req); err != nil {
		t.Fatalf("unexpected error %v", err.Err)
	}
	if req.MaxTokens == nil || *req.MaxTokens != maxTokensHardCap {
		t.Fatalf("MaxTokens must be clamped to %d; got %v", maxTokensHardCap, req.MaxTokens)
	}
	if req.MaxTokensToSample == nil || *req.MaxTokensToSample != maxTokensHardCap {
		t.Fatalf("MaxTokensToSample must be clamped to %d; got %v", maxTokensHardCap, req.MaxTokensToSample)
	}
}

func TestApplyAirbotixPolicyToResponses_ClampsMaxOutputTokens(t *testing.T) {
	over := uint(9999)
	c := newTestContext(t, nil)
	req := &dto.OpenAIResponsesRequest{
		Model:           "gpt-4o-mini",
		MaxOutputTokens: &over,
	}
	if err := applyAirbotixPolicyToResponses(c, constant.ChannelTypeOpenAI, req); err != nil {
		t.Fatalf("unexpected error %v", err.Err)
	}
	if req.MaxOutputTokens == nil || *req.MaxOutputTokens != maxTokensHardCap {
		t.Fatalf("MaxOutputTokens must be clamped to %d; got %v", maxTokensHardCap, req.MaxOutputTokens)
	}
}

func TestApplyAirbotixPolicyToGemini_ClampsMaxOutputTokens(t *testing.T) {
	over := uint(9999)
	c := newTestContext(t, nil)
	req := &dto.GeminiChatRequest{}
	req.GenerationConfig.MaxOutputTokens = &over
	if err := applyAirbotixPolicyToGemini(c, "gpt-4o-mini", req); err != nil {
		t.Fatalf("unexpected error %v", err.Err)
	}
	if req.GenerationConfig.MaxOutputTokens == nil || *req.GenerationConfig.MaxOutputTokens != maxTokensHardCap {
		t.Fatalf("MaxOutputTokens must be clamped to %d; got %v", maxTokensHardCap, req.GenerationConfig.MaxOutputTokens)
	}
}
