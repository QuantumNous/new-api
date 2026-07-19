package openai

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
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

type cancelOnFlushWriter struct {
	gin.ResponseWriter
	cancel context.CancelFunc
}

type failOnceOnNeedleWriter struct {
	gin.ResponseWriter
	needle string
	failed bool
}

type alwaysFailOnNeedleWriter struct {
	gin.ResponseWriter
	needle string
}

var responsesTestMu sync.Mutex

func (w *cancelOnFlushWriter) Flush() {
	w.ResponseWriter.Flush()
	w.cancel()
}

func (w *failOnceOnNeedleWriter) Write(data []byte) (int, error) {
	if !w.failed && strings.Contains(string(data), w.needle) {
		w.failed = true
		return 0, io.ErrClosedPipe
	}
	return w.ResponseWriter.Write(data)
}

func (w *alwaysFailOnNeedleWriter) Write(data []byte) (int, error) {
	if strings.Contains(string(data), w.needle) {
		return 0, io.ErrClosedPipe
	}
	return w.ResponseWriter.Write(data)
}

func init() {
	gin.SetMode(gin.TestMode)
	// CountTextToken requires the cl100k_base tokenizer; production callers
	// rely on common/init.go running this at startup. Tests bypass that path.
	service.InitTokenEncoders()
}

func setupResponsesTest(t *testing.T, body io.Reader) (*gin.Context, *http.Response, *relaycommon.RelayInfo, *httptest.ResponseRecorder) {
	t.Helper()
	responsesTestMu.Lock()
	t.Cleanup(responsesTestMu.Unlock)

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

func responsesTerminalEvents(t *testing.T, body string) []string {
	t.Helper()

	var events []string
	currentEvent := ""
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, "event: ") {
			currentEvent = strings.TrimSpace(strings.TrimPrefix(line, "event: "))
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		switch currentEvent {
		case "response.completed", "response.failed", "response.incomplete", "error":
			var payload map[string]any
			require.NoError(t, common.UnmarshalJsonStr(strings.TrimPrefix(line, "data: "), &payload))
			require.Equal(t, currentEvent, payload["type"], "SSE event and data.type must match")
			events = append(events, currentEvent)
		}
		currentEvent = ""
	}
	return events
}

func responsesEventData(t *testing.T, body, eventType string) string {
	t.Helper()

	lines := strings.Split(body, "\n")
	for i, line := range lines {
		if strings.TrimSpace(line) != "event: "+eventType {
			continue
		}
		for j := i + 1; j < len(lines); j++ {
			if strings.HasPrefix(lines[j], "event: ") {
				break
			}
			if strings.HasPrefix(lines[j], "data: ") {
				return strings.TrimPrefix(lines[j], "data: ")
			}
		}
	}
	require.FailNowf(t, "missing SSE event data", "event %q not found in %q", eventType, body)
	return ""
}

// -------- observe() tests (pure state, no HTTP) --------

func TestResponsesStreamCtx_ObserveTerminalEvents(t *testing.T) {
	t.Parallel()

	for _, terminal := range []string{"response.completed", "response.failed", "response.incomplete"} {
		ctx := newResponsesStreamCtx()
		ctx.observe(dto.ResponsesStreamResponse{Type: terminal})
		assert.True(t, ctx.seenTerminal, "%s must set seenTerminal", terminal)
	}

	ctx := newResponsesStreamCtx()
	ctx.observe(dto.ResponsesStreamResponse{Type: "error"})
	assert.False(t, ctx.seenTerminal, "a top-level error is not a valid Responses terminal")
}

