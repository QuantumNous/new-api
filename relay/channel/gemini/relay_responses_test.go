package gemini

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiResponsesHandlerReturnsOpenAIResponsesJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "gemini-responses-test")

	info := newGeminiResponsesRelayInfo(false)
	payload := dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Role: "model",
					Parts: []dto.GeminiPart{
						{Text: "hello"},
					},
				},
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     2,
			CandidatesTokenCount: 3,
			TotalTokenCount:      5,
		},
	}
	body, err := common.Marshal(payload)
	require.NoError(t, err)

	usage, newAPIError := GeminiResponsesHandler(c, info, &http.Response{
		Body: io.NopCloser(bytes.NewReader(body)),
	})
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 2, usage.PromptTokens)
	assert.Equal(t, 3, usage.CompletionTokens)

	got := recorder.Body.String()
	assert.Contains(t, got, `"object":"response"`)
	assert.Contains(t, got, `"status":"completed"`)
	assert.Contains(t, got, `"type":"output_text"`)
	assert.Contains(t, got, `"text":"hello"`)
	assert.Contains(t, got, `"input_tokens":2`)
	assert.Contains(t, got, `"output_tokens":3`)
	assert.NotContains(t, got, `"choices"`)
	assert.NotContains(t, got, `"candidates"`)
}

func TestGeminiResponsesHandlerClosesBodyOnReadError(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "gemini-responses-read-error-test")

	body := &failingReadCloser{}
	usage, newAPIError := GeminiResponsesHandler(c, newGeminiResponsesRelayInfo(false), &http.Response{Body: body})

	require.Nil(t, usage)
	require.NotNil(t, newAPIError)
	assert.True(t, body.closed)
}

func TestGeminiResponsesStreamHandlerReturnsOpenAIResponsesSSE(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "gemini-responses-stream-test")

	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() { constant.StreamingTimeout = oldStreamingTimeout })

	info := newGeminiResponsesRelayInfo(true)
	first := dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				Content: dto.GeminiChatContent{
					Role: "model",
					Parts: []dto.GeminiPart{
						{Text: "hello"},
					},
				},
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     2,
			CandidatesTokenCount: 3,
			TotalTokenCount:      5,
		},
	}
	stop := "STOP"
	final := dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{
			{
				FinishReason: &stop,
				Content: dto.GeminiChatContent{
					Role:  "model",
					Parts: []dto.GeminiPart{{Text: ""}},
				},
			},
		},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     2,
			CandidatesTokenCount: 3,
			TotalTokenCount:      5,
		},
	}
	firstData, err := common.Marshal(first)
	require.NoError(t, err)
	finalData, err := common.Marshal(final)
	require.NoError(t, err)
	streamBody := strings.Join([]string{
		"data: " + string(firstData),
		"",
		"data: " + string(finalData),
		"",
		"data: [DONE]",
		"",
	}, "\n")

	usage, newAPIError := GeminiResponsesStreamHandler(c, info, &http.Response{
		Body: io.NopCloser(strings.NewReader(streamBody)),
	})
	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	assert.Contains(t, got, `event: response.created`)
	assert.Contains(t, got, `event: response.output_text.delta`)
	assert.Contains(t, got, `"delta":"hello"`)
	assert.Contains(t, got, `event: response.completed`)
	assert.Contains(t, got, `"input_tokens":2`)
	assert.Contains(t, got, `"output_tokens":3`)
	assert.NotContains(t, got, `"choices"`)
	assert.NotContains(t, got, `"candidates"`)
	require.Equal(t, []string{"response.completed"}, geminiResponsesTerminalEvents(t, got))
	requireOrderedGeminiResponsesSubstrings(t, got,
		`event: response.created`,
		`event: response.output_item.added`,
		`event: response.output_text.delta`,
		`event: response.output_text.done`,
		`event: response.completed`,
	)
}

