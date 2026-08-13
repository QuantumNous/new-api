package gemini

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestBuildUsageFromGeminiMetadataMapsImageOutputTokens(t *testing.T) {
	usage := buildUsageFromGeminiMetadata(dto.GeminiUsageMetadata{
		PromptTokenCount:     25,
		CandidatesTokenCount: 1300,
		TotalTokenCount:      1325,
		CandidatesTokensDetails: []dto.GeminiPromptTokensDetails{
			{Modality: "IMAGE", TokenCount: 1280},
			{Modality: "TEXT", TokenCount: 20},
		},
	}, 0)

	if usage.PromptTokens != 25 || usage.CompletionTokens != 1300 || usage.TotalTokens != 1325 {
		t.Fatalf("totals = %+v", usage)
	}
	if usage.CompletionTokenDetails.ImageTokens != 1280 {
		t.Fatalf("image output tokens = %d, want 1280", usage.CompletionTokenDetails.ImageTokens)
	}
}

func TestShouldEstimateGeminiStreamTextUsageSkipsImageResponses(t *testing.T) {
	usage := &dto.Usage{}
	if shouldEstimateGeminiStreamTextUsage(usage, 1) {
		t.Fatal("image response without metadata must not receive synthetic text/image tokens")
	}
	if !shouldEstimateGeminiStreamTextUsage(usage, 0) {
		t.Fatal("text-only response without usage should retain the existing text estimate fallback")
	}
}