func TestOaiResponsesStreamHandlerNormalizesTopLevelErrorAsFailedTerminal(t *testing.T) {
	upstreamReader, upstreamWriter := io.Pipe()
	t.Cleanup(func() { _ = upstreamWriter.Close() })
	writeErr := make(chan error, 1)
	go func() {
		_, err := io.WriteString(upstreamWriter, "data: {\"type\":\"error\",\"code\":\"invalid_prompt\",\"message\":\"prompt rejected\",\"param\":\"input\"}\n\n")
		writeErr <- err
	}()

	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(""))
	resp.Body = upstreamReader
	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NoError(t, <-writeErr)
	require.NotNil(t, usage)
	got := recorder.Body.String()
	require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, got))
	require.NotContains(t, got, "event: error")

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, got, "response.failed"), &payload))
	assert.Equal(t, "response.failed", payload["type"])
	response, ok := payload["response"].(map[string]any)
	require.True(t, ok)
	assert.NotEmpty(t, response["id"])
	assert.Equal(t, "failed", response["status"])
	errorPayload, ok := response["error"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "invalid_prompt", errorPayload["code"])
	assert.Equal(t, "prompt rejected", errorPayload["message"])
	assert.Equal(t, "input", errorPayload["param"])

	snapshot := info.StreamStatus.Snapshot()
	assert.Equal(t, relaycommon.StreamEndReasonTerminalClientError, snapshot.EndReason)
}

func TestOaiResponsesStreamHandlerCommitsTerminalOnlyAfterSuccessfulWrite(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		`data: {"type":"response.completed","response":{"id":"resp_test","status":"completed","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}`,
		``,
	}, "\n\n")
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))
	writer := &failOnceOnNeedleWriter{ResponseWriter: c.Writer, needle: `"type":"response.completed"`}
	c.Writer = writer

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.True(t, writer.failed, "fixture must fail the first terminal write")
	got := recorder.Body.String()
	require.Equal(t, []string{"response.completed"}, responsesTerminalEvents(t, got))

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, got, "response.completed"), &payload))
	response := payload["response"].(map[string]any)
	require.Equal(t, "resp_test", response["id"])
	usagePayload := response["usage"].(map[string]any)
	require.EqualValues(t, 1, usagePayload["input_tokens"])
	require.EqualValues(t, 2, usagePayload["output_tokens"])
	require.EqualValues(t, 3, usagePayload["total_tokens"])
	require.Equal(t, 1, usage.PromptTokens)
	require.Equal(t, 2, usage.CompletionTokens)
	require.Equal(t, 3, usage.TotalTokens)
}

func TestOaiResponsesStreamHandlerRetriesExactFailedTerminalAfterWriteFailure(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		`data: {"type":"response.failed","response":{"id":"resp_failed","status":"failed","error":{"type":"server_error","code":"server_error","message":"provider failed"},"usage":{"input_tokens":4,"output_tokens":5,"total_tokens":9}}}`,
		``,
	}, "\n\n")
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))
	writer := &failOnceOnNeedleWriter{ResponseWriter: c.Writer, needle: `"type":"response.failed"`}
	c.Writer = writer

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.True(t, writer.failed)
	got := recorder.Body.String()
	require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, got))

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, got, "response.failed"), &payload))
	response := payload["response"].(map[string]any)
	require.Equal(t, "resp_failed", response["id"])
	errorPayload := response["error"].(map[string]any)
	require.Equal(t, "server_error", errorPayload["code"])
	require.Equal(t, "provider failed", errorPayload["message"])
	usagePayload := response["usage"].(map[string]any)
	require.EqualValues(t, 4, usagePayload["input_tokens"])
	require.EqualValues(t, 5, usagePayload["output_tokens"])
	require.EqualValues(t, 9, usagePayload["total_tokens"])
}

func TestOaiResponsesStreamHandlerMalformedChunkEndsWithFailedTerminal(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		`data: {not-json}`,
		``,
	}, "\n\n")
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, recorder.Body.String()))
	require.Equal(t, relaycommon.StreamEndReasonUpstreamFailed, info.StreamStatus.Snapshot().EndReason)
}

