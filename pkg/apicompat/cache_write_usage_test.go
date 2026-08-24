package apicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestResponsesUsageParsesNativeCacheWriteTokens(t *testing.T) {
	var usage ResponsesUsage
	if err := common.Unmarshal([]byte(`{"input_tokens":100,"input_tokens_details":{"cache_write_tokens":80}}`), &usage); err != nil {
		t.Fatal(err)
	}
	if usage.InputTokensDetails == nil || usage.InputTokensDetails.CacheWriteTokens != 80 {
		t.Fatalf("parsed usage = %#v, want cache_write_tokens=80", usage)
	}
}

func TestCacheWriteTokensPropagateAcrossUsageConversions(t *testing.T) {
	responsesUsage := &ResponsesUsage{
		InputTokens: 100,
		InputTokensDetails: &ResponsesInputTokensDetails{
			CachedTokens:     40,
			CacheWriteTokens: 80,
		},
	}
	chat := ResponsesToChatCompletions(&ResponsesResponse{
		Status: "completed",
		Usage:  responsesUsage,
	}, "gpt-5.6")
	if chat.Usage == nil || chat.Usage.PromptTokensDetails == nil {
		t.Fatal("chat usage details missing")
	}
	if got := chat.Usage.PromptTokensDetails.CacheWriteTokens; got != 80 {
		t.Fatalf("responses to chat cache_write_tokens = %d, want 80", got)
	}

	roundTrip := ChatUsageToResponsesUsage(chat.Usage)
	if roundTrip.InputTokensDetails == nil || roundTrip.InputTokensDetails.CacheWriteTokens != 80 {
		t.Fatalf("chat to responses usage = %#v, want cache_write_tokens=80", roundTrip)
	}
}

func TestResponseCompletedPropagatesCacheWriteTokens(t *testing.T) {
	state := NewResponsesEventToChatState()
	state.IncludeUsage = true
	chunks := ResponsesEventToChatChunks(&ResponsesStreamEvent{
		Type: "response.completed",
		Response: &ResponsesResponse{
			Status: "completed",
			Usage: &ResponsesUsage{
				InputTokens: 100,
				InputTokensDetails: &ResponsesInputTokensDetails{
					CacheWriteTokens: 80,
				},
			},
		},
	}, state)
	if len(chunks) != 2 || chunks[1].Usage == nil || chunks[1].Usage.PromptTokensDetails == nil {
		t.Fatalf("unexpected usage chunks: %#v", chunks)
	}
	if got := chunks[1].Usage.PromptTokensDetails.CacheWriteTokens; got != 80 {
		t.Fatalf("stream cache_write_tokens = %d, want 80", got)
	}
}
