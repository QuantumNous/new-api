package newapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdaptorMultiprotocolRequestURLs(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		relayMode  int
		wantSuffix string
	}{
		{name: "OpenAI chat", path: "/v1/chat/completions", relayMode: relayconstant.RelayModeChatCompletions, wantSuffix: "/v1/chat/completions"},
		{name: "Responses", path: "/v1/responses", relayMode: relayconstant.RelayModeResponses, wantSuffix: "/v1/responses"},
		{name: "Compact", path: "/v1/responses/compact", relayMode: relayconstant.RelayModeResponsesCompact, wantSuffix: "/v1/responses/compact"},
		{name: "Claude", path: "/v1/messages", relayMode: relayconstant.RelayModeChatCompletions, wantSuffix: "/v1/messages"},
		{name: "Gemini", path: "/v1beta/models/gemini-test:generateContent", relayMode: relayconstant.RelayModeGemini, wantSuffix: "/v1beta/models/gemini-test:generateContent"},
		{name: "Alpha search", path: "/ignored", relayMode: relayconstant.RelayModeAlphaSearch, wantSuffix: "/v1/alpha/search"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
				ChannelType: constant.ChannelTypeNewAPI, ChannelBaseUrl: "https://new-api.example",
			}, RequestURLPath: tt.path, RelayMode: tt.relayMode}
			got, err := (&Adaptor{}).GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, "https://new-api.example"+tt.wantSuffix, got)
		})
	}
}

func TestAdaptorMapsNativeGeminiModelInRequestURL(t *testing.T) {
	tests := []struct {
		name string
		path string
		want string
	}{
		{
			name: "generate",
			path: "/v1beta/models/client-model:generateContent",
			want: "https://new-api.example/v1beta/models/upstream-model:generateContent",
		},
		{
			name: "stream with query",
			path: "/v1/models/client-model:streamGenerateContent?alt=sse",
			want: "https://new-api.example/v1/models/upstream-model:streamGenerateContent?alt=sse",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayFormat:    types.RelayFormatGemini,
				RequestURLPath: tt.path,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:       constant.ChannelTypeNewAPI,
					ChannelBaseUrl:    "https://new-api.example",
					IsModelMapped:     true,
					UpstreamModelName: "upstream-model",
				},
			}
			got, err := (&Adaptor{}).GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestAdaptorMultiprotocolHeadersUseChannelCredential(t *testing.T) {
	tests := []struct {
		name       string
		format     types.RelayFormat
		wantHeader string
	}{
		{name: "OpenAI", format: types.RelayFormatOpenAI},
		{name: "Responses", format: types.RelayFormatOpenAIResponses},
		{name: "Compact", format: types.RelayFormatOpenAIResponsesCompaction},
		{name: "Claude", format: types.RelayFormatClaude, wantHeader: "x-api-key"},
		{name: "Gemini", format: types.RelayFormatGemini, wantHeader: "x-goog-api-key"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
			info := &relaycommon.RelayInfo{RelayFormat: tt.format, ChannelMeta: &relaycommon.ChannelMeta{ApiKey: "user-channel-key"}}
			headers := http.Header{}
			require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &headers, info))
			assert.Equal(t, "Bearer user-channel-key", headers.Get("Authorization"))
			if tt.wantHeader != "" {
				assert.Equal(t, "user-channel-key", headers.Get(tt.wantHeader))
			}
		})
	}
}

func TestAdaptorPreservesClaudeBetaHeader(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	c.Request.Header.Set("anthropic-beta", "prompt-caching-2024-07-31")
	info := &relaycommon.RelayInfo{
		RelayFormat:     types.RelayFormatClaude,
		OriginModelName: "claude-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "user-channel-key",
			UpstreamModelName: "claude-test",
		},
	}
	headers := http.Header{}

	require.NoError(t, (&Adaptor{}).SetupRequestHeader(c, &headers, info))
	assert.Equal(t, "prompt-caching-2024-07-31", headers.Get("anthropic-beta"))
}

func TestAdaptorPreservesNativeProtocolRequests(t *testing.T) {
	adaptor := &Adaptor{}
	chat := &dto.GeneralOpenAIRequest{Model: "gpt-test"}
	convertedChat, err := adaptor.ConvertOpenAIRequest(nil, nil, chat)
	require.NoError(t, err)
	assert.Same(t, chat, convertedChat)

	responses := dto.OpenAIResponsesRequest{Model: "gpt-test"}
	convertedResponses, err := adaptor.ConvertOpenAIResponsesRequest(nil, nil, responses)
	require.NoError(t, err)
	assert.Equal(t, responses, convertedResponses)

	claudeRequest := &dto.ClaudeRequest{Model: "claude-test"}
	convertedClaude, err := adaptor.ConvertClaudeRequest(nil, nil, claudeRequest)
	require.NoError(t, err)
	assert.Same(t, claudeRequest, convertedClaude)

	geminiRequest := &dto.GeminiChatRequest{Contents: []dto.GeminiChatContent{{Role: "user"}}}
	convertedGemini, err := adaptor.ConvertGeminiRequest(nil, nil, geminiRequest)
	require.NoError(t, err)
	assert.Same(t, geminiRequest, convertedGemini)
}