func TestOaiResponsesStreamHandlerDeltaWriteFailureEndsWithFailedTerminal(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"first"}`,
		`data: {"type":"response.output_text.delta","delta":"second"}`,
		``,
	}, "\n\n")
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))
	writer := &failOnceOnNeedleWriter{ResponseWriter: c.Writer, needle: `"delta":"second"`}
	c.Writer = writer

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.True(t, writer.failed)
	require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, recorder.Body.String()))
	require.Equal(t, relaycommon.StreamEndReasonInternalError, info.StreamStatus.Snapshot().EndReason)
}

func TestOaiResponsesStreamHandlerNormalizationFailureDoesNotCommitRawTerminal(t *testing.T) {
	body := `data: {"type":"response.completed","ignored":1e10000,"response":{"id":"resp_bad_number","status":"completed"}}` + "\n\n"
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, recorder.Body.String()))
	require.Equal(t, relaycommon.StreamEndReasonUpstreamFailed, info.StreamStatus.Snapshot().EndReason)
}

func TestOaiResponsesStreamHandlerStopsAfterTerminalEvent(t *testing.T) {
	upstreamReader, upstreamWriter := io.Pipe()
	t.Cleanup(func() {
		_ = upstreamWriter.Close()
	})
	payload := strings.Join([]string{
		`data: {"type":"response.completed","response":{"id":"resp_test","status":"completed","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}`,
		"",
		`data: {"type":"response.output_text.delta","delta":"late event"}`,
		"",
	}, "\n")
	writeErr := make(chan error, 1)
	go func() {
		_, err := io.WriteString(upstreamWriter, payload)
		writeErr <- err
	}()

	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(""))
	resp.Body = upstreamReader
	constant.StreamingTimeout = 1

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NoError(t, <-writeErr)
	require.NotNil(t, usage)
	assert.Equal(t, 3, usage.TotalTokens)
	assert.NotContains(t, recorder.Body.String(), "late event")
	require.Equal(t, []string{"response.completed"}, responsesTerminalEvents(t, recorder.Body.String()))

	snapshot := info.StreamStatus.Snapshot()
	assert.Equal(t, relaycommon.StreamEndReasonDone, snapshot.EndReason)
	assert.Equal(t, "handler_done", snapshot.EndSource)
}

func TestOaiResponsesStreamHandlerTerminalFailureWinsImmediateEOF(t *testing.T) {
	body := `data: {"type":"response.failed","response":{"id":"resp_test","status":"failed","error":{"code":"server_error","message":"upstream failed"},"usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}` + "\n\n"
	c, resp, info, _ := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 3, usage.TotalTokens)
	assert.Equal(t, relaycommon.StreamEndReasonUpstreamFailed, info.StreamStatus.Snapshot().EndReason)
}

func TestOaiResponsesStreamHandlerTerminalWinsClientCloseAfterFlush(t *testing.T) {
	body := `data: {"type":"response.completed","response":{"id":"resp_test","status":"completed","usage":{"input_tokens":1,"output_tokens":2,"total_tokens":3}}}` + "\n\n"
	c, resp, info, _ := setupResponsesTest(t, strings.NewReader(body))
	requestCtx, cancel := context.WithCancel(c.Request.Context())
	c.Request = c.Request.WithContext(requestCtx)
	c.Writer = &cancelOnFlushWriter{ResponseWriter: c.Writer, cancel: cancel}

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.Snapshot().EndReason)
}

