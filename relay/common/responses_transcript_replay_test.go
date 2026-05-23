package common

import (
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

func TestResponsesInputLooksFullTranscriptMatchesCompactionMarkers(t *testing.T) {
	require.False(t, responsesInputLooksFullTranscript(gjson.Parse(`[
		{"type":"message","role":"user","content":"hello"},
		{"type":"message","role":"assistant","content":"hi there"},
		{"type":"function_call","call_id":"call-1"},
		{"type":"reasoning","encrypted_content":"summary"}
	]`)))
	require.True(t, responsesInputLooksFullTranscript(gjson.Parse(`[
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
	require.Equal(t, 1, shape.CompactionItems)
	require.Equal(t, 1, shape.AssistantMessageItems)
	require.Equal(t, 1, shape.FunctionCallItems)
	require.Equal(t, 1, shape.CustomToolCallItems)
	require.Equal(t, 1, shape.ReasoningItems)
	require.Equal(t, 3, shape.EncryptedContentItems)
}

func TestIsResponsesTranscriptReplayError(t *testing.T) {
	require.True(t, IsResponsesTranscriptReplayError(400, []byte(`{"error":{"code":"invalid_encrypted_content","message":"bad encrypted_content"}}`)))
	require.True(t, IsResponsesTranscriptReplayError(400, []byte(`{"error":{"message":"Invalid signature in thinking block"}}`)))
	require.False(t, IsResponsesTranscriptReplayError(404, []byte(`{"error":{"code":"previous_response_not_found","message":"missing"}}`)))
	require.False(t, IsResponsesTranscriptReplayError(429, []byte(`{"error":{"code":"rate_limit_exceeded","message":"slow down"}}`)))
}
