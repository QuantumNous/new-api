package gemini

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
)

func TestApplyThinkingConfigUsesLevelsNotBudget(t *testing.T) {
	info := &convmeta.Values{
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-3-pro",
		Options:             &convmeta.Options{},
	}
	req := &dto.GeminiChatRequest{}
	ApplyThinkingConfig(req, info, dto.GeneralOpenAIRequest{ReasoningEffort: reasoning.LevelXHigh})

	if req.GenerationConfig.ThinkingConfig == nil {
		t.Fatal("expected thinking config")
	}
	if req.GenerationConfig.ThinkingConfig.ThinkingLevel != reasoning.LevelHigh {
		t.Fatalf("thinkingLevel=%q", req.GenerationConfig.ThinkingConfig.ThinkingLevel)
	}
	if !req.GenerationConfig.ThinkingConfig.IncludeThoughts {
		t.Fatal("expected includeThoughts")
	}
	if req.GenerationConfig.ThinkingConfig.ThinkingBudget != nil {
		t.Fatal("thinkingBudget should be omitted")
	}
	if info.GetReasoningEffort() != reasoning.LevelXHigh {
		t.Fatalf("recorded effort=%q", info.GetReasoningEffort())
	}
}

func TestApplyThinkingConfigSuffixRequiresAdapter(t *testing.T) {
	info := &convmeta.Values{
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-3-pro-thinking",
		Options:             &convmeta.Options{},
	}
	req := &dto.GeminiChatRequest{}
	ApplyThinkingConfig(req, info)
	if req.GenerationConfig.ThinkingConfig == nil || !req.GenerationConfig.ThinkingConfig.IncludeThoughts {
		t.Fatal("thinking-capable models should still request thought text")
	}
	if req.GenerationConfig.ThinkingConfig.ThinkingLevel != "" {
		t.Fatalf("suffix adapter should stay gated, got level %q", req.GenerationConfig.ThinkingConfig.ThinkingLevel)
	}

	info.Options.Gemini.ThinkingAdapterEnabled = true
	ApplyThinkingConfig(req, info)
	if req.GenerationConfig.ThinkingConfig == nil || req.GenerationConfig.ThinkingConfig.ThinkingLevel != reasoning.LevelHigh {
		t.Fatalf("got %#v", req.GenerationConfig.ThinkingConfig)
	}
}

func TestApplyThinkingConfigDefaultsIncludeThoughtsForGemini25(t *testing.T) {
	info := &convmeta.Values{
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-2.5-pro",
		Options:             &convmeta.Options{},
	}
	req := &dto.GeminiChatRequest{}
	ApplyThinkingConfig(req, info, dto.GeneralOpenAIRequest{Model: "gemini-2.5-pro"})
	if req.GenerationConfig.ThinkingConfig == nil || !req.GenerationConfig.ThinkingConfig.IncludeThoughts {
		t.Fatalf("got %#v", req.GenerationConfig.ThinkingConfig)
	}
	if req.GenerationConfig.ThinkingConfig.ThinkingLevel != "" {
		t.Fatalf("did not expect thinkingLevel=%q", req.GenerationConfig.ThinkingConfig.ThinkingLevel)
	}
}

func TestApplyThinkingConfigHonorsDisabledIntent(t *testing.T) {
	info := &convmeta.Values{
		ChannelMetaAttached: true,
		UpstreamModelName:   "gemini-2.5-pro",
		Options:             &convmeta.Options{},
	}
	req := &dto.GeminiChatRequest{}
	ApplyThinkingConfig(req, info, dto.GeneralOpenAIRequest{ReasoningEffort: reasoning.LevelNone})
	if req.GenerationConfig.ThinkingConfig == nil || req.GenerationConfig.ThinkingConfig.IncludeThoughts {
		t.Fatalf("got %#v", req.GenerationConfig.ThinkingConfig)
	}
}

func TestModelSupportsThinking(t *testing.T) {
	t.Parallel()
	tests := []struct {
		model string
		want  bool
	}{
		{"gemini-2.5-pro", true},
		{"models/gemini-3-pro-preview", true},
		{"gemini-2.0-flash-thinking-exp", true},
		{"gemini-2.0-flash", false},
		{"gemini-1.5-pro", false},
		{"gemini-2.5-flash-image", false},
		{"gpt-test", false},
	}
	for _, tt := range tests {
		if got := ModelSupportsThinking(tt.model); got != tt.want {
			t.Fatalf("ModelSupportsThinking(%q)=%v want %v", tt.model, got, tt.want)
		}
	}
}
