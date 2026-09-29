package opencode

import (
	"net/http"
	"net/http/httptest"
	"testing"

	channelconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLSwitchesOpenCodeEndpointsByRelayFormat(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		baseURL     string
		relayFormat types.RelayFormat
		relayMode   int
		requestPath string
		model       string
		isStream    bool
		want        string
	}{
		{
			name:        "zen openai chat",
			baseURL:     channelconstant.OpenCodeZenBaseURLAlias,
			relayFormat: types.RelayFormatOpenAI,
			relayMode:   relayconstant.RelayModeChatCompletions,
			requestPath: "/v1/chat/completions",
			want:        "https://opencode.ai/zen/v1/chat/completions",
		},
		{
			name:        "zen responses",
			baseURL:     channelconstant.OpenCodeZenBaseURLAlias,
			relayFormat: types.RelayFormatOpenAIResponses,
			relayMode:   relayconstant.RelayModeResponses,
			requestPath: "/v1/responses",
			want:        "https://opencode.ai/zen/v1/responses",
		},
		{
			name:        "zen anthropic messages",
			baseURL:     "https://opencode.ai/zen/v1/chat/completions",
			relayFormat: types.RelayFormatClaude,
			requestPath: "/v1/messages",
			want:        "https://opencode.ai/zen/v1/messages",
		},
		{
			name:        "zen gemini stream",
			baseURL:     channelconstant.OpenCodeZenBaseURLAlias,
			relayFormat: types.RelayFormatGemini,
			relayMode:   relayconstant.RelayModeGemini,
			requestPath: "/v1/models/gemini-3-flash:streamGenerateContent",
			model:       "gemini-3-flash",
			isStream:    true,
			want:        "https://opencode.ai/zen/v1/models/gemini-3-flash:streamGenerateContent?alt=sse",
		},
		{
			name:        "go openai chat",
			baseURL:     channelconstant.OpenCodeGoBaseURLAlias,
			relayFormat: types.RelayFormatOpenAI,
			relayMode:   relayconstant.RelayModeChatCompletions,
			requestPath: "/v1/chat/completions",
			want:        "https://opencode.ai/zen/go/v1/chat/completions",
		},
		{
			name:        "go anthropic messages",
			baseURL:     channelconstant.OpenCodeGoBaseURLAlias,
			relayFormat: types.RelayFormatClaude,
			requestPath: "/v1/messages",
			want:        "https://opencode.ai/zen/go/v1/messages",
		},
		{
			name:        "go responses",
			baseURL:     channelconstant.OpenCodeGoBaseURLAlias,
			relayFormat: types.RelayFormatOpenAIResponses,
			relayMode:   relayconstant.RelayModeResponses,
			requestPath: "/v1/responses",
			want:        "https://opencode.ai/zen/go/v1/responses",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			info := &relaycommon.RelayInfo{
				RelayMode:      tt.relayMode,
				RelayFormat:    tt.relayFormat,
				RequestURLPath: tt.requestPath,
				IsStream:       tt.isStream,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:    tt.baseURL,
					ChannelType:       channelconstant.ChannelTypeOpenCode,
					UpstreamModelName: tt.model,
				},
			}
			adaptor := &Adaptor{}
			adaptor.Init(info)

			got, err := adaptor.GetRequestURL(info)

			require.NoError(t, err)
			require.Equal(t, tt.want, got)
			if tt.name == "zen gemini stream" {
				require.True(t, info.DisablePing)
			}
		})
	}
}

func TestGetRequestURLRejectsUnsupportedGoProtocols(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		relayFormat types.RelayFormat
		relayMode   int
		requestPath string
	}{
		{
			name:        "gemini",
			relayFormat: types.RelayFormatGemini,
			relayMode:   relayconstant.RelayModeGemini,
			requestPath: "/v1/models/gemini-3-flash:generateContent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			info := &relaycommon.RelayInfo{
				RelayMode:      tt.relayMode,
				RelayFormat:    tt.relayFormat,
				RequestURLPath: tt.requestPath,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl: channelconstant.OpenCodeGoBaseURLAlias,
					ChannelType:    channelconstant.ChannelTypeOpenCode,
				},
			}
			adaptor := &Adaptor{}
			adaptor.Init(info)

			_, err := adaptor.GetRequestURL(info)

			require.Error(t, err)
		})
	}
}

