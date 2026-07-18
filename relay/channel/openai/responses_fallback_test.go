package openai

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
	// CountTextToken requires the cl100k_base tokenizer; production callers
	// rely on common/init.go running this at startup. Tests bypass that path.
	service.InitTokenEncoders()
}

func setupResponsesTest(t *testing.T, body io.Reader) (*gin.Context, *http.Response, *relaycommon.RelayInfo, *httptest.ResponseRecorder) {
	t.Helper()

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	common.SetContextKey(c, common.RequestIdKey, "test-req-id")

	resp := &http.Response{
		Body: io.NopCloser(body),
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5.5"},
		RelayFormat: types.RelayFormatOpenAI,
	}
	info.SetEstimatePromptTokens(100)

	return c, resp, info, recorder
}

// extractSyntheticEvent walks the recorded SSE output and returns the
// event-name + JSON pair from the LAST `event: response.* / data: {...}`
// block. Returns empty strings if no such block exists.
func extractSyntheticEvent(t *testing.T, recorder *httptest.ResponseRecorder) (string, string) {
	t.Helper()
	body := recorder.Body.String()

	lines := strings.Split(body, "\n")
	var lastEvent, lastData string
	for i := 0; i < len(lines); i++ {
		line := lines[i]
		if strings.HasPrefix(line, "event: ") {
			lastEvent = strings.TrimPrefix(line, "event: ")
			lastEvent = strings.TrimSpace(lastEvent)
		} else if strings.HasPrefix(line, "data: ") {
			lastData = strings.TrimPrefix(line, "data: ")
		}
	}
	return lastEvent, lastData
}

// -------- observe() tests (pure state, no HTTP) --------

func TestResponsesStreamCtx_ObserveTerminalEvents(t *testing.T) {
	t.Parallel()

	for _, terminal := range []string{"response.completed", "response.failed", "response.incomplete"} {
		ctx := newResponsesStreamCtx()
		ctx.observe(dto.ResponsesStreamResponse{Type: terminal})
		assert.True(t, ctx.seenTerminal, "%s must set seenTerminal", terminal)
	}
}

func TestOaiResponsesStreamHandlerStopsAfterTerminalEvent(t *testing.T) {
	body := strings.NewReader(strings.Join([]string{
		`data: {"type":"response.completed","response":{"id":"resp_test","status":"completed","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}`,
		"",
		`data: {"type":"response.output_text.delta","delta":"late event"}`,
		"",
	}, "\n"))
	c, resp, info, recorder := setupResponsesTest(t, body)

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 3, usage.TotalTokens)
	assert.NotContains(t, recorder.Body.String(), "late event")

	snapshot := info.StreamStatus.Snapshot()
	assert.Equal(t, relaycommon.StreamEndReasonDone, snapshot.EndReason)
	assert.Equal(t, "handler_done", snapshot.EndSource)
}

func TestResponsesStreamCtx_ObserveNonTerminalEvents(t *testing.T) {
	t.Parallel()

	ctx := newResponsesStreamCtx()
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.created"})
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.in_progress"})
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.output_text.delta", Delta: "hello"})

	assert.False(t, ctx.seenTerminal)
	assert.Equal(t, len("hello"), ctx.outputTextLen)
	assert.Equal(t, "hello", ctx.outputText.String())
}

func TestResponsesStreamCtx_ObserveAccumulatesReasoning(t *testing.T) {
	t.Parallel()

	ctx := newResponsesStreamCtx()
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.reasoning_text.delta", Delta: "think "})
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.reasoning_summary_text.delta", Delta: "summary"})

	assert.Equal(t, len("think summary"), ctx.reasoningTextLen)
	assert.Equal(t, "think summary", ctx.reasoningText.String())
	assert.Zero(t, ctx.outputTextLen)
}

func TestResponsesStreamCtx_ObserveSnapshotsResponseMetadata(t *testing.T) {
	t.Parallel()

	ctx := newResponsesStreamCtx()
	ctx.observe(dto.ResponsesStreamResponse{
		Type: "response.created",
		Response: &dto.OpenAIResponsesResponse{
			ID:        "resp_abc",
			Model:     "gpt-5.5-2026-03-01",
			CreatedAt: 1700000000,
		},
	})
	ctx.observe(dto.ResponsesStreamResponse{
		Type: "response.in_progress",
		Response: &dto.OpenAIResponsesResponse{
			Usage: &dto.Usage{InputTokens: 42, OutputTokens: 7, TotalTokens: 49},
		},
	})

	assert.Equal(t, "resp_abc", ctx.responseID)
	assert.Equal(t, "gpt-5.5-2026-03-01", ctx.model)
	assert.Equal(t, int64(1700000000), ctx.createdAt)
	require.NotNil(t, ctx.usage)
	assert.Equal(t, 42, ctx.usage.InputTokens)
}

// -------- shouldSynthesize() decision tests --------

