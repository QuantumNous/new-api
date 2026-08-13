package codex

import (
	"testing"

	"github.com/tidwall/gjson"
)

func TestBuildCodexImageUsageMapsAuthoritativeDetails(t *testing.T) {
	imageUsage := gjson.Parse(`{
		"input_tokens": 141,
		"output_tokens": 196,
		"total_tokens": 337,
		"input_tokens_details": {"text_tokens": 21, "image_tokens": 120},
		"output_tokens_details": {"image_tokens": 196}
	}`)

	usage := buildCodexImageUsage(imageUsage, true)

	if usage.PromptTokens != 141 || usage.CompletionTokens != 196 || usage.TotalTokens != 337 {
		t.Fatalf("totals = %+v", usage)
	}
	if usage.PromptTokensDetails.TextTokens != 21 || usage.PromptTokensDetails.ImageTokens != 120 {
		t.Fatalf("input details = %+v", usage.PromptTokensDetails)
	}
	if usage.CompletionTokenDetails.ImageTokens != 196 {
		t.Fatalf("output details = %+v", usage.CompletionTokenDetails)
	}
}

func TestBuildCodexImageUsageKeepsFallbackForMissingOutput(t *testing.T) {
	imageUsage := gjson.Parse(`{"input_tokens": 1200, "output_tokens": 0}`)

	usage := buildCodexImageUsage(imageUsage, true)

	if usage.PromptTokens != 1200 {
		t.Fatalf("prompt tokens = %d, want 1200", usage.PromptTokens)
	}
	if usage.CompletionTokens != defaultCodexImageOutputTokens {
		t.Fatalf("completion tokens = %d, want %d", usage.CompletionTokens, defaultCodexImageOutputTokens)
	}
	if usage.TotalTokens != 1200+defaultCodexImageOutputTokens {
		t.Fatalf("total tokens = %d", usage.TotalTokens)
	}
}
