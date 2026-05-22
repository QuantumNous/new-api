package codex

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestToCompatChatRequest_MapsBasicFields(t *testing.T) {
	streamTrue := true
	temp := 0.7
	topP := 0.9
	maxTok := uint(1024)

	req := &dto.GeneralOpenAIRequest{
		Model:           "gpt-5",
		Stream:          &streamTrue,
		Temperature:     &temp,
		TopP:            &topP,
		MaxTokens:       &maxTok,
		ReasoningEffort: "high",
		Messages: []dto.Message{
			{Role: "system", Content: json.RawMessage(`"hello sys"`)},
			{Role: "user", Content: json.RawMessage(`"hello user"`)},
		},
	}

	out, err := ToCompatChatRequest(req)
	require.NoError(t, err)
	assert.Equal(t, "gpt-5", out.Model)
	assert.True(t, out.Stream)
	require.NotNil(t, out.Temperature)
	assert.Equal(t, 0.7, *out.Temperature)
	require.NotNil(t, out.TopP)
	assert.Equal(t, 0.9, *out.TopP)
	require.NotNil(t, out.MaxTokens)
	assert.Equal(t, 1024, *out.MaxTokens)
	assert.Equal(t, "high", out.ReasoningEffort)
	require.Len(t, out.Messages, 2)
	assert.Equal(t, "system", out.Messages[0].Role)
	assert.Equal(t, "user", out.Messages[1].Role)
}

func TestToCompatChatRequest_StreamNilTreatedAsFalse(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model:    "m",
		Messages: []dto.Message{{Role: "user", Content: json.RawMessage(`"hi"`)}},
	}
	out, err := ToCompatChatRequest(req)
	require.NoError(t, err)
	assert.False(t, out.Stream)
}

func TestApplyCodexConstraints_StripsBannedFields(t *testing.T) {
	temp := 0.7
	topP := 0.9
	maxOut := 1024

	req := &apicompat.ResponsesRequest{
		Model:           "gpt-5",
		MaxOutputTokens: &maxOut,
		Temperature:     &temp,
		TopP:            &topP,
	}

	applyCodexConstraints(req, nil)

	assert.Nil(t, req.MaxOutputTokens)
	assert.Nil(t, req.Temperature)
	assert.Nil(t, req.TopP)
	require.NotNil(t, req.Store)
	assert.False(t, *req.Store)
	assert.True(t, req.Stream)
	// Instructions: 空 info 时应保持空字符串
	assert.Equal(t, "", req.Instructions)
}

func TestRelayChatOverCodex_StreamPath_BasicText(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstreamSSE := strings.Join([]string{
		`event: response.created`,
		`data: {"type":"response.created","response":{"id":"resp_1"}}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":"Hello"}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":" world"}`,
		``,
		`event: response.completed`,
		`data: {"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":3,"output_tokens":2}}}`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte(upstreamSSE))),
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		UserWantsStream: true,
		IsStream:        true,
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
	}

	_, apiErr := RelayChatOverCodex(c, info, resp)
	require.Nil(t, apiErr)

	body := rec.Body.String()
	assert.Contains(t, body, `"role":"assistant"`)
	assert.Contains(t, body, "Hello")
	assert.Contains(t, body, "world")
	assert.Contains(t, body, `"finish_reason":"stop"`)
	assert.Contains(t, body, "[DONE]")
}

func TestRelayChatOverCodex_NonStream_AggregatesAndReturnsJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	upstreamSSE := strings.Join([]string{
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":"Hello "}`,
		``,
		`event: response.output_text.delta`,
		`data: {"type":"response.output_text.delta","output_index":0,"delta":"world"}`,
		``,
		`event: response.completed`,
		`data: {"type":"response.completed","response":{"id":"resp_1","usage":{"input_tokens":5,"output_tokens":2}}}`,
		``,
	}, "\n")

	resp := &http.Response{
		StatusCode: 200,
		Header:     make(http.Header),
		Body:       io.NopCloser(bytes.NewReader([]byte(upstreamSSE))),
	}
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		UserWantsStream: false,
		IsStream:        true,
		ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: "gpt-5"},
	}

	_, apiErr := RelayChatOverCodex(c, info, resp)
	require.Nil(t, apiErr)

	body := rec.Body.String()
	assert.NotContains(t, body, "data: ")
	assert.Contains(t, body, `"choices"`)
	assert.Contains(t, body, "Hello world")
}
