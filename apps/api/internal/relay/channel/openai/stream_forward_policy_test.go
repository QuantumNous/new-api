package openai

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The forward policy under test (#426): metadata-only preamble chunks are held
// while failing cleanly is still possible; the first visible token flushes the
// held chunk ahead of itself and everything after goes out immediately.

const roleOnlyChunk = "data: {\"id\":\"c1\",\"object\":\"chat.completion.chunk\",\"created\":1710000000,\"model\":\"gpt-test\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"}}]}\n\n"

func contentChunk(text string) string {
	return "data: {\"id\":\"c1\",\"object\":\"chat.completion.chunk\",\"created\":1710000000,\"model\":\"gpt-test\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"" + text + "\"}}]}\n\n"
}

func newForwardPolicyTest(t *testing.T, upstream string) (contract.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()
	return newStreamTestContext(t, upstream)
}

// TestChunkHasVisibleDelta pins the shared hold/release rule so the fast and
// slow forward paths can never diverge.
func TestChunkHasVisibleDelta(t *testing.T) {
	cases := []struct {
		name  string
		chunk string
		want  bool
	}{
		{"role-only delta", `{"choices":[{"delta":{"role":"assistant"}}]}`, false},
		{"empty delta", `{"choices":[{"delta":{}}]}`, false},
		{"usage-only tail", `{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}`, false},
		{"text delta", `{"choices":[{"delta":{"content":"Hi"}}]}`, true},
		{"reasoning delta", `{"choices":[{"delta":{"reasoning_content":"thinking"}}]}`, true},
		{"tool call delta", `{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"get_weather","arguments":"{}"}}]}}]}`, true},
		{"completions text", `{"choices":[{"text":"Hello"}]}`, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, chunkHasVisibleDelta(tc.chunk))
		})
	}
}

// TestOaiStreamHandlerPreambleDeathStaysByteClean pins the kept guarantee: an
// upstream that dies after only metadata chunks leaves the client byte-clean.
// Retryability itself is governed by FirstResponseTime-on-receipt semantics
// that predate #426: one received chunk already flips HasSendResponse, so the
// old pipeline never actually bought a clean retry here either.
func TestOaiStreamHandlerPreambleDeathStaysByteClean(t *testing.T) {
	upstream := roleOnlyChunk
	c, recorder, resp, info := newForwardPolicyTest(t, upstream)

	usage, apiErr := OaiStreamHandler(c, info, resp)
	require.NotNil(t, apiErr, "died before finish_reason: must error")
	require.Nil(t, usage)
	body := recorder.Body.String()
	require.NotContains(t, body, `"role":"assistant"`,
		"held preamble must be discarded on failure")
	require.NotContains(t, body, "data: [DONE]",
		"a failed stream must not look complete")
}

// TestOaiStreamHandlerFirstVisibleTokenFlushesHeldPreamble pins the latency
// fix: the first visible token is forwarded together with the held preamble
// the moment it arrives — it never waits for a following chunk.
func TestOaiStreamHandlerFirstVisibleTokenFlushesHeldPreamble(t *testing.T) {
	upstream := roleOnlyChunk + contentChunk("He")
	c, recorder, resp, info := newForwardPolicyTest(t, upstream)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr, "delivered partial output must be settled")
	require.NotNil(t, usage)
	body := recorder.Body.String()
	roleIdx := strings.Index(body, `"role":"assistant"`)
	contentIdx := strings.Index(body, `"content":"He"`)
	require.GreaterOrEqual(t, roleIdx, 0, "held preamble flushed ahead of first token")
	require.GreaterOrEqual(t, contentIdx, 0, "first visible token forwarded immediately")
	require.Less(t, roleIdx, contentIdx, "preamble precedes the first token")
	require.Contains(t, body, `data: {"error":`)
	require.Equal(t, "upstream", info.StreamCutOverride)
}

// TestOaiStreamHandlerTailUsageChunkForwarded documents the accepted trade-off:
// the trailing usage-only chunk now reaches clients that did not ask for
// include_usage, because holding it back would re-introduce the pipeline delay.
func TestOaiStreamHandlerTailUsageChunkForwarded(t *testing.T) {
	upstream := roleOnlyChunk + contentChunk("Hi") +
		"data: {\"id\":\"c1\",\"object\":\"chat.completion.chunk\",\"created\":1710000000,\"model\":\"gpt-test\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":7,\"completion_tokens\":3,\"total_tokens\":10}}\n" +
		"data: [DONE]\n\n"
	c, recorder, resp, info := newForwardPolicyTest(t, upstream)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr, "complete stream must succeed")
	require.NotNil(t, usage)
	assert.Equal(t, 7, usage.PromptTokens)
	assert.Equal(t, 3, usage.CompletionTokens)

	body := recorder.Body.String()
	require.Contains(t, body, `"finish_reason":"stop"`, "terminal chunk forwarded inline")
	require.Contains(t, body, "data: [DONE]")
	assert.NotContains(t, body, `"prompt_tokens": 7`+"\n", "no synthetic duplicate usage block")
}

// TestOaiStreamHandlerSingleVisibleChunkDeathStreamsPartialAnswer documents the
// second accepted trade-off: a stream that dies right after its first visible
// chunk has already streamed those bytes to the client, so the failure surfaces
// as an in-band error event instead of a clean retry.
func TestOaiStreamHandlerSingleVisibleChunkDeathStreamsPartialAnswer(t *testing.T) {
	c, recorder, resp, info := newForwardPolicyTest(t, contentChunk("Hi"))

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr, "delivered partial output must be settled")
	require.NotNil(t, usage)
	require.Equal(t, "upstream", info.StreamCutOverride)
	body := recorder.Body.String()
	require.Contains(t, body, `"content":"Hi"`)
	require.Contains(t, body, `data: {"error":`)
	require.NotContains(t, body, "data: [DONE]")
}
