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
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
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
						{InlineData: &dto.GeminiInlineData{MimeType: "image/png", Data: "aGVsbG8="}},
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
	assert.Contains(t, got, `"type":"image_generation_call"`)
	assert.Contains(t, got, `"result":"aGVsbG8="`)
	assert.NotContains(t, got, "data:image/png;base64")
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
	requireOrderedGeminiResponsesSubstrings(t, got,
		`event: response.created`,
		`event: response.output_item.added`,
		`event: response.output_text.delta`,
		`event: response.output_text.done`,
		`event: response.completed`,
	)
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

func TestGeminiImagesToResponsesOutput(t *testing.T) {
	output := []dto.ResponsesOutput{{
		Type: "message",
		ID:   "resp_1_msg_0",
		Role: "assistant",
		Content: []dto.ResponsesOutputContent{{
			Type: "output_text",
			Text: "before\n![image](data:image/png;base64,aGVsbG8=)\nafter",
		}},
	}}

	got := geminiImagesToResponsesOutput("resp_1", output)
	require.Len(t, got, 3)
	assert.Equal(t, "before", got[0].Content[0].Text)
	assert.Equal(t, dto.ResponsesOutputTypeImageGenerationCall, got[1].Type)
	assert.Equal(t, "completed", got[1].Status)
	assert.Equal(t, "aGVsbG8=", got[1].Result)
	assert.Equal(t, "after", got[2].Content[0].Text)
	assert.NotEqual(t, got[0].ID, got[2].ID)
}
