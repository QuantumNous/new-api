package openai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateResponsesReasoningOutput(t *testing.T) {
	tests := []struct {
		name    string
		output  *dto.ResponsesOutput
		wantErr string
	}{
		{
			name:   "valid reasoning id",
			output: &dto.ResponsesOutput{Type: responsesOutputTypeReasoning, ID: "rs_123"},
		},
		{
			name:    "generic item id",
			output:  &dto.ResponsesOutput{Type: responsesOutputTypeReasoning, ID: "item_123"},
			wantErr: `invalid Responses reasoning item id "item_123": expected prefix "rs_"`,
		},
		{
			name:    "missing reasoning id",
			output:  &dto.ResponsesOutput{Type: responsesOutputTypeReasoning},
			wantErr: `invalid Responses reasoning item id "": expected prefix "rs_"`,
		},
		{
			name:   "other output type is unchanged",
			output: &dto.ResponsesOutput{Type: "message", ID: "item_123"},
		},
		{
			name: "nil output",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateResponsesReasoningOutput(tt.output)
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.EqualError(t, err, tt.wantErr)
		})
	}
}

func TestOaiResponsesHandlerRejectsInvalidReasoningItemID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body, err := common.Marshal(dto.OpenAIResponsesResponse{
		Status: []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{Type: responsesOutputTypeReasoning, ID: "item_bad"},
		},
		Usage: &dto.Usage{InputTokens: 1, OutputTokens: 1, TotalTokens: 2},
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}

	usage, apiErr := OaiResponsesHandler(c, &relaycommon.RelayInfo{}, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeBadResponseBody, apiErr.GetErrorCode())
	assert.Contains(t, apiErr.Error(), `"item_bad"`)
	assert.Empty(t, w.Body.String())
}

func TestOaiResponsesStreamHandlerStopsBeforeInvalidReasoningItem(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	body := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress","output":[]}}`,
		"",
		`data: {"type":"response.output_item.added","output_index":0,"item":{"type":"reasoning","id":"item_bad","status":"in_progress"}}`,
		"",
		`data: {"type":"response.output_item.done","output_index":0,"item":{"type":"reasoning","id":"item_bad","status":"completed"}}`,
		"",
		"data: [DONE]",
		"",
	}, "\n")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "responses-reasoning-validation-test")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		DisablePing:     true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeBadResponseBody, apiErr.GetErrorCode())
	assert.Contains(t, apiErr.Error(), `"item_bad"`)
	assert.Contains(t, w.Body.String(), `"response.created"`)
	assert.NotContains(t, w.Body.String(), `"item_bad"`)
}

func TestOaiResponsesStreamHandlerStopsBeforeInvalidTerminalReasoningItem(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	body := strings.Join([]string{
		`data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress","output":[]}}`,
		"",
		`data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","output":[{"type":"reasoning","id":"item_bad"}]}}`,
		"",
		"data: [DONE]",
		"",
	}, "\n")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "responses-reasoning-validation-terminal-test")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		DisablePing:     true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadGateway, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeBadResponseBody, apiErr.GetErrorCode())
	assert.Contains(t, apiErr.Error(), `"item_bad"`)
	assert.Contains(t, w.Body.String(), `"response.created"`)
	assert.NotContains(t, w.Body.String(), `"response.completed"`)
	assert.NotContains(t, w.Body.String(), `"item_bad"`)
}

func TestOaiResponsesStreamHandlerAllowsValidReasoningItemID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	body := strings.Join([]string{
		`data: {"type":"response.output_item.added","output_index":0,"item":{"type":"reasoning","id":"rs_valid","status":"in_progress"}}`,
		"",
		`data: {"type":"response.output_item.done","output_index":0,"item":{"type":"reasoning","id":"rs_valid","status":"completed"}}`,
		"",
		"data: [DONE]",
		"",
	}, "\n")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "responses-reasoning-validation-test")
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		DisablePing:     true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}

	usage, apiErr := OaiResponsesStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Contains(t, w.Body.String(), `"rs_valid"`)
}
