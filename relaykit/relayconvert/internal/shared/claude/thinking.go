package claude

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
)

type OpenRouterReasoning struct {
	Enabled   bool   `json:"enabled"`
	Effort    string `json:"effort,omitempty"`
	MaxTokens int    `json:"max_tokens,omitempty"`
	Exclude   bool   `json:"exclude,omitempty"`
}

const defaultThinkingMaxTokens = uint(1280)

func ThinkingLevelFromClaudeRequest(req *dto.ClaudeRequest) string {
	if req == nil {
		return ""
	}
	if effort := req.GetEfforts(); effort != "" {
		return reasoning.OpenAIReasoningEffort(effort)
	}
	if req.Thinking == nil {
		return ""
	}
	switch strings.ToLower(strings.TrimSpace(req.Thinking.Type)) {
	case "", "disabled", "none":
		return ""
	default:
		return reasoning.LevelHigh
	}
}

// ApplyModelThinking maps Claude model-name suffixes onto adaptive thinking.
// Effort suffixes (-low/-medium/-high/-xhigh/-max) always apply. The
// "-thinking" suffix applies only when adapterEnabled is true.
// The returned name is the upstream model after suffix stripping.
func ApplyModelThinking(req *dto.ClaudeRequest, model string, adapterEnabled bool, preserveThinkingSuffix bool) string {
	if req == nil {
		return model
	}
	if baseModel, effortLevel, ok := reasoning.TrimEffortSuffix(model); ok && effortLevel != "" {
		req.Model = baseModel
		ApplyThinkingLevel(req, baseModel, effortLevel)
		EnsureMaxTokensForThinking(req)
		return baseModel
	}
	if adapterEnabled && strings.HasSuffix(model, "-thinking") {
		trimmedModel := strings.TrimSuffix(model, "-thinking")
		ApplyThinkingLevel(req, trimmedModel, reasoning.LevelHigh)
		EnsureMaxTokensForThinking(req)
		if preserveThinkingSuffix {
			req.Model = model
			return model
		}
		req.Model = trimmedModel
		return trimmedModel
	}
	return model
}

func ApplyThinkingLevel(req *dto.ClaudeRequest, model string, level string) {
	if req == nil {
		return
	}
	if reasoning.IsDisabledThinkingLevel(level) {
		return
	}
	effort := reasoning.ClaudeThinkingEffort(level)
	if effort == "" {
		return
	}
	if req.Thinking == nil {
		req.Thinking = &dto.Thinking{}
	}
	req.Thinking.Type = "adaptive"
	req.OutputConfig = json.RawMessage(`{"effort":"` + effort + `"}`)
	applyThinkingSampling(req, model)
}

func EnsureMaxTokensForThinking(req *dto.ClaudeRequest) {
	if req == nil || req.Thinking == nil {
		return
	}
	if req.MaxTokens == nil || *req.MaxTokens == 0 {
		req.MaxTokens = kitutil.GetPointer(defaultThinkingMaxTokens)
	}
}

func applyThinkingSampling(req *dto.ClaudeRequest, model string) {
	if strings.HasPrefix(model, "claude-opus-4-7") || strings.HasPrefix(model, "claude-opus-4-8") {
		if req.Thinking != nil {
			req.Thinking.Display = "summarized"
		}
		req.Temperature = nil
		req.TopP = nil
		req.TopK = nil
		return
	}
	req.TopP = nil
	req.Temperature = kitutil.GetPointer(1.0)
}