func TestOaiResponsesStreamHandlerPreservesTerminalUsageAndClassifiesFailure(t *testing.T) {
	tests := []struct {
		name       string
		eventType  string
		status     string
		errorJSON  string
		wantReason relaycommon.StreamEndReason
	}{
		{
			name:       "incomplete is a normal terminal",
			eventType:  "response.incomplete",
			status:     "incomplete",
			wantReason: relaycommon.StreamEndReasonDone,
		},
		{
			name:       "failed is an upstream failure",
			eventType:  "response.failed",
			status:     "failed",
			errorJSON:  `,"error":{"code":"server_error","message":"upstream failed"}`,
			wantReason: relaycommon.StreamEndReasonUpstreamFailed,
		},
		{
			name:       "invalid prompt is a terminal client error",
			eventType:  "response.failed",
			status:     "failed",
			errorJSON:  `,"error":{"type":"invalid_request_error","code":"invalid_prompt","message":"prompt rejected"}`,
			wantReason: relaycommon.StreamEndReasonTerminalClientError,
		},
		{
			name:       "invalid upstream key is a channel failure",
			eventType:  "response.failed",
			status:     "failed",
			errorJSON:  `,"error":{"type":"invalid_request_error","code":"invalid_api_key","message":"bad upstream key"}`,
			wantReason: relaycommon.StreamEndReasonUpstreamFailed,
		},
		{
			name:       "invalid request type classifies unknown semantic code as client error",
			eventType:  "response.failed",
			status:     "failed",
			errorJSON:  `,"error":{"type":"invalid_request_error","code":"unsupported_value","message":"unsupported parameter value"}`,
			wantReason: relaycommon.StreamEndReasonTerminalClientError,
		},
		{
			name:       "unknown failure defaults to channel failure",
			eventType:  "response.failed",
			status:     "failed",
			errorJSON:  `,"error":{"code":"provider_unknown_failure","message":"unknown"}`,
			wantReason: relaycommon.StreamEndReasonUpstreamFailed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := fmt.Sprintf(
				"data: {\"type\":%q,\"response\":{\"id\":\"resp_test\",\"status\":%q,\"usage\":{\"input_tokens\":11,\"output_tokens\":7,\"total_tokens\":18,\"input_tokens_details\":{\"cached_tokens\":3},\"output_tokens_details\":{\"reasoning_tokens\":5}}%s}}\n\n",
				tt.eventType,
				tt.status,
				tt.errorJSON,
			)
			upstreamReader, upstreamWriter := io.Pipe()
			t.Cleanup(func() { _ = upstreamWriter.Close() })
			writeErr := make(chan error, 1)
			go func() {
				_, err := io.WriteString(upstreamWriter, body)
				writeErr <- err
			}()
			c, resp, info, _ := setupResponsesTest(t, strings.NewReader(""))
			resp.Body = upstreamReader

			usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			require.NoError(t, <-writeErr)
			require.NotNil(t, usage)
			assert.Equal(t, 11, usage.PromptTokens)
			assert.Equal(t, 7, usage.CompletionTokens)
			assert.Equal(t, 18, usage.TotalTokens)
			assert.Equal(t, 3, usage.PromptTokensDetails.CachedTokens)
			assert.Equal(t, 5, usage.CompletionTokenDetails.ReasoningTokens)

			snapshot := info.StreamStatus.Snapshot()
			assert.Equal(t, tt.wantReason, snapshot.EndReason)
		})
	}
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

func TestOaiResponsesStreamHandlerNormalizesIncompleteTerminalEnvelope(t *testing.T) {
	tests := []struct {
		name           string
		data           string
		wantResponseID string
	}{
		{name: "missing response", data: `{"type":"response.completed"}`},
		{name: "null response", data: `{"type":"response.completed","response":null}`},
		{name: "empty response", data: `{"type":"response.completed","response":{}}`},
		{
			name:           "null output and empty usage",
			data:           `{"type":"response.completed","response":{"id":"resp_existing","output":null,"usage":{}}}`,
			wantResponseID: "resp_existing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := "data: " + tt.data + "\n\n"
			c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

			usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			got := recorder.Body.String()
			require.Equal(t, []string{"response.completed"}, responsesTerminalEvents(t, got))

			var payload map[string]any
			require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, got, "response.completed"), &payload))
			assert.Equal(t, "response.completed", payload["type"])
			response, ok := payload["response"].(map[string]any)
			require.True(t, ok)
			if tt.wantResponseID != "" {
				assert.Equal(t, tt.wantResponseID, response["id"])
			} else {
				assert.NotEmpty(t, response["id"])
			}
			assert.Equal(t, "response", response["object"])
			assert.Equal(t, "completed", response["status"])
			_, ok = response["output"].([]any)
			require.True(t, ok, "output must be an array")
			usagePayload, ok := response["usage"].(map[string]any)
			require.True(t, ok, "usage must be an object")
			assert.IsType(t, float64(0), usagePayload["input_tokens"])
			assert.IsType(t, float64(0), usagePayload["output_tokens"])
			assert.IsType(t, float64(0), usagePayload["total_tokens"])
		})
	}
}

