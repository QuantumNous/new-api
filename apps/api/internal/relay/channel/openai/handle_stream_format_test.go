package openai

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/internal/constant"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/require"
)

// newClaudeFinalizeContext builds a RelayInfo + synthetic contract context for
// driving HandleFinalResponse directly, as OaiStreamHandler would after a clean
// conversion through the Claude path. The recorder backs the context, so every
// ClaudeData write lands in recorder.Body for SSE-level assertions.
func newClaudeFinalizeContext(t *testing.T) (contract.Context, *httptest.ResponseRecorder, *relaycommon.RelayInfo) {
	t.Helper()
	if constant.StreamingTimeout == 0 {
		constant.StreamingTimeout = 30
	}
	c, recorder := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/messages", nil))
	info := relaycommon.GenRelayInfoOpenAI(c, &dto.GeneralOpenAIRequest{Model: "gpt-test"})
	info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"}
	info.IsStream = true
	info.RelayMode = relayconstant.RelayModeChatCompletions
	info.RelayFormat = types.RelayFormatClaude
	info.ShouldIncludeUsage = true
	return c, recorder, info
}

// seedClaudeTextState models the converter state after it forwarded one text
// block and recorded the upstream finish_reason but no usage yet. The host
// finalizer then closes that open block; without the open-block marker (index 0,
// type text) no content_block_stop would be emitted and the stream would be left
// unterminated.
func seedClaudeTextState(info *relaycommon.RelayInfo, finishReason string, sawFinish bool) {
	state := info.EnsureClaudeConvertInfo()
	state.LastMessagesType = convmeta.LastMessageTypeText
	state.Index = 0
	state.FinishReason = finishReason
	info.StreamSawFinishReason = sawFinish
	info.StreamStatus = relaycommon.NewStreamStatus()
}

// requireOrderedClaudeEvents asserts the named Claude SSE events appear in body in
// the given order and that they form the exact terminal sequence (each expected
// once). This protects the observable stream contract: the terminal block must be
// emitted exactly once and in canonical order, not replayed or merged into the
// already-forwarded bytes.
func requireOrderedClaudeEvents(t *testing.T, body string, events ...string) {
	t.Helper()
	idx := 0
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if idx < len(events) && line == "event: "+events[idx] {
			idx++
		}
	}
	require.Equal(t, len(events), idx, "expected Claude events in order %v, got body:\n%s", events, body)
}

// countClaudeEvents counts how many times a given named event appears in body.
func countClaudeEvents(body, event string) int {
	needle := "event: " + event
	count := 0
	for _, line := range strings.Split(body, "\n") {
		if strings.TrimSpace(line) == needle {
			count++
		}
	}
	return count
}

// TestHandleFinalResponseClaudeFinalizesOnceWithUsage pins P1: a complete
// OpenAI→Claude stream whose finish_reason chunk carried no usage is finalized
// exactly once by HandleFinalResponse. The terminal block (content_block_stop,
// message_delta, message_stop) must appear once and in order, the attached usage
// must carry the host-supplied totals, and the already-forwarded text must NOT be
// replayed. The old implementation re-fed lastStreamData through the converter,
// duplicating the final text delta and emitting a second terminal block — this
// test fails that behavior.
func TestHandleFinalResponseClaudeFinalizesOnceWithUsage(t *testing.T) {
	c, recorder, info := newClaudeFinalizeContext(t)
	seedClaudeTextState(info, "stop", true)
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonDone, nil)

	usage := &dto.Usage{PromptTokens: 7, CompletionTokens: 3, TotalTokens: 10}
	HandleFinalResponse(c, info, "", "msg_1", 1710000000, "gpt-test", "fp", usage, false)

	body := recorder.Body.String()
	// Terminal events exactly once, canonical order.
	require.Equal(t, 1, countClaudeEvents(body, "content_block_stop"), "one content_block_stop, got:\n%s", body)
	require.Equal(t, 1, countClaudeEvents(body, "message_delta"), "one message_delta, got:\n%s", body)
	require.Equal(t, 1, countClaudeEvents(body, "message_stop"), "one message_stop, got:\n%s", body)
	requireOrderedClaudeEvents(t, body, "content_block_stop", "message_delta", "message_stop")

	// Usage values are attached, not zeroed or estimated away.
	require.Contains(t, body, `"input_tokens":7`)
	require.Contains(t, body, `"output_tokens":3`)
	// stop_reason derived from the OpenAI finish_reason "stop" -> "end_turn".
	require.Contains(t, body, `"stop_reason":"end_turn"`)

	// Idempotent: a second finalization must emit nothing.
	recorder.Body.Reset()
	HandleFinalResponse(c, info, "", "msg_1", 1710000000, "gpt-test", "fp", usage, false)
	require.Empty(t, recorder.Body.String(), "finalization must be idempotent once Done")
}