func TestNormalizeRootAndModelSources(t *testing.T) {
	t.Parallel()

	require.Equal(t, "https://opencode.ai/zen", NormalizeRoot(channelconstant.OpenCodeZenBaseURLAlias))
	require.Equal(t, "https://opencode.ai/zen/go", NormalizeRoot(channelconstant.OpenCodeGoBaseURLAlias))
	require.Equal(t, "https://opencode.ai/zen", NormalizeRoot("https://opencode.ai/zen/v1/responses"))
	require.Equal(t, "https://opencode.ai/zen", NormalizeRoot("https://opencode.ai/zen/v1/models/gemini-3.5-flash"))
	require.Equal(t, "https://opencode.ai/zen/go", NormalizeRoot("https://opencode.ai/zen/go/v1/messages"))

	require.True(t, IsGoBase(channelconstant.OpenCodeGoBaseURLAlias))
	require.False(t, IsGoBase(channelconstant.OpenCodeZenBaseURLAlias))

	modelsURL, ok := ModelsURL(channelconstant.OpenCodeZenBaseURLAlias)
	require.True(t, ok)
	require.Equal(t, "https://opencode.ai/zen/v1/models", modelsURL)
	require.Empty(t, StaticModelListForBase(channelconstant.OpenCodeZenBaseURLAlias))
	require.NotEmpty(t, StaticModelListForBase(channelconstant.OpenCodeGoBaseURLAlias))

	goModelsURL, ok := ModelsURL(channelconstant.OpenCodeGoBaseURLAlias)
	require.True(t, ok)
	require.Equal(t, "https://opencode.ai/zen/go/v1/models", goModelsURL)
}