func TestGeminiResponsesStreamHandlerRetriesExactCompletedTerminalAfterWriteFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "gemini-terminal-retry-test")

	stop := "STOP"
	response := dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{{
			FinishReason: &stop,
			Content: dto.GeminiChatContent{
				Role:  "model",
				Parts: []dto.GeminiPart{{Text: "hello"}},
			},
		}},
		UsageMetadata: dto.GeminiUsageMetadata{
			PromptTokenCount:     2,
			CandidatesTokenCount: 3,
			TotalTokenCount:      5,
		},
	}
	data, err := common.Marshal(response)
	require.NoError(t, err)
	streamBody := "data: " + string(data) + "\n\ndata: [DONE]\n\n"
	writer := &failOnceOnGeminiTerminalWriter{ResponseWriter: c.Writer, needle: `"type":"response.completed"`}
	c.Writer = writer
	info := newGeminiResponsesRelayInfo(true)

	usage, apiErr := GeminiResponsesStreamHandler(c, info, &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(streamBody)),
	})
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.True(t, writer.failed, "fixture must fail the first response.completed data write")
	require.Equal(t, 2, usage.PromptTokens)
	require.Equal(t, 3, usage.CompletionTokens)
	require.Equal(t, 5, usage.TotalTokens)

	got := recorder.Body.String()
	require.Equal(t, []string{"response.completed"}, geminiResponsesTerminalEvents(t, got))

	var payload map[string]any
	require.NoError(t, common.UnmarshalJsonStr(geminiResponsesEventData(t, got, "response.completed"), &payload))
	responsePayload, ok := payload["response"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "chatcmpl-gemini-terminal-retry-test", responsePayload["id"])
	require.Equal(t, "completed", responsePayload["status"])
	usagePayload, ok := responsePayload["usage"].(map[string]any)
	require.True(t, ok)
	require.EqualValues(t, 2, usagePayload["input_tokens"])
	require.EqualValues(t, 3, usagePayload["output_tokens"])
	require.EqualValues(t, 5, usagePayload["total_tokens"])
}

func TestGeminiResponsesStreamHandlerTerminatesEarlyErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	oldStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 300
	t.Cleanup(func() { constant.StreamingTimeout = oldStreamingTimeout })

	valid := dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{{
			Content: dto.GeminiChatContent{
				Role:  "model",
				Parts: []dto.GeminiPart{{Text: "partial"}},
			},
		}},
	}
	validData, err := common.Marshal(valid)
	require.NoError(t, err)
	blockReason := "SAFETY"
	promptBlockedData, err := common.Marshal(dto.GeminiChatResponse{
		PromptFeedback: &dto.GeminiChatPromptFeedback{BlockReason: &blockReason},
	})
	require.NoError(t, err)
	emptyData, err := common.Marshal(dto.GeminiChatResponse{})
	require.NoError(t, err)

	tests := []struct {
		name       string
		failure    string
		wantCode   string
		wantReason relaycommon.StreamEndReason
	}{
		{
			name:       "malformed JSON",
			failure:    `{not-json}`,
			wantCode:   "bad_response_body",
			wantReason: relaycommon.StreamEndReasonUpstreamFailed,
		},
		{
			name:       "prompt blocked",
			failure:    string(promptBlockedData),
			wantCode:   "prompt_blocked",
			wantReason: relaycommon.StreamEndReasonTerminalClientError,
		},
		{
			name:       "empty candidates",
			failure:    string(emptyData),
			wantCode:   "empty_response",
			wantReason: relaycommon.StreamEndReasonUpstreamFailed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
			c.Set(common.RequestIdKey, "gemini-responses-error-test")
			info := newGeminiResponsesRelayInfo(true)
			streamBody := strings.Join([]string{
				"data: " + string(validData),
				"",
				"data: " + tt.failure,
				"",
			}, "\n")

			usage, apiErr := GeminiResponsesStreamHandler(c, info, &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(streamBody)),
			})
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			got := recorder.Body.String()
			require.Equal(t, []string{"response.failed"}, geminiResponsesTerminalEvents(t, got))
			require.NotContains(t, got, "event: error")

			var payload map[string]any
			require.NoError(t, common.UnmarshalJsonStr(geminiResponsesEventData(t, got, "response.failed"), &payload))
			response, ok := payload["response"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, "failed", response["status"])
			errorPayload, ok := response["error"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, tt.wantCode, errorPayload["code"])
			require.Equal(t, tt.wantReason, info.StreamStatus.Snapshot().EndReason)
		})
	}
}

func TestGeminiResponsesStreamHandlerRejectsEmptyUpstream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name string
		body string
	}{
		{name: "empty body"},
		{name: "bare done", body: "data: [DONE]\n\n"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
			c.Set(common.RequestIdKey, "gemini-responses-empty-test")

			usage, apiErr := GeminiResponsesStreamHandler(c, newGeminiResponsesRelayInfo(true), &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(tt.body)),
			})
			require.NotNil(t, usage)
			require.NotNil(t, apiErr)
			require.Equal(t, types.ErrorCodeEmptyResponse, apiErr.GetErrorCode())
			require.Empty(t, geminiResponsesTerminalEvents(t, recorder.Body.String()))
		})
	}
}

