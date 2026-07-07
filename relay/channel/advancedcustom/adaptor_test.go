package advancedcustom

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdaptorUsesExactRouteAndQueryAuth(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/messages",
				UpstreamPath: "https://upstream.example/v1/chat/completions?existing=1",
				Converter:    dto.AdvancedCustomConverterAnthropicMessagesToOpenAIChatCompletions,
				Auth: &dto.AdvancedCustomRouteAuth{
					Type:  dto.AdvancedCustomAuthTypeQuery,
					Name:  "api_key",
					Value: "{api_key}",
				},
			},
		},
	})
	info.RequestURLPath = "/v1/messages?client=1"

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)

	parsedURL, err := url.Parse(requestURL)
	require.NoError(t, err)
	assert.Equal(t, "https", parsedURL.Scheme)
	assert.Equal(t, "upstream.example", parsedURL.Host)
	assert.Equal(t, "/v1/chat/completions", parsedURL.Path)
	assert.Equal(t, "1", parsedURL.Query().Get("existing"))
	assert.Equal(t, "sk-test", parsedURL.Query().Get("api_key"))
}

func TestAdaptorJoinsUpstreamPathWithChannelBaseURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "/proxy/v1/chat/completions?existing=1",
				Converter:    dto.AdvancedCustomConverterNone,
				Auth: &dto.AdvancedCustomRouteAuth{
					Type:  dto.AdvancedCustomAuthTypeQuery,
					Name:  "api_key",
					Value: "{api_key}",
				},
			},
		},
	})
	info.ChannelBaseUrl = "https://gateway.example/base"

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)

	parsedURL, err := url.Parse(requestURL)
	require.NoError(t, err)
	assert.Equal(t, "https", parsedURL.Scheme)
	assert.Equal(t, "gateway.example", parsedURL.Host)
	assert.Equal(t, "/base/proxy/v1/chat/completions", parsedURL.Path)
	assert.Equal(t, "1", parsedURL.Query().Get("existing"))
	assert.Equal(t, "sk-test", parsedURL.Query().Get("api_key"))
}

func TestAdaptorReturnsErrorWhenUpstreamPathNeedsMissingBaseURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "/v1/chat/completions",
				Converter:    dto.AdvancedCustomConverterNone,
			},
		},
	})
	info.ChannelBaseUrl = ""

	_, err := adaptor.GetRequestURL(info)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "base URL is required")
}

func TestAdaptorSetupRequestHeaderUsesDefaultBearerAuth(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "https://upstream.example/v1/chat/completions",
				Converter:    dto.AdvancedCustomConverterNone,
			},
		},
	})
	c := advancedCustomGinContext("/v1/chat/completions")
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t, "Bearer sk-test", header.Get("Authorization"))
}

func TestAdaptorSetupRequestHeaderUsesConfiguredHeaderAuth(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "https://upstream.example/v1/chat/completions",
				Converter:    dto.AdvancedCustomConverterNone,
				Auth: &dto.AdvancedCustomRouteAuth{
					Type:  dto.AdvancedCustomAuthTypeHeader,
					Name:  "x-api-key",
					Value: "{api_key}",
				},
			},
		},
	})
	c := advancedCustomGinContext("/v1/chat/completions")
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Empty(t, header.Get("Authorization"))
	assert.Equal(t, "sk-test", header.Get("x-api-key"))
}

func TestAdaptorSetupRequestHeaderAddsClaudeDefaultHeaders(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/messages",
				UpstreamPath: "https://api.anthropic.com/v1/messages",
				Converter:    dto.AdvancedCustomConverterNone,
				Auth: &dto.AdvancedCustomRouteAuth{
					Type:  dto.AdvancedCustomAuthTypeHeader,
					Name:  "x-api-key",
					Value: "{api_key}",
				},
			},
		},
	})
	info.RelayFormat = types.RelayFormatClaude
	c := advancedCustomGinContext("/v1/messages")
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t, "sk-test", header.Get("x-api-key"))
	assert.Equal(t, "2023-06-01", header.Get("anthropic-version"))
}

func TestAdaptorReturnsErrorWhenNoRouteMatchesPath(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/messages",
				UpstreamPath: "https://upstream.example/v1/chat/completions",
				Converter:    dto.AdvancedCustomConverterAnthropicMessagesToOpenAIChatCompletions,
			},
		},
	})
	info.RequestURLPath = "/v1/chat/completions"

	_, err := adaptor.GetRequestURL(info)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "does not support request path")
}

