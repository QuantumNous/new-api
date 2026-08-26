package claude

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLClaudeCountTokens(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeClaudeCountTokens,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.anthropic.com",
		},
	}

	requestURL, err := adaptor.GetRequestURL(info)

	require.NoError(t, err)
	require.Equal(t, "https://api.anthropic.com/v1/messages/count_tokens", requestURL)
}

func TestGetRequestURLClaudeCountTokensWithBetaQuery(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:         relayconstant.RelayModeClaudeCountTokens,
		IsClaudeBetaQuery: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.anthropic.com",
		},
	}

	requestURL, err := adaptor.GetRequestURL(info)

	require.NoError(t, err)
	require.Equal(t, "https://api.anthropic.com/v1/messages/count_tokens?beta=true", requestURL)
}

func TestConvertClaudeCountTokensRequestDropsGenerationFields(t *testing.T) {
	t.Parallel()

	maxTokens := uint(4096)
	temperature := 0.7
	stream := true
	request := &dto.ClaudeRequest{
		Model:             "claude-test",
		System:            "system",
		Messages:          []dto.ClaudeMessage{{Role: "user", Content: "hello"}},
		MaxTokens:         &maxTokens,
		Temperature:       &temperature,
		Stream:            &stream,
		ContextManagement: []byte(`{"edits":[]}`),
		McpServers:        []byte(`[{"type":"url","name":"tools","url":"https://example.com"}]`),
		OutputFormat:      []byte(`{"type":"json_schema","schema":{}}`),
		Speed:             []byte(`"fast"`),
		Tools:             []any{map[string]any{"name": "lookup"}},
	}

	converted, err := (&Adaptor{}).ConvertClaudeCountTokensRequest(nil, nil, request)
	require.NoError(t, err)

	jsonData, err := common.Marshal(converted)
	require.NoError(t, err)
	jsonBody := string(jsonData)
	assert.Contains(t, jsonBody, `"model":"claude-test"`)
	assert.Contains(t, jsonBody, `"messages"`)
	assert.Contains(t, jsonBody, `"tools"`)
	assert.Contains(t, jsonBody, `"context_management"`)
	assert.Contains(t, jsonBody, `"mcp_servers"`)
	assert.Contains(t, jsonBody, `"output_format"`)
	assert.Contains(t, jsonBody, `"speed":"fast"`)
	assert.NotContains(t, jsonBody, "max_tokens")
	assert.NotContains(t, jsonBody, "temperature")
	assert.NotContains(t, jsonBody, "stream")
}

func TestClaudeCountTokensHandlerCopiesNativeResponse(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(`{"input_tokens":2095}`)),
	}

	newAPIError := ClaudeCountTokensHandler(c, resp)

	require.Nil(t, newAPIError)
	require.JSONEq(t, `{"input_tokens":2095}`, recorder.Body.String())
}

func TestClaudeCountTokensHandlerRejectsInvalidResponse(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(`{"input_tokens":-1}`)),
	}

	newAPIError := ClaudeCountTokensHandler(c, resp)

	require.NotNil(t, newAPIError)
	require.Equal(t, types.ErrorTypeClaudeError, newAPIError.GetErrorType())
	require.Equal(t, http.StatusBadGateway, newAPIError.StatusCode)
}