func TestGeminiResponsesStreamHandlerTreatsPingOnlyStreamAsEmpty(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name string
		body string
	}{
		{name: "EOF"},
		{name: "done", body: "data: [DONE]\n\n"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
			c.Set(common.RequestIdKey, "gemini-ping-only-test")
			require.NoError(t, relayhelper.PingData(c))
			info := newGeminiResponsesRelayInfo(true)

			usage, apiErr := GeminiResponsesStreamHandler(c, info, &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(tt.body)),
			})
			require.Nil(t, apiErr)
			require.NotNil(t, usage)

			got := recorder.Body.String()
			require.Contains(t, got, ": PING")
			require.Equal(t, []string{"response.failed"}, geminiResponsesTerminalEvents(t, got))

			var payload map[string]any
			require.NoError(t, common.UnmarshalJsonStr(geminiResponsesEventData(t, got, "response.failed"), &payload))
			response, ok := payload["response"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, "failed", response["status"])
			errorPayload, ok := response["error"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, string(types.ErrorCodeEmptyResponse), errorPayload["code"])
			require.Equal(t, relaycommon.StreamEndReasonUpstreamFailed, info.StreamStatus.Snapshot().EndReason)
		})
	}
}

func TestGeminiResponsesStreamHandlerRejectsSemanticallyEmptyCandidate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	emptyCandidate, err := common.Marshal(dto.GeminiChatResponse{
		Candidates: []dto.GeminiChatCandidate{{
			Content: dto.GeminiChatContent{Role: "model"},
		}},
	})
	require.NoError(t, err)

	tests := []struct {
		name       string
		terminator string
	}{
		{name: "EOF"},
		{name: "done", terminator: "data: [DONE]\n\n"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
			c.Set(common.RequestIdKey, "gemini-semantic-empty-test")
			info := newGeminiResponsesRelayInfo(true)
			body := "data: " + string(emptyCandidate) + "\n\n" + tt.terminator

			usage, apiErr := GeminiResponsesStreamHandler(c, info, &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(body)),
			})
			require.Nil(t, apiErr)
			require.NotNil(t, usage)

			got := recorder.Body.String()
			require.Contains(t, got, "event: response.created")
			require.Equal(t, []string{"response.failed"}, geminiResponsesTerminalEvents(t, got))

			var payload map[string]any
			require.NoError(t, common.UnmarshalJsonStr(geminiResponsesEventData(t, got, "response.failed"), &payload))
			response, ok := payload["response"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, "failed", response["status"])
			errorPayload, ok := response["error"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, string(types.ErrorCodeEmptyResponse), errorPayload["code"])
			require.Equal(t, relaycommon.StreamEndReasonUpstreamFailed, info.StreamStatus.Snapshot().EndReason)
		})
	}
}

func TestGeminiResponsesStreamHandlerRejectsNilResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	var usage *dto.Usage
	var apiErr *types.NewAPIError
	require.NotPanics(t, func() {
		usage, apiErr = GeminiResponsesStreamHandler(c, newGeminiResponsesRelayInfo(true), nil)
	})
	require.Nil(t, usage)
	require.NotNil(t, apiErr)
}

func newGeminiResponsesRelayInfo(isStream bool) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		IsStream:        isStream,
		RelayMode:       relayconstant.RelayModeResponses,
		RelayFormat:     types.RelayFormatOpenAIResponses,
		RequestURLPath:  "/v1/responses",
		DisablePing:     true,
		OriginModelName: "gemini-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gemini-test",
		},
	}
}

type failingReadCloser struct {
	closed bool
}

type failOnceOnGeminiTerminalWriter struct {
	gin.ResponseWriter
	needle string
	failed bool
}

func (w *failOnceOnGeminiTerminalWriter) Write(data []byte) (int, error) {
	if !w.failed && strings.Contains(string(data), w.needle) {
		w.failed = true
		return 0, io.ErrClosedPipe
	}
	return w.ResponseWriter.Write(data)
}

func (r *failingReadCloser) Read([]byte) (int, error) {
	return 0, errors.New("read failed")
}

func (r *failingReadCloser) Close() error {
	r.closed = true
	return nil
}

func requireOrderedGeminiResponsesSubstrings(t *testing.T, s string, parts ...string) {
	t.Helper()
	offset := 0
	for _, part := range parts {
		idx := strings.Index(s[offset:], part)
		require.NotEqualf(t, -1, idx, "missing %q after byte offset %d", part, offset)
		offset += idx + len(part)
	}
}

func geminiResponsesTerminalEvents(t *testing.T, body string) []string {
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

func geminiResponsesEventData(t *testing.T, body, eventType string) string {
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