func TestAdaptorReplacesModelPlaceholderInRouteURL(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
				Converter:    dto.AdvancedCustomConverterOpenAIChatCompletionsToGeminiGenerateContent,
				Auth: &dto.AdvancedCustomRouteAuth{
					Type:  dto.AdvancedCustomAuthTypeQuery,
					Name:  "key",
					Value: "{api_key}",
				},
			},
		},
	})
	info.UpstreamModelName = "gemini-2.5-flash"

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)

	parsedURL, err := url.Parse(requestURL)
	require.NoError(t, err)
	assert.Equal(t, "/v1beta/models/gemini-2.5-flash:generateContent", parsedURL.Path)
	assert.Equal(t, "sk-test", parsedURL.Query().Get("key"))
	assert.Empty(t, parsedURL.Query().Get("alt"))
}

func TestAdaptorSwitchesGeminiGenerateContentURLForStream(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/chat/completions",
				UpstreamPath: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?existing=1",
				Converter:    dto.AdvancedCustomConverterOpenAIChatCompletionsToGeminiGenerateContent,
				Auth: &dto.AdvancedCustomRouteAuth{
					Type:  dto.AdvancedCustomAuthTypeQuery,
					Name:  "key",
					Value: "{api_key}",
				},
			},
		},
	})
	info.UpstreamModelName = "gemini-2.5-pro"
	info.IsStream = true

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)

	parsedURL, err := url.Parse(requestURL)
	require.NoError(t, err)
	assert.Equal(t, "/v1beta/models/gemini-2.5-pro:streamGenerateContent", parsedURL.Path)
	assert.Equal(t, "sse", parsedURL.Query().Get("alt"))
	assert.Equal(t, "1", parsedURL.Query().Get("existing"))
	assert.Equal(t, "sk-test", parsedURL.Query().Get("key"))
}

func TestAdaptorMatchesGeminiIncomingPathTemplate(t *testing.T) {
	tests := []struct {
		name            string
		requestURLPath  string
		wantRequestPath string
	}{
		{
			name:            "generate content",
			requestURLPath:  "/v1beta/models/gemini-2.5-flash:generateContent",
			wantRequestPath: "/v1/chat/completions",
		},
		{
			name:            "stream generate content",
			requestURLPath:  "/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
			wantRequestPath: "/v1/chat/completions",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			adaptor := &Adaptor{}
			info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
				Routes: []dto.AdvancedCustomRoute{
					{
						IncomingPath: "/v1beta/models/{model}:generateContent",
						UpstreamPath: "https://upstream.example/v1/chat/completions",
						Converter:    dto.AdvancedCustomConverterGeminiGenerateContentToOpenAIChatCompletions,
					},
				},
			})
			info.RequestURLPath = tt.requestURLPath

			requestURL, err := adaptor.GetRequestURL(info)
			require.NoError(t, err)

			parsedURL, err := url.Parse(requestURL)
			require.NoError(t, err)
			assert.Equal(t, tt.wantRequestPath, parsedURL.Path)
		})
	}
}

func TestAdaptorConvertsResponsesRequestToOpenAIChatUpstream(t *testing.T) {
	adaptor := &Adaptor{}
	info := advancedCustomRelayInfo(&dto.AdvancedCustomConfig{
		Routes: []dto.AdvancedCustomRoute{
			{
				IncomingPath: "/v1/responses",
				UpstreamPath: "/v1/chat/completions",
				Converter:    dto.AdvancedCustomConverterOpenAIResponsesToOpenAIChatCompletions,
			},
		},
	})
	info.RelayMode = relayconstant.RelayModeResponses
	info.RequestURLPath = "/v1/responses"
	c := advancedCustomGinContext("/v1/responses")

	converted, err := adaptor.ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model:        "gpt-test",
		Instructions: mustAdvancedCustomRawMessage(t, "system rules"),
		Input:        mustAdvancedCustomRawMessage(t, "hello"),
	})
	require.NoError(t, err)

	chatReq, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	assert.Equal(t, "gpt-test", chatReq.Model)
	require.Len(t, chatReq.Messages, 2)
	assert.Equal(t, "system", chatReq.Messages[0].Role)
	assert.Equal(t, "system rules", chatReq.Messages[0].StringContent())
	assert.Equal(t, "user", chatReq.Messages[1].Role)
	assert.Equal(t, "hello", chatReq.Messages[1].StringContent())

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	parsedURL, err := url.Parse(requestURL)
	require.NoError(t, err)
	assert.Equal(t, "/v1/chat/completions", parsedURL.Path)
}

func advancedCustomRelayInfo(config *dto.AdvancedCustomConfig) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatOpenAI,
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RequestURLPath: "/v1/chat/completions",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:         "sk-test",
			ChannelBaseUrl: "https://fallback.example",
			ChannelType:    constant.ChannelTypeAdvancedCustom,
			ChannelOtherSettings: dto.ChannelOtherSettings{
				AdvancedCustom: config,
			},
		},
	}
}

func advancedCustomGinContext(path string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func mustAdvancedCustomRawMessage(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := common.Marshal(value)
	require.NoError(t, err)
	return raw
}
