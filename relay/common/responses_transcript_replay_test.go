package common

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func resetResponsesTranscriptReplayCacheForTest(t *testing.T) {
	t.Helper()
	responsesTranscriptReplayMu.Lock()
	responsesTranscriptReplayCache = map[string]responsesTranscriptReplayCacheEntry{}
	responsesTranscriptReplayMu.Unlock()
}

func TestResponsesTranscriptReplayBuildPreservesPreviousResponseIDForIncrementalRetry(t *testing.T) {
	resetResponsesTranscriptReplayCacheForTest(t)

	info := &RelayInfo{ChannelMeta: &ChannelMeta{ChannelId: 12, UpstreamModelName: "gpt-5"}}
	request := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-1",
		"previous_response_id":"resp_1",
		"input":[
			{"type":"reasoning","encrypted_content":"bad-ciphertext","summary":[]},
			{"type":"message","role":"user","content":"second"}
		]
	}`)
	PrepareResponsesTranscriptReplay(info, request)
	replayBody, ok, reason := BuildResponsesTranscriptReplayRequest(info, request)
	require.True(t, ok, reason)
	require.Equal(t, "resp_1", gjson.GetBytes(replayBody, "previous_response_id").String())
	require.Len(t, gjson.GetBytes(replayBody, "input").Array(), 1)
	require.Equal(t, "second", gjson.GetBytes(replayBody, "input.0.content").String())
	require.Contains(t, reason, "using incremental previous_response_id")
	require.Contains(t, reason, "removed reasoning items")
}

func TestResponsesTranscriptReplayCommitExtendsCachedTranscript(t *testing.T) {
	resetResponsesTranscriptReplayCacheForTest(t)

	info := &RelayInfo{ChannelMeta: &ChannelMeta{ChannelId: 12, UpstreamModelName: "gpt-5"}}
	firstRequest := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-2",
		"input":[{"type":"message","role":"user","content":"first"}]
	}`)
	PrepareResponsesTranscriptReplay(info, firstRequest)
	ObserveResponsesTranscriptReplayResponseBody(info, []byte(`{
		"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first answer"}]}]
	}`))
	require.True(t, CommitResponsesTranscriptReplay(info))

	secondRequest := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-2",
		"previous_response_id":"resp_1",
		"input":[{"type":"message","role":"user","content":"second"}]
	}`)
	PrepareResponsesTranscriptReplay(info, secondRequest)
	ObserveResponsesTranscriptReplayResponseBody(info, []byte(`{
		"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"second answer"}]}]
	}`))
	require.True(t, CommitResponsesTranscriptReplay(info))

	cachedInput, ok := getResponsesTranscriptReplayCachedInput(info.ResponsesTranscriptReplay.CacheKey)
	require.True(t, ok)
	require.Len(t, gjson.Parse(cachedInput).Array(), 4)
	require.Equal(t, "first", gjson.Get(cachedInput, "0.content").String())
	require.Equal(t, "first answer", gjson.Get(cachedInput, "1.content.0.text").String())
	require.Equal(t, "second", gjson.Get(cachedInput, "2.content").String())
	require.Equal(t, "second answer", gjson.Get(cachedInput, "3.content.0.text").String())
}

func TestResponsesTranscriptReplayIncrementalKeepsPreviousResponseID(t *testing.T) {
	replayBody, ok, reason := BuildResponsesTranscriptReplayRequest(&RelayInfo{}, []byte(`{
		"model":"gpt-5",
		"previous_response_id":"resp_1",
		"input":[
			{"type":"message","role":"user","content":"first"},
			{"type":"reasoning","encrypted_content":"bad-ciphertext","summary":[]},
			{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first answer"}]},
			{"type":"message","role":"user","content":"second"}
		]
	}`))
	require.True(t, ok, reason)
	require.Equal(t, "resp_1", gjson.GetBytes(replayBody, "previous_response_id").String())
	require.Len(t, gjson.GetBytes(replayBody, "input").Array(), 3)
	require.Equal(t, "message", gjson.GetBytes(replayBody, "input.1.type").String())
	require.Contains(t, reason, "removed reasoning items")
}

func TestResponsesTranscriptReplayWithoutPreviousResponseIDStripsEncryptedContent(t *testing.T) {
	replayBody, ok, reason := BuildResponsesTranscriptReplayRequest(&RelayInfo{}, []byte(`{
		"model":"gpt-5",
		"input":[
			{"type":"message","role":"user","content":"first"},
			{"type":"reasoning","encrypted_content":"bad-ciphertext","summary":[]},
			{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first answer"}]},
			{"type":"message","role":"user","content":"second"}
		]
	}`))
	require.True(t, ok, reason)
	require.False(t, gjson.GetBytes(replayBody, "previous_response_id").Exists())
	require.Len(t, gjson.GetBytes(replayBody, "input").Array(), 3)
	require.Equal(t, "message", gjson.GetBytes(replayBody, "input.1.type").String())
	require.Contains(t, reason, "stripped encrypted_content")
	require.Contains(t, reason, "removed reasoning items")
}

func TestResponsesTranscriptReplayCacheDropsReasoningItems(t *testing.T) {
	resetResponsesTranscriptReplayCacheForTest(t)

	info := &RelayInfo{ChannelMeta: &ChannelMeta{ChannelId: 12, UpstreamModelName: "gpt-5"}}
	firstRequest := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-reasoning",
		"input":[{"type":"message","role":"user","content":"first"}]
	}`)
	PrepareResponsesTranscriptReplay(info, firstRequest)
	ObserveResponsesTranscriptReplayResponseBody(info, []byte(`{
		"output":[
			{"type":"reasoning","encrypted_content":"large-ciphertext","summary":[]},
			{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first answer"}]}
		]
	}`))
	require.True(t, CommitResponsesTranscriptReplay(info))

	cachedInput, ok := getResponsesTranscriptReplayCachedInput(info.ResponsesTranscriptReplay.CacheKey)
	require.True(t, ok)
	require.Len(t, gjson.Parse(cachedInput).Array(), 2)
	require.Equal(t, "first", gjson.Get(cachedInput, "0.content").String())
	require.Equal(t, "first answer", gjson.Get(cachedInput, "1.content.0.text").String())
	for _, item := range gjson.Parse(cachedInput).Array() {
		require.NotEqual(t, "reasoning", item.Get("type").String())
		require.False(t, item.Get("encrypted_content").Exists())
	}
}