func TestOaiResponsesStreamHandlerRejectsNonObjectTerminalResponse(t *testing.T) {
	body := `data: {"type":"response.completed","response":"invalid"}` + "\n\n"
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, recorder.Body.String()))
	require.Equal(t, relaycommon.StreamEndReasonUpstreamFailed, info.StreamStatus.Snapshot().EndReason)
}

func TestOaiResponsesStreamHandlerAddsErrorToIncompleteFailedTerminal(t *testing.T) {
	body := "data: {\"type\":\"response.failed\"}\n\n"
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	got := recorder.Body.String()
	require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, got))

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, got, "response.failed"), &payload))
	response, ok := payload["response"].(map[string]any)
	require.True(t, ok)
	errorPayload, ok := response["error"].(map[string]any)
	require.True(t, ok, "response.failed must carry a parseable error object")
	require.Equal(t, "stream_error", errorPayload["type"])
	require.Equal(t, "upstream_failed", errorPayload["code"])
	require.NotEmpty(t, errorPayload["message"])
}

func TestOaiResponsesStreamHandlerPreservesStringFailedError(t *testing.T) {
	body := `data: {"type":"response.failed","response":{"id":"resp_string_error","error":"prompt rejected"}}` + "\n\n"
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	got := recorder.Body.String()
	require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, got))

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, got, "response.failed"), &payload))
	response := payload["response"].(map[string]any)
	errorPayload := response["error"].(map[string]any)
	require.Equal(t, "prompt rejected", errorPayload["message"])
}

func TestOaiResponsesStreamHandlerTerminalUsageFallsBackToAccumulatedUsage(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.in_progress","response":{"id":"resp_usage","usage":{"input_tokens":10,"output_tokens":2,"total_tokens":12}}}`,
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		`data: {"type":"response.in_progress","response":{"id":"resp_usage","usage":{}}}`,
		`data: {"type":"response.completed","response":{"id":"resp_usage","usage":{}}}`,
		``,
	}, "\n\n")
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, recorder.Body.String(), "response.completed"), &payload))
	usagePayload := payload["response"].(map[string]any)["usage"].(map[string]any)
	require.EqualValues(t, 10, usagePayload["input_tokens"])
	require.EqualValues(t, 2, usagePayload["output_tokens"])
	require.EqualValues(t, 12, usagePayload["total_tokens"])
}

func TestOaiResponsesStreamHandlerMergesAccumulatedUsageDetails(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.in_progress","response":{"id":"resp_usage_details","usage":{"input_tokens":100,"output_tokens":10,"total_tokens":110,"input_tokens_details":{"cached_tokens":40,"cached_creation_tokens":30,"cache_write_tokens":20},"output_tokens_details":{"reasoning_tokens":5}}}}`,
		`data: {"type":"response.in_progress","response":{"id":"resp_usage_details","usage":{}}}`,
		`data: {"type":"response.completed","response":{"id":"resp_usage_details","usage":{"input_tokens_details":{},"output_tokens_details":{}}}}`,
		``,
	}, "\n\n")
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 100, usage.PromptTokens)
	assert.Equal(t, 10, usage.CompletionTokens)
	assert.Equal(t, 110, usage.TotalTokens)
	assert.Equal(t, 40, usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 30, usage.PromptTokensDetails.CachedCreationTokens)
	assert.Equal(t, 20, usage.PromptTokensDetails.CacheWriteTokens)
	assert.Equal(t, 5, usage.CompletionTokenDetails.ReasoningTokens)

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, recorder.Body.String(), "response.completed"), &payload))
	usagePayload := payload["response"].(map[string]any)["usage"].(map[string]any)
	inputDetails := usagePayload["input_tokens_details"].(map[string]any)
	outputDetails := usagePayload["output_tokens_details"].(map[string]any)
	assert.EqualValues(t, 40, inputDetails["cached_tokens"])
	assert.EqualValues(t, 30, inputDetails["cached_creation_tokens"])
	assert.EqualValues(t, 20, inputDetails["cache_write_tokens"])
	assert.EqualValues(t, 5, outputDetails["reasoning_tokens"])
}

