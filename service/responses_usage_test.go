package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestApplyResponsesUsageCopiesTokenDetails(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		InputTokens:  11,
		OutputTokens: 7,
		TotalTokens:  18,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens:         3,
			CachedCreationTokens: 2,
			TextTokens:           6,
			AudioTokens:          4,
			ImageTokens:          5,
		},
		OutputTokensDetails: &dto.OutputTokenDetails{
			TextTokens:      1,
			AudioTokens:     2,
			ImageTokens:     3,
			ReasoningTokens: 4,
		},
		PromptCacheHitTokens: 3,
		UsageSemantic:        "openai",
		UsageSource:          "upstream",
	}

	ApplyResponsesUsage(dst, src)

	if dst.PromptTokens != 11 || dst.CompletionTokens != 7 || dst.TotalTokens != 18 {
		t.Fatalf("usage tokens = %#v", dst)
	}
	if dst.InputTokensDetails == nil {
		t.Fatal("InputTokensDetails is nil")
	}
	if dst.PromptTokensDetails.CachedTokens != 3 ||
		dst.PromptTokensDetails.CachedCreationTokens != 2 ||
		dst.PromptTokensDetails.TextTokens != 6 ||
		dst.PromptTokensDetails.AudioTokens != 4 ||
		dst.PromptTokensDetails.ImageTokens != 5 {
		t.Fatalf("prompt details = %#v", dst.PromptTokensDetails)
	}
	if dst.CompletionTokenDetails.TextTokens != 1 ||
		dst.CompletionTokenDetails.AudioTokens != 2 ||
		dst.CompletionTokenDetails.ImageTokens != 3 ||
		dst.CompletionTokenDetails.ReasoningTokens != 4 {
		t.Fatalf("completion details = %#v", dst.CompletionTokenDetails)
	}
	if dst.OutputTokensDetails == nil {
		t.Fatal("OutputTokensDetails is nil")
	}
	if dst.OutputTokensDetails.TextTokens != 1 ||
		dst.OutputTokensDetails.AudioTokens != 2 ||
		dst.OutputTokensDetails.ImageTokens != 3 ||
		dst.OutputTokensDetails.ReasoningTokens != 4 {
		t.Fatalf("output details = %#v", dst.OutputTokensDetails)
	}
	if dst.UsageSemantic != "openai" || dst.UsageSource != "upstream" {
		t.Fatalf("usage metadata = %#v", dst)
	}
}

func TestApplyResponsesUsageFallsBackToCompletionTokenDetails(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		CompletionTokenDetails: dto.OutputTokenDetails{
			ReasoningTokens: 9,
		},
	}

	ApplyResponsesUsage(dst, src)

	if dst.CompletionTokenDetails.ReasoningTokens != 9 {
		t.Fatalf("reasoning tokens = %d, want 9", dst.CompletionTokenDetails.ReasoningTokens)
	}
	if dst.OutputTokensDetails == nil {
		t.Fatal("OutputTokensDetails is nil")
	}
	if dst.OutputTokensDetails.ReasoningTokens != 9 {
		t.Fatalf("output reasoning tokens = %d, want 9", dst.OutputTokensDetails.ReasoningTokens)
	}
}