func TestResponsesTranscriptReplayRequestHasEncryptedContent(t *testing.T) {
	require.True(t, ResponsesTranscriptReplayRequestHasEncryptedContent([]byte(`{
		"input":[{"type":"reasoning","encrypted_content":"bad-ciphertext","summary":[]}]
	}`)))
	require.False(t, ResponsesTranscriptReplayRequestHasEncryptedContent([]byte(`{
		"input":[{"type":"reasoning","summary":[]}]
	}`)))
}

func TestSanitizeResponsesTranscriptInitialRequestStripsOversizedFullInput(t *testing.T) {
	largeEncryptedContent := strings.Repeat("x", responsesTranscriptPreflightSanitizeMinBytes)
	body := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-large",
		"input":[
			{"type":"message","role":"user","content":"first"},
			{"type":"reasoning","encrypted_content":"` + largeEncryptedContent + `","summary":[]},
			{"type":"message","role":"assistant","content":[{"type":"output_text","text":"answer"}]},
			{"type":"function_call","call_id":"call-1","name":"tool","arguments":"{}"},
			{"type":"message","role":"user","content":"second"}
		]
	}`)

	sanitized, ok, reason := SanitizeResponsesTranscriptInitialRequest(body)
	require.True(t, ok, reason)
	require.False(t, gjson.GetBytes(sanitized, "previous_response_id").Exists())
	require.Len(t, gjson.GetBytes(sanitized, "input").Array(), 4)
	require.False(t, ResponsesTranscriptReplayRequestHasEncryptedContent(sanitized))
	require.Contains(t, reason, "sanitized oversized full input transcript")
	require.Contains(t, reason, "removed reasoning items")
	require.Less(t, len(sanitized), len(body)/10)
}

func TestSanitizeResponsesTranscriptInitialRequestStripsHistoricalImagesBeforeLatestUserImage(t *testing.T) {
	historicalImage := "data:image/png;base64," + strings.Repeat("a", responsesTranscriptPreflightSanitizeMinBytes)
	latestImage := "data:image/png;base64," + strings.Repeat("b", 1024)
	body := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-large-images",
		"input":[
			{"type":"message","role":"user","content":[{"type":"input_text","text":"first"},{"type":"input_image","image_url":"` + historicalImage + `"}]},
			{"type":"message","role":"assistant","content":[{"type":"output_text","text":"answer"}]},
			{"type":"message","role":"user","content":[{"type":"input_text","text":"second"},{"type":"input_image","image_url":"` + latestImage + `"}]}
		]
	}`)

	sanitized, ok, reason := SanitizeResponsesTranscriptInitialRequest(body)
	require.True(t, ok, reason)
	require.Contains(t, reason, "stripped historical inline_images=1")
	require.Less(t, len(sanitized), responsesTranscriptPreflightSanitizeMinBytes)
	require.Equal(t, "input_text", gjson.GetBytes(sanitized, "input.0.content.1.type").String())
	require.Equal(t, responsesTranscriptOmittedImageText, gjson.GetBytes(sanitized, "input.0.content.1.text").String())
	require.Equal(t, "input_image", gjson.GetBytes(sanitized, "input.2.content.1.type").String())
	require.Equal(t, latestImage, gjson.GetBytes(sanitized, "input.2.content.1.image_url").String())
}