func TestResponsesStreamCtx_ShouldSynthesize_SkipsWhenTerminalSeen(t *testing.T) {
	t.Parallel()
	c, _, info, _ := setupResponsesTest(t, strings.NewReader(""))
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)

	ctx := newResponsesStreamCtx()
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.completed"})

	assert.False(t, ctx.shouldSynthesize(c, info))
}

func TestResponsesStreamCtx_ShouldSynthesize_SkipsWhenClientGone(t *testing.T) {
	t.Parallel()
	c, _, info, _ := setupResponsesTest(t, strings.NewReader(""))
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonClientGone, fmt.Errorf("ctx canceled"))

	ctx := newResponsesStreamCtx()
	assert.False(t, ctx.shouldSynthesize(c, info))
}

func TestResponsesStreamCtx_ShouldSynthesize_TrueOnEOFWithoutTerminal(t *testing.T) {
	t.Parallel()
	c, _, info, _ := setupResponsesTest(t, strings.NewReader(""))
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)

	ctx := newResponsesStreamCtx()
	assert.True(t, ctx.shouldSynthesize(c, info))
}

// -------- emitTerminal() output shape tests --------

func TestResponsesStreamCtx_EmitTerminal_CompletedOnGracefulEOFWithOutput(t *testing.T) {
	t.Parallel()
	c, _, info, recorder := setupResponsesTest(t, strings.NewReader(""))
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)

	ctx := newResponsesStreamCtx()
	ctx.observe(dto.ResponsesStreamResponse{
		Type:     "response.created",
		Response: &dto.OpenAIResponsesResponse{ID: "resp_test", Model: "gpt-5.5"},
	})
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.output_text.delta", Delta: "hello world"})

	usage, err := ctx.emitTerminal(c, info)
	require.NoError(t, err)
	require.NotNil(t, usage)
	assert.Greater(t, usage.CompletionTokens, 0, "should estimate output tokens locally")
	assert.Equal(t, 100, usage.PromptTokens, "prompt tokens come from estimate")

	eventName, dataJSON := extractSyntheticEvent(t, recorder)
	assert.Equal(t, "response.completed", eventName)
	require.NotEmpty(t, dataJSON, "must write data JSON")

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(dataJSON, &payload))
	assert.Equal(t, "response.completed", payload["type"])
	response, ok := payload["response"].(map[string]any)
	require.True(t, ok, "response object must be present")
	assert.Equal(t, "resp_test", response["id"])
	assert.Equal(t, "completed", response["status"])
	usagePayload, ok := response["usage"].(map[string]any)
	require.True(t, ok, "usage must be present in synthesized event (Codex requires it)")
	assert.Contains(t, usagePayload, "input_tokens")
	assert.Contains(t, usagePayload, "output_tokens")
	assert.Contains(t, usagePayload, "total_tokens")
}

func TestResponsesStreamCtx_EmitTerminal_FailedOnTimeout(t *testing.T) {
	t.Parallel()
	c, _, info, recorder := setupResponsesTest(t, strings.NewReader(""))
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonTimeout, nil)

	ctx := newResponsesStreamCtx()
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.output_text.delta", Delta: "partial"})

	usage, err := ctx.emitTerminal(c, info)
	require.NoError(t, err)
	require.NotNil(t, usage)

	eventName, dataJSON := extractSyntheticEvent(t, recorder)
	assert.Equal(t, "response.failed", eventName, "non-normal end emits response.failed")

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(dataJSON, &payload))
	response := payload["response"].(map[string]any)
	assert.Equal(t, "failed", response["status"])
	errObj, ok := response["error"].(map[string]any)
	require.True(t, ok, "failed event must carry error object")
	assert.Equal(t, "stream_error", errObj["type"])
	assert.Equal(t, string(relaycommon.StreamEndReasonTimeout), errObj["code"])
	msg, _ := errObj["message"].(string)
	assert.Contains(t, msg, "timeout", "error message should reflect EndReason summary")
}

func TestResponsesStreamCtx_EmitTerminal_FailedWhenNoOutput(t *testing.T) {
	t.Parallel()
	c, _, info, recorder := setupResponsesTest(t, strings.NewReader(""))
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)

	ctx := newResponsesStreamCtx()
	// EOF without any output/reasoning deltas — synthesize failed, not completed
	_, err := ctx.emitTerminal(c, info)
	require.NoError(t, err)

	eventName, _ := extractSyntheticEvent(t, recorder)
	assert.Equal(t, "response.failed", eventName, "no output => failed even on graceful EOF")
}

func TestResponsesStreamCtx_EmitTerminal_PrefersUpstreamUsage(t *testing.T) {
	t.Parallel()
	c, _, info, recorder := setupResponsesTest(t, strings.NewReader(""))
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)

	ctx := newResponsesStreamCtx()
	ctx.observe(dto.ResponsesStreamResponse{
		Type: "response.in_progress",
		Response: &dto.OpenAIResponsesResponse{
			ID:    "resp_x",
			Usage: &dto.Usage{InputTokens: 999, OutputTokens: 888, TotalTokens: 1887},
		},
	})
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.output_text.delta", Delta: "hi"})

	_, err := ctx.emitTerminal(c, info)
	require.NoError(t, err)

	_, dataJSON := extractSyntheticEvent(t, recorder)
	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(dataJSON, &payload))
	usagePayload := payload["response"].(map[string]any)["usage"].(map[string]any)
	assert.EqualValues(t, 999, usagePayload["input_tokens"])
	assert.EqualValues(t, 888, usagePayload["output_tokens"])
	assert.EqualValues(t, 1887, usagePayload["total_tokens"])
}

