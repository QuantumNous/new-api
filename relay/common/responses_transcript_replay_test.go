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

func TestResponsesTranscriptReplayBuildUsesCachedTranscript(t *testing.T) {
	resetResponsesTranscriptReplayCacheForTest(t)

	info := &RelayInfo{ChannelMeta: &ChannelMeta{ChannelId: 12, UpstreamModelName: "gpt-5"}}
	firstRequest := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-1",
		"input":[{"type":"message","role":"user","content":"first"}]
	}`)
	PrepareResponsesTranscriptReplay(info, firstRequest)
	ObserveResponsesTranscriptReplayResponseBody(info, []byte(`{
		"output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"first answer"}]}]
	}`))
	require.True(t, CommitResponsesTranscriptReplay(info))

	secondRequest := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-1",
		"previous_response_id":"resp_1",
		"input":[{"type":"message","role":"user","content":"second"}]
	}`)
	PrepareResponsesTranscriptReplay(info, secondRequest)
	replayBody, ok, reason := BuildResponsesTranscriptReplayRequest(info, secondRequest)
	require.True(t, ok, reason)
	require.False(t, gjson.GetBytes(replayBody, "previous_response_id").Exists())
	require.Len(t, gjson.GetBytes(replayBody, "input").Array(), 3)
	require.Equal(t, "first", gjson.GetBytes(replayBody, "input.0.content").String())
	require.Equal(t, "first answer", gjson.GetBytes(replayBody, "input.1.content.0.text").String())
	require.Equal(t, "second", gjson.GetBytes(replayBody, "input.2.content").String())
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

	thirdRequest := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-2",
		"previous_response_id":"resp_2",
		"input":[{"type":"message","role":"user","content":"third"}]
	}`)
	PrepareResponsesTranscriptReplay(info, thirdRequest)
	replayBody, ok, reason := BuildResponsesTranscriptReplayRequest(info, thirdRequest)
	require.True(t, ok, reason)
	require.Len(t, gjson.GetBytes(replayBody, "input").Array(), 5)
	require.Equal(t, "first", gjson.GetBytes(replayBody, "input.0.content").String())
	require.Equal(t, "first answer", gjson.GetBytes(replayBody, "input.1.content.0.text").String())
	require.Equal(t, "second", gjson.GetBytes(replayBody, "input.2.content").String())
	require.Equal(t, "second answer", gjson.GetBytes(replayBody, "input.3.content.0.text").String())
	require.Equal(t, "third", gjson.GetBytes(replayBody, "input.4.content").String())
}

func TestResponsesTranscriptReplayFullTranscriptDeletesPreviousResponseID(t *testing.T) {
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
	require.False(t, gjson.GetBytes(replayBody, "previous_response_id").Exists())
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

	secondRequest := []byte(`{
		"model":"gpt-5",
		"prompt_cache_key":"sess-reasoning",
		"previous_response_id":"resp_1",
		"input":[{"type":"message","role":"user","content":"second"}]
	}`)
	PrepareResponsesTranscriptReplay(info, secondRequest)
	replayBody, ok, reason := BuildResponsesTranscriptReplayRequest(info, secondRequest)
	require.True(t, ok, reason)
	require.Len(t, gjson.GetBytes(replayBody, "input").Array(), 3)
	require.Equal(t, "first", gjson.GetBytes(replayBody, "input.0.content").String())
	require.Equal(t, "first answer", gjson.GetBytes(replayBody, "input.1.content.0.text").String())
	require.Equal(t, "second", gjson.GetBytes(replayBody, "input.2.content").String())
	for _, item := range gjson.GetBytes(replayBody, "input").Array() {
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

func TestIsResponsesTranscriptReplayError(t *testing.T) {
	require.True(t, IsResponsesTranscriptReplayError(400, []byte(`{"error":{"code":"invalid_encrypted_content","message":"bad encrypted_content"}}`)))
	require.True(t, IsResponsesTranscriptReplayError(400, []byte(`{"error":{"message":"Invalid signature in thinking block"}}`)))
	require.False(t, IsResponsesTranscriptReplayError(404, []byte(`{"error":{"code":"previous_response_not_found","message":"missing"}}`)))
	require.False(t, IsResponsesTranscriptReplayError(429, []byte(`{"error":{"code":"rate_limit_exceeded","message":"slow down"}}`)))
}
