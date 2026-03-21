package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func newRelayInfo(channelType int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channelType},
	}
}

func TestApplyUsagePostProcessing_DefaultCase_PromptCacheHitTokens(t *testing.T) {
	info := newRelayInfo(0)
	usage := &dto.Usage{
		PromptCacheHitTokens: 200,
	}
	applyUsagePostProcessing(info, usage, nil)
	if usage.PromptTokensDetails.CachedTokens != 200 {
		t.Errorf("CachedTokens = %d, want 200", usage.PromptTokensDetails.CachedTokens)
	}
}

func TestApplyUsagePostProcessing_DefaultCase_StepFunCachedTokens(t *testing.T) {
	body := []byte(`{"usage":{"cached_tokens":150}}`)
	info := newRelayInfo(0)
	usage := &dto.Usage{}
	applyUsagePostProcessing(info, usage, body)
	if usage.PromptTokensDetails.CachedTokens != 150 {
		t.Errorf("CachedTokens = %d, want 150", usage.PromptTokensDetails.CachedTokens)
	}
}

func TestApplyUsagePostProcessing_DefaultCase_CacheCreationTokens(t *testing.T) {
	body := []byte(`{"usage":{"prompt_tokens_details":{"cache_creation_input_tokens":300}}}`)
	info := newRelayInfo(0)
	usage := &dto.Usage{}
	applyUsagePostProcessing(info, usage, body)
	if usage.PromptTokensDetails.CachedCreationTokens != 300 {
		t.Errorf("CachedCreationTokens = %d, want 300", usage.PromptTokensDetails.CachedCreationTokens)
	}
}

func TestApplyUsagePostProcessing_DefaultCase_AlreadyPopulated(t *testing.T) {
	body := []byte(`{"usage":{"cached_tokens":999,"prompt_tokens_details":{"cache_creation_input_tokens":999}}}`)
	info := newRelayInfo(0)
	usage := &dto.Usage{
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         100,
			CachedCreationTokens: 50,
		},
	}
	applyUsagePostProcessing(info, usage, body)
	if usage.PromptTokensDetails.CachedTokens != 100 {
		t.Errorf("CachedTokens = %d, want 100 (should not overwrite)", usage.PromptTokensDetails.CachedTokens)
	}
	if usage.PromptTokensDetails.CachedCreationTokens != 50 {
		t.Errorf("CachedCreationTokens = %d, want 50 (should not overwrite)", usage.PromptTokensDetails.CachedCreationTokens)
	}
}

func TestApplyUsagePostProcessing_DeepSeek_Unaffected(t *testing.T) {
	info := newRelayInfo(constant.ChannelTypeDeepSeek)
	usage := &dto.Usage{
		PromptCacheHitTokens: 500,
	}
	applyUsagePostProcessing(info, usage, nil)
	if usage.PromptTokensDetails.CachedTokens != 500 {
		t.Errorf("CachedTokens = %d, want 500", usage.PromptTokensDetails.CachedTokens)
	}
}

func TestExtractCacheCreationTokensFromBody(t *testing.T) {
	body := []byte(`{"usage":{"prompt_tokens_details":{"cache_creation_input_tokens":42}}}`)
	tokens, ok := extractCacheCreationTokensFromBody(body)
	if !ok {
		t.Fatal("expected ok=true")
	}
	if tokens != 42 {
		t.Errorf("tokens = %d, want 42", tokens)
	}
}

func TestExtractCacheCreationTokensFromBody_Empty(t *testing.T) {
	tokens, ok := extractCacheCreationTokensFromBody(nil)
	if ok {
		t.Errorf("expected ok=false for nil body, got tokens=%d", tokens)
	}

	tokens, ok = extractCacheCreationTokensFromBody([]byte(`{}`))
	if ok {
		t.Errorf("expected ok=false for empty JSON, got tokens=%d", tokens)
	}

	tokens, ok = extractCacheCreationTokensFromBody([]byte(`invalid`))
	if ok {
		t.Errorf("expected ok=false for invalid JSON, got tokens=%d", tokens)
	}
}