func TestSanitizeResponsesTranscriptInitialRequestTrimsOldHistoryWhenImagesAreNotEnough(t *testing.T) {
	body := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-large-text",
		"input":[
			{"type":"message","role":"user","content":"` + strings.Repeat("old", responsesTranscriptPreflightSanitizeMinBytes/3) + `"},
			{"type":"message","role":"assistant","content":[{"type":"output_text","text":"answer"}]},
			{"type":"message","role":"user","content":"latest"}
		]
	}`)

	sanitized, ok, reason := SanitizeResponsesTranscriptInitialRequest(body)
	require.True(t, ok, reason)
	require.Contains(t, reason, "trimmed history_items=")
	require.Less(t, len(sanitized), responsesTranscriptPreflightSanitizeMinBytes)
	require.Len(t, gjson.GetBytes(sanitized, "input").Array(), 1)
	require.Equal(t, "latest", gjson.GetBytes(sanitized, "input.0.content").String())
}

func TestSanitizeResponsesTranscriptInitialRequestKeepsIncrementalRequest(t *testing.T) {
	largeEncryptedContent := strings.Repeat("x", responsesTranscriptPreflightSanitizeMinBytes)
	body := []byte(`{
		"model":"gpt-5",
		"previous_response_id":"resp_1",
		"input":[{"type":"reasoning","encrypted_content":"` + largeEncryptedContent + `","summary":[]}]
	}`)

	sanitized, ok, reason := SanitizeResponsesTranscriptInitialRequest(body)
	require.False(t, ok, reason)
	require.Nil(t, sanitized)
}

func TestResponsesInputLooksFullTranscriptMatchesCompactionMarkers(t *testing.T) {
	require.False(t, responsesInputLooksFullTranscript(json.RawMessage(`[
		{"type":"message","role":"user","content":"hello"},
		{"type":"message","role":"assistant","content":"hi there"},
		{"type":"function_call","call_id":"call-1"},
		{"type":"reasoning","encrypted_content":"summary"}
	]`)))
	require.True(t, responsesInputLooksFullTranscript(json.RawMessage(`[
		{"type":"message","role":"user","content":"hello"},
		{"type":"compaction","encrypted_content":"summary"}
	]`)))
}

func TestInspectResponsesTranscriptRequestShape(t *testing.T) {
	shape := InspectResponsesTranscriptRequestShape([]byte(`{
		"prompt_cache_key":"sess-shape",
		"previous_response_id":"resp_1",
		"input":[
			{"type":"message","role":"assistant","content":"hi"},
			{"type":"function_call","call_id":"call-1"},
			{"type":"custom_tool_call","call_id":"call-2"},
			{"type":"reasoning","encrypted_content":"secret"},
			{"type":"message","role":"user","content":[{"type":"input_text","encrypted_content":"nested"}]},
			{"type":"compaction_summary","encrypted_content":"summary"}
		]
	}`))
	require.True(t, shape.HasPreviousResponseID)
	require.True(t, shape.HasPromptCacheKey)
	require.True(t, shape.InputExists)
	require.True(t, shape.InputIsArray)
	require.Equal(t, 6, shape.InputItems)
	require.True(t, shape.LooksFullTranscript)
	require.True(t, shape.LooksReplacementInput)
	require.Equal(t, 1, shape.CompactionItems)
	require.Equal(t, 1, shape.AssistantMessageItems)
	require.Equal(t, 1, shape.FunctionCallItems)
	require.Equal(t, 1, shape.CustomToolCallItems)
	require.Equal(t, 1, shape.ReasoningItems)
	require.Equal(t, 3, shape.EncryptedContentItems)
	require.Equal(t, 0, shape.InlineImageItems)
}

func TestIsResponsesTranscriptReplayError(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
		want       bool
	}{
		{
			name:       "nested invalid encrypted content code",
			statusCode: 400,
			body:       `{"error":{"code":"invalid_encrypted_content"}}`,
			want:       true,
		},
		{
			name:       "nested thinking signature code",
			statusCode: 400,
			body:       `{"error":{"code":"thinking_signature_invalid"}}`,
			want:       true,
		},
		{
			name:       "top level invalid encrypted content code",
			statusCode: 400,
			body:       `{"code":"invalid_encrypted_content"}`,
			want:       true,
		},
		{
			name:       "message only is ignored",
			statusCode: 400,
			body:       `{"error":{"message":"invalid_encrypted_content"}}`,
			want:       false,
		},
		{
			name:       "wrapped invalid encrypted content code in message",
			statusCode: 400,
			body:       `{"error":{"message":"code: invalid_encrypted_content; message: The encrypted content gAAA...V2ln could not be verified. Reason: Encrypted content could not be decrypted or parsed.","type":"invalid_request_error","param":"","code":"-4003"}}`,
			want:       true,
		},
		{
			name:       "wrapped thinking signature code in message",
			statusCode: 400,
			body:       `{"error":{"message":"code: thinking_signature_invalid; message: encrypted content rejected","type":"invalid_request_error","code":"-4003"}}`,
			want:       true,
		},
		{
			name:       "plain message text with target code is ignored",
			statusCode: 400,
			body:       `{"error":{"message":"upstream returned invalid_encrypted_content","code":"-4003"}}`,
			want:       false,
		},
		{
			name:       "empty nested code falls back to top level code",
			statusCode: 400,
			body:       `{"error":{},"code":"thinking_signature_invalid"}`,
			want:       true,
		},
		{
			name:       "string error falls back to top level code",
			statusCode: 400,
			body:       `{"error":"bad request","code":"invalid_encrypted_content"}`,
			want:       true,
		},
		{
			name:       "previous response error is unrelated",
			statusCode: 404,
			body:       `{"error":{"code":"previous_response_not_found"}}`,
			want:       false,
		},
		{
			name:       "rate limit error is unrelated",
			statusCode: 429,
			body:       `{"error":{"code":"rate_limit_exceeded"}}`,
			want:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsResponsesTranscriptReplayError(tt.statusCode, []byte(tt.body)))
		})
	}
}