// TestHandleFinalResponseClaudeFinishReasonCleanEOF pins the second accepted
// terminator for the Claude path: a finish_reason chunk followed by a clean EOF
// (no [DONE]) is a complete stream. The finalizer must still emit the terminal
// block exactly once with usage, proving the guard does not require the explicit
// done sentinel on the Claude path.
func TestHandleFinalResponseClaudeFinishReasonCleanEOF(t *testing.T) {
	c, recorder, info := newClaudeFinalizeContext(t)
	seedClaudeTextState(info, "stop", true)
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)

	usage := &dto.Usage{PromptTokens: 4, CompletionTokens: 2, TotalTokens: 6}
	HandleFinalResponse(c, info, "", "msg_2", 1710000000, "gpt-test", "fp", usage, false)

	body := recorder.Body.String()
	require.Equal(t, 1, countClaudeEvents(body, "message_stop"))
	requireOrderedClaudeEvents(t, body, "content_block_stop", "message_delta", "message_stop")
	require.Contains(t, body, `"input_tokens":4`)
	require.Contains(t, body, `"output_tokens":2`)
}

// TestHandleFinalResponseClaudeRejectsEOFWithoutFinish pins #394 for the Claude
// path: an EOF that arrives without any finish_reason chunk is a truncated
// stream. The finalizer must NOT emit terminal events — the client already saw
// partial text and must not receive a fabricated clean close.
func TestHandleFinalResponseClaudeRejectsEOFWithoutFinish(t *testing.T) {
	c, recorder, info := newClaudeFinalizeContext(t)
	seedClaudeTextState(info, "", false)
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)

	usage := &dto.Usage{PromptTokens: 1, CompletionTokens: 1, TotalTokens: 2}
	HandleFinalResponse(c, info, "", "msg_3", 1710000000, "gpt-test", "fp", usage, false)

	body := recorder.Body.String()
	require.Equal(t, 0, countClaudeEvents(body, "message_stop"), "truncated stream must not finalize, got:\n%s", body)
	require.Equal(t, 0, countClaudeEvents(body, "message_delta"))
	require.Equal(t, 0, countClaudeEvents(body, "content_block_stop"))
}

// TestHandleFinalResponseClaudeRejectsNonCompletionEndReasons covers the
// rejected-finalization matrix: every non-completion end reason must leave the
// stream un-finalized (no terminal Claude events), because re-emitting terminals
// on an aborted stream would present a partial answer as complete.
func TestHandleFinalResponseClaudeRejectsNonCompletionEndReasons(t *testing.T) {
	rejectedReasons := []relaycommon.StreamEndReason{
		relaycommon.StreamEndReasonClientGone,
		relaycommon.StreamEndReasonScannerErr,
		relaycommon.StreamEndReasonTimeout,
		relaycommon.StreamEndReasonHandlerStop,
		relaycommon.StreamEndReasonPanic,
		relaycommon.StreamEndReasonPingFail,
	}
	for _, reason := range rejectedReasons {
		t.Run(string(reason), func(t *testing.T) {
			// Even when a finish_reason was seen, an abnormal end reason must not
			// finalize: the client connection is already gone or the stream died.
			c, recorder, info := newClaudeFinalizeContext(t)
			seedClaudeTextState(info, "stop", true)
			info.StreamStatus.SetEndReason(reason, nil)

			usage := &dto.Usage{PromptTokens: 1, CompletionTokens: 1, TotalTokens: 2}
			HandleFinalResponse(c, info, "", "msg_x", 1710000000, "gpt-test", "fp", usage, false)

			body := recorder.Body.String()
			require.Equal(t, 0, countClaudeEvents(body, "message_stop"),
				"end reason %s must not finalize, got:\n%s", reason, body)
			require.Equal(t, 0, countClaudeEvents(body, "message_delta"))
		})
	}
}