func TestParseModelsResponse(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"data": [{"id": "gpt-5.5"}, {"id": "models/gemini-3-flash"}],
		"models": [{"name": "claude-sonnet-4-6"}, {"model": "glm-5.1"}]
	}`)

	models, err := ParseModelsResponse(body)

	require.NoError(t, err)
	require.Equal(t, []string{
		"gpt-5.5",
		"gemini-3-flash",
		"claude-sonnet-4-6",
		"glm-5.1",
	}, models)
}

func TestGetRequestURLRoutesKnownModelsByBase(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		baseURL string
		model   string
		want    string
		mode    int
	}{
		{
			name:    "go chat Kimi K3",
			baseURL: channelconstant.OpenCodeGoBaseURLAlias,
			model:   "kimi-k3",
			want:    "https://opencode.ai/zen/go/v1/chat/completions",
			mode:    requestModeOpenAI,
		},
		{
			name:    "go anthropic MiniMax M3",
			baseURL: channelconstant.OpenCodeGoBaseURLAlias,
			model:   "minimax-m3",
			want:    "https://opencode.ai/zen/go/v1/messages",
			mode:    requestModeClaude,
		},
		{
			name:    "zen responses GPT 5.6 Sol",
			baseURL: channelconstant.OpenCodeZenBaseURLAlias,
			model:   "gpt-5.6-sol",
			want:    "https://opencode.ai/zen/v1/responses",
			mode:    requestModeResponses,
		},
		{
			name:    "zen anthropic Claude Sonnet 5",
			baseURL: channelconstant.OpenCodeZenBaseURLAlias,
			model:   "claude-sonnet-5",
			want:    "https://opencode.ai/zen/v1/messages",
			mode:    requestModeClaude,
		},
		{
			name:    "zen Gemini 3.5 Flash",
			baseURL: channelconstant.OpenCodeZenBaseURLAlias,
			model:   "gemini-3.5-flash",
			want:    "https://opencode.ai/zen/v1/models/gemini-3.5-flash:generateContent",
			mode:    requestModeGemini,
		},
		{
			name:    "zen responses Grok 4.5",
			baseURL: channelconstant.OpenCodeZenBaseURLAlias,
			model:   "grok-4.5",
			want:    "https://opencode.ai/zen/v1/responses",
			mode:    requestModeResponses,
		},
		{
			name:    "go responses Grok 4.5",
			baseURL: channelconstant.OpenCodeGoBaseURLAlias,
			model:   "grok-4.5",
			want:    "https://opencode.ai/zen/go/v1/responses",
			mode:    requestModeResponses,
		},
		{
			name:    "go Chat-only Space Bunny",
			baseURL: channelconstant.OpenCodeGoBaseURLAlias,
			model:   "space-bunny-free",
			want:    "https://opencode.ai/zen/go/v1/chat/completions",
			mode:    requestModeOpenAI,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			info := &relaycommon.RelayInfo{
				RelayMode:      relayconstant.RelayModeChatCompletions,
				RelayFormat:    types.RelayFormatOpenAI,
				RequestURLPath: "/v1/chat/completions",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:    tt.baseURL,
					ChannelType:       channelconstant.ChannelTypeOpenCode,
					UpstreamModelName: tt.model,
				},
			}
			adaptor := &Adaptor{}
			adaptor.Init(info)

			got, err := adaptor.GetRequestURL(info)

			require.NoError(t, err)
			require.Equal(t, tt.want, got)
			require.Equal(t, tt.mode, adaptor.RequestMode)
			require.True(t, adaptor.RouteByModel)
		})
	}
}

func TestOpenCodeNewModelRoutes(t *testing.T) {
	t.Parallel()

	for _, group := range []struct {
		baseURL string
		models  []string
		mode    int
		suffix  string
	}{
		{channelconstant.OpenCodeZenBaseURLAlias, []string{"gpt-6-astra", "gpt-6-sol", "grok-4.7", "muse-spark-1.3"}, requestModeResponses, "/v1/responses"},
		{channelconstant.OpenCodeZenBaseURLAlias, []string{"claude-fable-5-1", "claude-opus-5-5", "qwen3.8-flash"}, requestModeClaude, "/v1/messages"},
		{channelconstant.OpenCodeZenBaseURLAlias, []string{"gemini-3.8-flash"}, requestModeGemini, "/v1/models/gemini-3.8-flash:generateContent"},
		{channelconstant.OpenCodeZenBaseURLAlias, []string{"deepseek-v4.1-flash", "deepseek-v4-flash-vision-exp", "glm-5.3-flash", "glm-5.3", "space-bunny-free"}, requestModeOpenAI, "/v1/chat/completions"},
		{channelconstant.OpenCodeGoBaseURLAlias, []string{"grok-4.7", "grok-4.6", "muse-spark-1.3-contributor"}, requestModeResponses, "/v1/responses"},
		{channelconstant.OpenCodeGoBaseURLAlias, []string{"qwen3.8-flash"}, requestModeClaude, "/v1/messages"},
		{channelconstant.OpenCodeGoBaseURLAlias, []string{"glm-5.3-flash", "longcat-2.0", "deepseek-v4.1-flash", "deepseek-v4-flash-vision-exp", "mimo-v2.6-flash", "mimo-v2.6-pro", "hy4-preview"}, requestModeOpenAI, "/v1/chat/completions"},
	} {
		for _, model := range group.models {
			for _, incoming := range []struct {
				format types.RelayFormat
				mode   int
				path   string
			}{
				{types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions, "/v1/chat/completions"},
				{types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses, "/v1/responses"},
			} {
				t.Run(group.baseURL+"/"+model+"/"+string(incoming.format), func(t *testing.T) {
					t.Parallel()
					info := &relaycommon.RelayInfo{
						RelayMode: incoming.mode, RelayFormat: incoming.format, RequestURLPath: incoming.path,
						ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: group.baseURL, ChannelType: channelconstant.ChannelTypeOpenCode, UpstreamModelName: model},
					}
					adaptor := &Adaptor{}
					adaptor.Init(info)
					require.True(t, adaptor.RouteByModel)
					require.Equal(t, group.mode, adaptor.RequestMode)
					requestURL, err := adaptor.GetRequestURL(info)
					require.NoError(t, err)
					require.Equal(t, NormalizeRoot(group.baseURL)+group.suffix, requestURL)
					require.Contains(t, ModelList, model)
					if IsGoBase(group.baseURL) {
						require.Contains(t, StaticModelListForBase(group.baseURL), model)
					}
				})
			}
		}
	}
}

func TestOpenCodeModelRoutingConvertsOpenAIChatRequests(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		baseURL  string
		model    string
		wantType any
		format   types.RelayFormat
	}{
		{
			name:     "chat to responses",
			baseURL:  channelconstant.OpenCodeZenBaseURLAlias,
			model:    "gpt-5.6-sol",
			wantType: &dto.OpenAIResponsesRequest{},
			format:   types.RelayFormatOpenAIResponses,
		},
		{
			name:     "chat to GPT 6 Sol responses",
			baseURL:  channelconstant.OpenCodeZenBaseURLAlias,
			model:    "gpt-6-sol",
			wantType: &dto.OpenAIResponsesRequest{},
			format:   types.RelayFormatOpenAIResponses,
		},
		{
			name:     "chat to Claude",
			baseURL:  channelconstant.OpenCodeGoBaseURLAlias,
			model:    "minimax-m3",
			wantType: &dto.ClaudeRequest{},
			format:   types.RelayFormatClaude,
		},
		{
			name:     "chat to Claude Opus 5.5",
			baseURL:  channelconstant.OpenCodeZenBaseURLAlias,
			model:    "claude-opus-5-5",
			wantType: &dto.ClaudeRequest{},
			format:   types.RelayFormatClaude,
		},
		{
			name:     "chat to Go Qwen3.8 Flash",
			baseURL:  channelconstant.OpenCodeGoBaseURLAlias,
			model:    "qwen3.8-flash",
			wantType: &dto.ClaudeRequest{},
			format:   types.RelayFormatClaude,
		},
		{
			name:     "chat to Gemini",
			baseURL:  channelconstant.OpenCodeZenBaseURLAlias,
			model:    "gemini-3.5-flash",
			wantType: &dto.GeminiChatRequest{},
			format:   types.RelayFormatGemini,
		},
		{
			name:     "chat to Gemini 3.8 Flash",
			baseURL:  channelconstant.OpenCodeZenBaseURLAlias,
			model:    "gemini-3.8-flash",
			wantType: &dto.GeminiChatRequest{},
			format:   types.RelayFormatGemini,
		},
		{
			name:     "chat to Space Bunny Free",
			baseURL:  channelconstant.OpenCodeZenBaseURLAlias,
			model:    "space-bunny-free",
			wantType: &dto.GeneralOpenAIRequest{},
			format:   types.RelayFormatOpenAI,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
			info := &relaycommon.RelayInfo{
				RelayMode:      relayconstant.RelayModeChatCompletions,
				RelayFormat:    types.RelayFormatOpenAI,
				RequestURLPath: "/v1/chat/completions",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:    tt.baseURL,
					ChannelType:       channelconstant.ChannelTypeOpenCode,
					UpstreamModelName: tt.model,
				},
			}
			adaptor := &Adaptor{}
			adaptor.Init(info)

			converted, err := adaptor.ConvertOpenAIRequest(c, info, &dto.GeneralOpenAIRequest{
				Model:    tt.model,
				Messages: []dto.Message{{Role: "user", Content: "hi"}},
			})

			require.NoError(t, err)
			require.IsType(t, tt.wantType, converted)
			require.Equal(t, tt.format, info.FinalRequestRelayFormat)
		})
	}
}

func TestOpenCodeModelRoutingConvertsResponsesToChat(t *testing.T) {
	t.Parallel()

	c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeResponses,
		RelayFormat:    types.RelayFormatOpenAIResponses,
		RequestURLPath: "/v1/responses",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    channelconstant.OpenCodeZenBaseURLAlias,
			ChannelType:       channelconstant.ChannelTypeOpenCode,
			UpstreamModelName: "kimi-k2.6",
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)

	converted, err := adaptor.ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{
		Model: "kimi-k2.6",
		Input: []byte(`[{"role":"user","content":"hi"}]`),
	})

	require.NoError(t, err)
	require.IsType(t, &dto.GeneralOpenAIRequest{}, converted)
	require.Equal(t, types.RelayFormatOpenAI, info.FinalRequestRelayFormat)
	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://opencode.ai/zen/v1/chat/completions", requestURL)
}

func TestOpenCodePassThroughKeepsClientProtocolRoute(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RelayFormat:    types.RelayFormatOpenAI,
		RequestURLPath: "/v1/chat/completions",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    channelconstant.OpenCodeZenBaseURLAlias,
			ChannelType:       channelconstant.ChannelTypeOpenCode,
			UpstreamModelName: "unlisted-open-code-model",
			ChannelSetting:    dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)

	requestURL, err := adaptor.GetRequestURL(info)

	require.NoError(t, err)
	require.Equal(t, requestModeOpenAI, adaptor.RequestMode)
	require.False(t, adaptor.RouteByModel)
	require.Equal(t, "https://opencode.ai/zen/v1/chat/completions", requestURL)
	request := &dto.GeneralOpenAIRequest{Model: "unlisted-open-code-model"}
	converted, err := adaptor.ConvertOpenAIRequest(nil, info, request)
	require.NoError(t, err)
	require.Same(t, request, converted)
}
func TestOpenCodeNativeIngressUsesModelProtocol(t *testing.T) {
	for _, tc := range []struct {
		name, baseURL, model, path, wantURL string
		format                              types.RelayFormat
		mode                                int
		wantType                            any
	}{
		{"go Claude to Chat", channelconstant.OpenCodeGoBaseURLAlias, "space-bunny-free", "/v1/messages", "/v1/chat/completions", types.RelayFormatClaude, requestModeOpenAI, &dto.GeneralOpenAIRequest{}},
		{"go native Claude", channelconstant.OpenCodeGoBaseURLAlias, "qwen3.8-flash", "/v1/messages", "/v1/messages", types.RelayFormatClaude, requestModeClaude, &dto.ClaudeRequest{}},
		{"zen Claude to Responses", channelconstant.OpenCodeZenBaseURLAlias, "gpt-6-sol", "/v1/messages", "/v1/responses", types.RelayFormatClaude, requestModeResponses, &dto.OpenAIResponsesRequest{}},
		{"zen Claude to Gemini", channelconstant.OpenCodeZenBaseURLAlias, "gemini-3.8-flash", "/v1/messages", "/v1/models/gemini-3.8-flash:generateContent", types.RelayFormatClaude, requestModeGemini, &dto.GeminiChatRequest{}},
		{"go Gemini to Chat", channelconstant.OpenCodeGoBaseURLAlias, "space-bunny-free", "/v1beta/models/space-bunny-free:generateContent", "/v1/chat/completions", types.RelayFormatGemini, requestModeOpenAI, &dto.GeneralOpenAIRequest{}},
		{"go Gemini to Claude", channelconstant.OpenCodeGoBaseURLAlias, "qwen3.8-flash", "/v1beta/models/qwen3.8-flash:generateContent", "/v1/messages", types.RelayFormatGemini, requestModeClaude, &dto.ClaudeRequest{}},
		{"zen Gemini to Responses", channelconstant.OpenCodeZenBaseURLAlias, "gpt-6-sol", "/v1beta/models/gpt-6-sol:generateContent", "/v1/responses", types.RelayFormatGemini, requestModeResponses, &dto.OpenAIResponsesRequest{}},
		{"zen native Gemini", channelconstant.OpenCodeZenBaseURLAlias, "gemini-3.8-flash", "/v1beta/models/gemini-3.8-flash:generateContent", "/v1/models/gemini-3.8-flash:generateContent", types.RelayFormatGemini, requestModeGemini, &dto.GeminiChatRequest{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
			relayMode := relayconstant.RelayModeUnknown
			if tc.format == types.RelayFormatGemini {
				relayMode = relayconstant.RelayModeGemini
			}
			info := &relaycommon.RelayInfo{RelayFormat: tc.format, RelayMode: relayMode, RequestURLPath: tc.path, ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channelconstant.ChannelTypeOpenCode, ChannelBaseUrl: tc.baseURL, UpstreamModelName: tc.model, ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true}}}
			a := &Adaptor{}
			a.Init(info)
			require.True(t, a.RouteByModel)
			require.Equal(t, tc.mode, a.RequestMode)
			url, err := a.GetRequestURL(info)
			require.NoError(t, err)
			require.Equal(t, NormalizeRoot(tc.baseURL)+tc.wantURL, url)
			var converted any
			if tc.format == types.RelayFormatClaude {
				maxTokens := uint(16)
				converted, err = a.ConvertClaudeRequest(c, info, &dto.ClaudeRequest{Model: tc.model, MaxTokens: &maxTokens, Messages: []dto.ClaudeMessage{{Role: "user", Content: "hi"}}})
			} else {
				converted, err = a.ConvertGeminiRequest(c, info, &dto.GeminiChatRequest{Contents: []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{Text: "hi"}}}}})
			}
			require.NoError(t, err)
			require.IsType(t, tc.wantType, converted)
			target, err := a.targetRelayFormat()
			require.NoError(t, err)
			require.Equal(t, target, info.FinalRequestRelayFormat)
		})
	}
}

func TestOpenCodeNativeIngressNonTextEndpointsKeepOriginalRoute(t *testing.T) {
	for _, tc := range []struct {
		name, path string
		format     types.RelayFormat
		mode       int
	}{
		{"count tokens", "/v1/messages/count_tokens", types.RelayFormatClaude, relayconstant.RelayModeClaudeCountTokens},
		{"responses compact", "/v1/responses/compact", types.RelayFormatOpenAIResponsesCompaction, relayconstant.RelayModeResponsesCompact},
		{"responses input tokens", "/v1/responses/input_tokens", types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponsesInputTokens},
		{"gemini embed", "/v1beta/models/space-bunny-free:embedContent", types.RelayFormatGemini, relayconstant.RelayModeGemini},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{RelayFormat: tc.format, RelayMode: tc.mode, RequestURLPath: tc.path, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: channelconstant.OpenCodeGoBaseURLAlias, UpstreamModelName: "space-bunny-free"}}
			a := &Adaptor{}
			a.Init(info)
			require.False(t, ShouldRouteByModel(info))
			require.False(t, a.RouteByModel)
		})
	}
}

func TestKnownOpenCodeModelsOverridePassThrough(t *testing.T) {
	for _, tc := range []struct {
		name, baseURL, model, path string
		incoming                   types.RelayFormat
		mode                       int
		final                      types.RelayFormat
		converted                  any
	}{
		{"zen claude", channelconstant.OpenCodeZenBaseURLAlias, "claude-opus-5-5", "/v1/messages", types.RelayFormatOpenAI, requestModeClaude, types.RelayFormatClaude, &dto.ClaudeRequest{}},
		{"zen chat", channelconstant.OpenCodeZenBaseURLAlias, "space-bunny-free", "/v1/chat/completions", types.RelayFormatOpenAIResponses, requestModeOpenAI, types.RelayFormatOpenAI, &dto.GeneralOpenAIRequest{}},
		{"go responses", channelconstant.OpenCodeGoBaseURLAlias, "grok-4.7", "/v1/responses", types.RelayFormatOpenAI, requestModeResponses, types.RelayFormatOpenAIResponses, &dto.OpenAIResponsesRequest{}},
		{"go claude", channelconstant.OpenCodeGoBaseURLAlias, "qwen3.8-flash", "/v1/messages", types.RelayFormatOpenAIResponses, requestModeClaude, types.RelayFormatClaude, &dto.ClaudeRequest{}},
		{"go Chat-only Space Bunny", channelconstant.OpenCodeGoBaseURLAlias, "space-bunny-free", "/v1/chat/completions", types.RelayFormatOpenAIResponses, requestModeOpenAI, types.RelayFormatOpenAI, &dto.GeneralOpenAIRequest{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
			mode := relayconstant.RelayModeChatCompletions
			if tc.incoming == types.RelayFormatOpenAIResponses {
				mode = relayconstant.RelayModeResponses
			}
			info := &relaycommon.RelayInfo{
				RelayFormat: tc.incoming, RelayMode: mode,
				ChannelMeta: &relaycommon.ChannelMeta{ChannelType: channelconstant.ChannelTypeOpenCode, ChannelBaseUrl: tc.baseURL, UpstreamModelName: tc.model, ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true}},
			}
			adaptor := &Adaptor{}
			adaptor.Init(info)
			require.True(t, ShouldRouteByModel(info))
			require.True(t, adaptor.RouteByModel)
			require.Equal(t, tc.mode, adaptor.RequestMode)
			url, err := adaptor.GetRequestURL(info)
			require.NoError(t, err)
			require.Equal(t, NormalizeRoot(tc.baseURL)+tc.path, url)
			var converted any
			if tc.incoming == types.RelayFormatOpenAIResponses {
				converted, err = adaptor.ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{Model: tc.model, Input: []byte(`[{"role":"user","content":"hi"}]`)})
			} else {
				converted, err = adaptor.ConvertOpenAIRequest(c, info, &dto.GeneralOpenAIRequest{Model: tc.model, Messages: []dto.Message{{Role: "user", Content: "hi"}}})
			}
			require.NoError(t, err)
			require.IsType(t, tc.converted, converted)
			require.Equal(t, tc.final, info.FinalRequestRelayFormat)
		})
	}
}

func TestOpenCodeModelRoutedClaudeUsesAnthropicHeaders(t *testing.T) {
	t.Parallel()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RelayFormat:    types.RelayFormatOpenAI,
		RequestURLPath: "/v1/chat/completions",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            "opencode-key",
			ChannelBaseUrl:    channelconstant.OpenCodeGoBaseURLAlias,
			ChannelType:       channelconstant.ChannelTypeOpenCode,
			UpstreamModelName: "minimax-m3",
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	headers := make(http.Header)

	require.NoError(t, adaptor.SetupRequestHeader(c, &headers, info))
	require.Equal(t, "opencode-key", headers.Get("x-api-key"))
	require.Empty(t, headers.Get("Authorization"))
	require.Equal(t, "2023-06-01", headers.Get("anthropic-version"))
	require.Equal(t, openCodeUserAgent, headers.Get("User-Agent"))
}

func TestOpenCodeModelInventoriesMatchCurrentRoutes(t *testing.T) {
	t.Parallel()

	require.Equal(t, []string{
		"glm-5.3-flash",
		"glm-5.3",
		"glm-5.2",
		"glm-5.1",
		"glm-5",
		"kimi-k3",
		"kimi-k2.7-code",
		"kimi-k2.6",
		"kimi-k2.5",
		"longcat-2.0",
		"longcat-2.5-preview-free",
		"deepseek-v4.1-flash",
		"deepseek-v4-pro",
		"deepseek-v4-flash",
		"deepseek-v4-flash-vision-exp",
		"deepseek-flash",
		"mimo-v2.6-flash",
		"mimo-v2.6-pro",
		"mimo-v2.5",
		"mimo-v2.5-pro",
		"mimo-v2-pro",
		"mimo-v2-omni",
		"hy4-preview",
		"hy3-preview",
		"hy3",
		"omen-alpha",
	}, channelconstant.OpenCodeGoChatModels)
	require.Contains(t, channelconstant.OpenCodeGoChatRouteOnlyModels, "space-bunny-free")
	require.NotContains(t, StaticModelListForBase(channelconstant.OpenCodeGoBaseURLAlias), "space-bunny-free")
	require.Contains(t, channelconstant.OpenCodeGoClaudeModels, "minimax-m3")
	require.Contains(t, channelconstant.OpenCodeZenResponsesModels, "gpt-5.6-sol")
	require.Contains(t, channelconstant.OpenCodeZenResponsesModels, "gpt-5.6-terra")
	require.Contains(t, channelconstant.OpenCodeZenResponsesModels, "gpt-5.6-luna")
	require.Contains(t, channelconstant.OpenCodeZenClaudeModels, "claude-sonnet-5")
	require.Contains(t, channelconstant.OpenCodeZenChatModels, "glm-5.2")
	require.Contains(t, channelconstant.OpenCodeZenChatModels, "kimi-k2.7-code")
	require.Contains(t, channelconstant.OpenCodeZenResponsesModels, "grok-4.5")
	require.Contains(t, channelconstant.OpenCodeGoResponsesModels, "gpt-5.6-luna")
	require.Contains(t, channelconstant.OpenCodeGoChatModels, "glm-5")
	require.NotContains(t, channelconstant.OpenCodeZenClaudeModels, "claude-opus-4-1")
}

func TestSetupRequestHeaderForwardsClientSessionHeader(t *testing.T) {
	t.Parallel()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("x-opencode-session", "ses_f525e4699ffe5hmrr6t1FiPVca")
	info := &relaycommon.RelayInfo{
		UserId:  7,
		TokenId: 42,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:         "opencode-key",
			ChannelBaseUrl: channelconstant.OpenCodeZenBaseURLAlias,
			ChannelType:    channelconstant.ChannelTypeOpenCode,
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	headers := make(http.Header)

	require.NoError(t, adaptor.SetupRequestHeader(c, &headers, info))
	require.Equal(t, "ses_f525e4699ffe5hmrr6t1FiPVca", headers.Get("x-opencode-session"))
}

func TestSetupRequestHeaderGeneratesStableSessionFallback(t *testing.T) {
	t.Parallel()

	newInfo := func(tokenId int) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			UserId:  7,
			TokenId: tokenId,
			ChannelMeta: &relaycommon.ChannelMeta{
				ApiKey:         "opencode-key",
				ChannelBaseUrl: channelconstant.OpenCodeZenBaseURLAlias,
				ChannelType:    channelconstant.ChannelTypeOpenCode,
			},
		}
	}
	adaptor := &Adaptor{}
	info := newInfo(42)
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	headers := make(http.Header)

	require.NoError(t, adaptor.SetupRequestHeader(c, &headers, info))
	session := headers.Get("x-opencode-session")
	require.Regexp(t, openCodeSessionIDPattern, session)

	repeat := make(http.Header)
	require.NoError(t, adaptor.SetupRequestHeader(c, &repeat, info))
	require.Equal(t, session, repeat.Get("x-opencode-session"))

	other := make(http.Header)
	otherContext, _ := gin.CreateTestContext(httptest.NewRecorder())
	otherContext.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	require.NoError(t, adaptor.SetupRequestHeader(otherContext, &other, newInfo(43)))
	require.NotEqual(t, session, other.Get("x-opencode-session"))
}

func TestSetupRequestHeaderSetsSessionForClaudeMode(t *testing.T) {
	t.Parallel()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		UserId:      1,
		TokenId:     2,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:         "opencode-key",
			ChannelBaseUrl: channelconstant.OpenCodeZenBaseURLAlias,
			ChannelType:    channelconstant.ChannelTypeOpenCode,
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	require.Equal(t, requestModeClaude, adaptor.RequestMode)
	headers := make(http.Header)

	require.NoError(t, adaptor.SetupRequestHeader(c, &headers, info))
	require.Regexp(t, openCodeSessionIDPattern, headers.Get("x-opencode-session"))
}