func TestOaiResponsesStreamHandlerSyntheticTerminalCanonicalizesAccumulatedUsage(t *testing.T) {
	body := strings.Join([]string{
		`data: {"type":"response.in_progress","response":{"id":"resp_synthetic_usage","usage":{"input_tokens":100,"output_tokens":10,"total_tokens":110,"input_tokens_details":{"cached_tokens":40,"cached_creation_tokens":30,"cache_write_tokens":20},"output_tokens_details":{"reasoning_tokens":5}}}}`,
		`data: {"type":"response.in_progress","response":{"id":"resp_synthetic_usage","usage":{"input_tokens":120}}}`,
		`data: {"type":"response.output_text.delta","delta":"partial"}`,
		``,
	}, "\n\n")
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 120, usage.PromptTokens)
	assert.Equal(t, 10, usage.CompletionTokens)
	assert.Equal(t, 130, usage.TotalTokens)
	assert.Equal(t, 40, usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 30, usage.PromptTokensDetails.CachedCreationTokens)
	assert.Equal(t, 20, usage.PromptTokensDetails.CacheWriteTokens)
	assert.Equal(t, 5, usage.CompletionTokenDetails.ReasoningTokens)

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(responsesEventData(t, recorder.Body.String(), "response.completed"), &payload))
	usagePayload := payload["response"].(map[string]any)["usage"].(map[string]any)
	assert.EqualValues(t, 120, usagePayload["input_tokens"])
	assert.EqualValues(t, 10, usagePayload["output_tokens"])
	assert.EqualValues(t, 130, usagePayload["total_tokens"])
}

func TestOaiResponsesStreamHandlerEmptyUpstreamWritesFailedAndMarksFailure(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "empty body"},
		{name: "bare done", body: "data: [DONE]\n\n"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(tt.body))

			usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			require.Equal(t, []string{"response.failed"}, responsesTerminalEvents(t, recorder.Body.String()))
			require.Equal(t, relaycommon.StreamEndReasonUpstreamFailed, info.StreamStatus.Snapshot().EndReason)
		})
	}
}

func TestOaiResponsesStreamHandlerRecordsPermanentSyntheticTerminalWriteFailure(t *testing.T) {
	body := `data: {"type":"response.output_text.delta","delta":"partial"}` + "\n\n"
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))
	c.Writer = &alwaysFailOnNeedleWriter{ResponseWriter: c.Writer, needle: `"type":"response.completed"`}

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Empty(t, responsesTerminalEvents(t, recorder.Body.String()))
	require.True(t, info.StreamStatus.HasErrors())
	require.NotEqual(t, relaycommon.StreamEndReasonEOF, info.StreamStatus.Snapshot().EndReason)
}

func TestOaiResponsesStreamHandlerRetriesSyntheticTerminalAfterWriteFailure(t *testing.T) {
	body := `data: {"type":"response.output_text.delta","delta":"partial"}` + "\n\n"
	c, resp, info, recorder := setupResponsesTest(t, strings.NewReader(body))
	writer := &failOnceOnNeedleWriter{ResponseWriter: c.Writer, needle: `"type":"response.completed"`}
	c.Writer = writer

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.True(t, writer.failed)
	require.Equal(t, []string{"response.completed"}, responsesTerminalEvents(t, recorder.Body.String()))
	require.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.Snapshot().EndReason)
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
