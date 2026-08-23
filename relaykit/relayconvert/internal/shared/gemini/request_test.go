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
	if req.GenerationConfig.ThinkingConfig != nil {
		t.Fatal("suffix adapter should stay gated")
	}

	info.Options.Gemini.ThinkingAdapterEnabled = true
	ApplyThinkingConfig(req, info)
	if req.GenerationConfig.ThinkingConfig == nil || req.GenerationConfig.ThinkingConfig.ThinkingLevel != reasoning.LevelHigh {
		t.Fatalf("got %#v", req.GenerationConfig.ThinkingConfig)
	}
}