func TestResponsesStreamCtx_EmitTerminal_ReasoningCountsAsOutput(t *testing.T) {
	t.Parallel()
	c, _, info, recorder := setupResponsesTest(t, strings.NewReader(""))
	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.SetEndReason(relaycommon.StreamEndReasonEOF, nil)

	ctx := newResponsesStreamCtx()
	// Only reasoning deltas — no visible output. We still want response.completed
	// because the client/Codex should preserve reasoning state for the next turn.
	ctx.observe(dto.ResponsesStreamResponse{Type: "response.reasoning_text.delta", Delta: "thinking about this..."})

	_, err := ctx.emitTerminal(c, info)
	require.NoError(t, err)

	eventName, _ := extractSyntheticEvent(t, recorder)
	assert.Equal(t, "response.completed", eventName)
}

func TestResponsesStream_EnsureTerminalOutputFieldAddsMissingOutput(t *testing.T) {
	t.Parallel()

	data := `{"type":"response.completed","response":{"id":"resp_test","status":"completed","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}`
	patched := ensureResponsesTerminalOutputField(dto.ResponsesStreamResponse{
		Type:     "response.completed",
		Response: &dto.OpenAIResponsesResponse{},
	}, data)

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(patched, &payload))
	response := payload["response"].(map[string]any)
	output, ok := response["output"].([]any)
	require.True(t, ok)
	assert.Empty(t, output)
}

func TestResponsesStream_EnsureTerminalOutputFieldPreservesExistingOutput(t *testing.T) {
	t.Parallel()

	data := `{"type":"response.completed","response":{"id":"resp_test","status":"completed","output":[{"type":"message"}]}}`
	patched := ensureResponsesTerminalOutputField(dto.ResponsesStreamResponse{
		Type:     "response.completed",
		Response: &dto.OpenAIResponsesResponse{},
	}, data)

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(patched, &payload))
	response := payload["response"].(map[string]any)
	output, ok := response["output"].([]any)
	require.True(t, ok)
	assert.Len(t, output, 1)
}

func TestResponsesStream_EnsureTerminalOutputFieldIgnoresNonTerminalEvents(t *testing.T) {
	t.Parallel()

	data := `{"type":"response.in_progress","response":{"id":"resp_test","status":"in_progress"}}`
	patched := ensureResponsesTerminalOutputField(dto.ResponsesStreamResponse{
		Type:     "response.in_progress",
		Response: &dto.OpenAIResponsesResponse{},
	}, data)

	assert.Equal(t, data, patched)
}

// -------- Usage payload shape (matches Codex's ResponseCompletedUsage) --------

func TestUsageToResponsesPayload_AllFieldsForCodex(t *testing.T) {
	t.Parallel()

	usage := &dto.Usage{
		InputTokens:  120,
		OutputTokens: 30,
		TotalTokens:  150,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens: 80,
		},
		CompletionTokenDetails: dto.OutputTokenDetails{
			ReasoningTokens: 22,
		},
	}

	payload := usageToResponsesPayload(usage)
	assert.EqualValues(t, 120, payload["input_tokens"])
	assert.EqualValues(t, 30, payload["output_tokens"])
	assert.EqualValues(t, 150, payload["total_tokens"])

	inputDetails, ok := payload["input_tokens_details"].(map[string]any)
	require.True(t, ok)
	assert.EqualValues(t, 80, inputDetails["cached_tokens"])

	outputDetails, ok := payload["output_tokens_details"].(map[string]any)
	require.True(t, ok)
	assert.EqualValues(t, 22, outputDetails["reasoning_tokens"])
}

func TestUsageToResponsesPayload_NilSafe(t *testing.T) {
	t.Parallel()
	payload := usageToResponsesPayload(nil)
	assert.EqualValues(t, 0, payload["input_tokens"])
	assert.EqualValues(t, 0, payload["output_tokens"])
	assert.EqualValues(t, 0, payload["total_tokens"])
}

func TestUsageToResponsesPayload_FallsBackToPromptCompletionTokens(t *testing.T) {
	t.Parallel()
	// Some upstream paths populate PromptTokens/CompletionTokens but leave
	// InputTokens/OutputTokens at zero — make sure we don't write zeroes.
	usage := &dto.Usage{PromptTokens: 50, CompletionTokens: 12}
	payload := usageToResponsesPayload(usage)
	assert.EqualValues(t, 50, payload["input_tokens"])
	assert.EqualValues(t, 12, payload["output_tokens"])
	assert.EqualValues(t, 62, payload["total_tokens"])
}
