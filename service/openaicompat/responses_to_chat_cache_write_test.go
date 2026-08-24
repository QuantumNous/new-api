package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestResponsesResponseToChatPropagatesCacheWriteTokens(t *testing.T) {
	_, usage, err := ResponsesResponseToChatCompletionsResponse(&dto.OpenAIResponsesResponse{
		Usage: &dto.Usage{
			InputTokens: 100,
			InputTokensDetails: &dto.InputTokenDetails{
				CacheWriteTokens: 80,
			},
		},
	}, "chatcmpl_test")
	if err != nil {
		t.Fatal(err)
	}
	if got := usage.PromptTokensDetails.CacheWriteTokens; got != 80 {
		t.Fatalf("cache_write_tokens = %d, want 80", got)
	}
}
