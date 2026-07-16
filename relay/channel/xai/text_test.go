package xai

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestMergeXAIStreamUsagePreservesCachedTokens(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		PromptTokens:     100,
		TotalTokens:      140,
		CompletionTokens: 40,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens: 60,
		},
	}
	mergeXAIStreamUsage(dst, src)
	if dst.PromptTokens != 100 || dst.CompletionTokens != 40 || dst.TotalTokens != 140 {
		t.Fatalf("token totals wrong: %+v", dst)
	}
	if dst.PromptTokensDetails.CachedTokens != 60 {
		t.Fatalf("cached tokens=%d want 60", dst.PromptTokensDetails.CachedTokens)
	}
}

func TestMergeXAIStreamUsageFallbackPromptCacheHit(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		PromptTokens:         80,
		TotalTokens:          100,
		PromptCacheHitTokens: 50,
	}
	mergeXAIStreamUsage(dst, src)
	if dst.PromptTokensDetails.CachedTokens != 50 {
		t.Fatalf("cached tokens=%d want 50", dst.PromptTokensDetails.CachedTokens)
	}
	if dst.CompletionTokens != 20 {
		t.Fatalf("completion=%d want 20", dst.CompletionTokens)
	}
}

func TestMergeXAIStreamUsageFallbackInputDetails(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		PromptTokens: 10,
		TotalTokens:  12,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens: 7,
		},
	}
	mergeXAIStreamUsage(dst, src)
	if dst.PromptTokensDetails.CachedTokens != 7 {
		t.Fatalf("cached tokens=%d want 7", dst.PromptTokensDetails.CachedTokens)
	}
}
