package controller

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/ali"
	"github.com/QuantumNous/new-api/relay/channel/cloudflare"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func convertChatCompatibilityRequest(t *testing.T, request *dto.GeneralOpenAIRequest, channelType int, mapping map[string]string) []byte {
	t.Helper()
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	settings := model_setting.GetGlobalSettings()
	oldPassThrough, oldBlacklist := settings.PassThroughRequestEnabled, settings.ThinkingModelBlacklist
	oldEffortTailModels := settings.EffortTailModelIDs
	settings.PassThroughRequestEnabled = false
	settings.ThinkingModelBlacklist = nil
	settings.EffortTailModelIDs = []string{"gpt-5.1-codex-max"}
	t.Cleanup(func() {
		settings.PassThroughRequestEnabled = oldPassThrough
		settings.ThinkingModelBlacklist = oldBlacklist
		settings.EffortTailModelIDs = oldEffortTailModels
	})

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	if mapping != nil {
		encoded, err := common.Marshal(mapping)
		require.NoError(t, err)
		c.Set("model_mapping", string(encoded))
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: request.Model,
		Request:         request,
		RelayFormat:     types.RelayFormatOpenAI,
		IsStream:        request.IsStream(nil),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:          channelType,
			UpstreamModelName:    request.Model,
			SupportStreamOptions: true,
		},
	}
	require.NoError(t, helper.ModelMappedHelper(c, info, request))
	require.NoError(t, helper.ApplyReasoningModelSuffix(c, info, request))
	var converted any
	var err error
	if channelType == constant.ChannelTypeAli {
		converted, err = (&ali.Adaptor{}).ConvertOpenAIRequest(c, info, request)
	} else {
		converted, err = (&openai.Adaptor{}).ConvertOpenAIRequest(c, info, request)
	}
	require.NoError(t, err)
	encoded, err := common.Marshal(converted)
	require.NoError(t, err)
	return encoded
}

func TestChannelTestOpenAIChatCompatibility(t *testing.T) {
	for _, tt := range []struct {
		name        string
		model       string
		upstream    string
		endpoint    string
		channelType int
		stream      bool
		wantLimit   string
	}{
		{name: "GPT6 automatic", model: "gpt-6-astra", upstream: "gpt-6-astra", channelType: constant.ChannelTypeOpenAI, wantLimit: "max_completion_tokens"},
		{name: "GPT6 explicit Azure stream", model: "gpt-6-astra", upstream: "gpt-6-astra", endpoint: string(constant.EndpointTypeOpenAI), channelType: constant.ChannelTypeAzure, stream: true, wantLimit: "max_completion_tokens"},
		{name: "GPT6 sol", model: "gpt-6-sol", upstream: "gpt-6-sol", channelType: constant.ChannelTypeOpenAI, wantLimit: "max_completion_tokens"},
		{name: "GPT6 luna", model: "gpt-6-luna", upstream: "gpt-6-luna", channelType: constant.ChannelTypeOpenAI, wantLimit: "max_completion_tokens"},
		{name: "GPT6.1 sol", model: "gpt-6.1-sol", upstream: "gpt-6.1-sol", channelType: constant.ChannelTypeOpenAI, wantLimit: "max_completion_tokens"},
		{name: "GPT6.1 terra", model: "gpt-6.1-terra", upstream: "gpt-6.1-terra", channelType: constant.ChannelTypeOpenAI, wantLimit: "max_completion_tokens"},
		{name: "alias maps to GPT6", model: "customer-model", upstream: "gpt-6-astra", channelType: constant.ChannelTypeOpenAI, wantLimit: "max_completion_tokens"},
		{name: "GPT5 alias maps to Qwen", model: "gpt-5.6-luna", upstream: "qwen-turbo", channelType: constant.ChannelTypeAli, wantLimit: "max_tokens"},
		{name: "GPT5 stream", model: "gpt-5.6-luna", upstream: "gpt-5.6-luna", channelType: constant.ChannelTypeOpenAI, stream: true, wantLimit: "max_completion_tokens"},
		{name: "GPT4 explicit", model: "gpt-4.1", upstream: "gpt-4.1", endpoint: string(constant.EndpointTypeOpenAI), channelType: constant.ChannelTypeOpenAI, wantLimit: "max_tokens"},
		{name: "o series", model: "o3-mini", upstream: "o3-mini", channelType: constant.ChannelTypeAzure, wantLimit: "max_completion_tokens"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			request, ok := buildTestRequest(tt.model, tt.endpoint, &model.Channel{}, tt.stream).(*dto.GeneralOpenAIRequest)
			require.True(t, ok)
			encoded := convertChatCompatibilityRequest(t, request, tt.channelType, map[string]string{tt.model: tt.upstream})
			want := map[string]any{
				"model":      tt.upstream,
				"messages":   []dto.Message{{Role: "user", Content: "hi"}},
				"stream":     tt.stream,
				tt.wantLimit: 16,
			}
			if tt.stream {
				want["stream_options"] = map[string]any{"include_usage": true}
			}
			wantJSON, err := common.Marshal(want)
			require.NoError(t, err)
			assert.JSONEq(t, string(wantJSON), string(encoded))
		})
	}
}

func TestOpenAIChatSamplingCompatibility(t *testing.T) {
	const sampling = `{"temperature":0.2,"top_p":0.8,"logprobs":true,"top_logprobs":5}`
	for _, tt := range []struct {
		name       string
		model      string
		effort     string
		reasoning  string
		mapping    map[string]string
		zeroValues bool
		wantModel  string
		wantEffort string
		wantRole   string
		wantParams string
	}{
		{name: "GPT5.1 explicit none", model: "gpt-5.1", effort: "none", wantEffort: "none", wantRole: "developer", wantParams: sampling},
		{name: "GPT5.2 default none", model: "gpt-5.2", wantRole: "developer", wantParams: sampling},
		{name: "GPT5.2 dated snapshot", model: "gpt-5.2-2025-12-11", wantRole: "developer", wantParams: sampling},
		{name: "GPT5.4 reasoning", model: "gpt-5.4", effort: "high", wantEffort: "high", wantRole: "developer", wantParams: `{}`},
		{name: "GPT5.4 snapshot none", model: "gpt-5.4-2026-03-05", effort: "none", wantEffort: "none", wantRole: "developer", wantParams: sampling},
		{name: "explicit zero values", model: "gpt-5.4", effort: "none", zeroValues: true, wantEffort: "none", wantRole: "developer", wantParams: `{"temperature":0,"top_p":0,"logprobs":false}`},
		{name: "GPT5 original", model: "gpt-5", wantRole: "developer", wantParams: `{}`},
		{name: "GPT5.6 existing policy", model: "gpt-5.6-luna", wantRole: "developer", wantParams: `{}`},
		{name: "pro variant", model: "gpt-5.2-pro-2025-12-11", wantRole: "developer", wantParams: `{}`},
		{name: "chat variant", model: "gpt-5.2-chat-latest", wantRole: "developer", wantParams: `{}`},
		{name: "codex model name keeps max", model: "gpt-5.1-codex-max", wantRole: "developer", wantParams: `{}`},
		{name: "GPT6", model: "gpt-6-astra", wantRole: "developer", wantParams: `{}`},
		{name: "GPT6 snapshot", model: "gpt-6-astra-2026-09-03", wantRole: "developer", wantParams: `{}`},
		{name: "GPT6 effort suffix", model: "gpt-6-astra-high", wantModel: "gpt-6-astra", wantEffort: "high", wantRole: "developer", wantParams: `{}`},
		{name: "GPT6 sol none keeps sampling", model: "gpt-6-sol", wantRole: "developer", wantParams: sampling},
		{name: "GPT6 luna effort drops sampling", model: "gpt-6-luna-high", wantModel: "gpt-6-luna", wantEffort: "high", wantRole: "developer", wantParams: `{}`},
		{name: "GPT6.1 sol drops sampling", model: "gpt-6.1-sol", wantRole: "developer", wantParams: `{}`},
		{name: "GPT6.1 terra default drops sampling", model: "gpt-6.1-terra", wantRole: "developer", wantParams: `{}`},
		{name: "GPT6.1 terra none keeps sampling", model: "gpt-6.1-terra", effort: "none", wantEffort: "none", wantRole: "developer", wantParams: sampling},
		{name: "none effort suffix", model: "gpt-5.2-none", wantModel: "gpt-5.2", wantEffort: "none", wantRole: "developer", wantParams: sampling},
		{name: "modifier overrides explicit effort", model: "gpt-5.2@thinking:off", effort: "high", wantModel: "gpt-5.2", wantEffort: "none", wantRole: "developer", wantParams: sampling},
		{name: "mapped modifier wins", model: "customer-model@thinking:off", mapping: map[string]string{"customer-model": "gpt-5.2@effort:high"}, wantModel: "gpt-5.2", wantEffort: "high", wantRole: "developer", wantParams: `{}`},
		{name: "nested reasoning disabled", model: "gpt-5.2", reasoning: `{"enabled":false}`, wantEffort: "none", wantRole: "developer", wantParams: sampling},
		{name: "o1 mini role exception", model: "o1-mini", wantRole: "system", wantParams: `{"top_p":0.8,"logprobs":true,"top_logprobs":5}`},
		{name: "GPT4 unchanged", model: "gpt-4.1", wantRole: "system", wantParams: sampling},
		{name: "future model unchanged", model: "gpt-7", wantRole: "system", wantParams: sampling},
	} {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.GeneralOpenAIRequest{
				Model: tt.model,
				Messages: []dto.Message{
					{Role: "system", Content: "first instruction"},
					{Role: "system", Content: "second instruction"},
					{Role: "user", Content: "hi"},
				},
				ReasoningEffort: tt.effort,
			}
			require.NoError(t, common.UnmarshalJsonStr(sampling, request))
			if tt.reasoning != "" {
				request.Reasoning = []byte(tt.reasoning)
			}
			if tt.zeroValues {
				request.Temperature = lo.ToPtr(0.0)
				request.TopP = lo.ToPtr(0.0)
				request.LogProbs = lo.ToPtr(false)
				request.TopLogProbs = nil
			}
			encoded := convertChatCompatibilityRequest(t, request, constant.ChannelTypeOpenAI, tt.mapping)
			var want map[string]any
			require.NoError(t, common.UnmarshalJsonStr(tt.wantParams, &want))
			want["model"] = tt.model
			if tt.wantModel != "" {
				want["model"] = tt.wantModel
			}
			want["messages"] = []dto.Message{
				{Role: tt.wantRole, Content: "first instruction"},
				{Role: "system", Content: "second instruction"},
				{Role: "user", Content: "hi"},
			}
			if tt.wantEffort != "" {
				want["reasoning_effort"] = tt.wantEffort
			}
			wantJSON, err := common.Marshal(want)
			require.NoError(t, err)
			assert.JSONEq(t, string(wantJSON), string(encoded))
		})
	}
}

func TestOpenAIChatTokenLimitCompatibility(t *testing.T) {
	for _, modelName := range []string{"gpt-5", "o3-mini", "gpt-6-astra"} {
		for _, tt := range []struct {
			name  string
			input string
			want  string
		}{
			{name: "omitted", input: `{}`, want: `{}`},
			{name: "legacy only", input: `{"max_tokens":100}`, want: `{"max_completion_tokens":100}`},
			{name: "completion only", input: `{"max_completion_tokens":50}`, want: `{"max_completion_tokens":50}`},
			{name: "both positive stay present", input: `{"max_tokens":100,"max_completion_tokens":50}`, want: `{"max_tokens":100,"max_completion_tokens":50}`},
			{name: "zero completion falls back", input: `{"max_tokens":100,"max_completion_tokens":0}`, want: `{"max_completion_tokens":100}`},
			{name: "legacy zero stays present", input: `{"max_tokens":0}`, want: `{"max_tokens":0}`},
			{name: "completion zero stays present", input: `{"max_completion_tokens":0}`, want: `{"max_completion_tokens":0}`},
			{name: "both zero stay present", input: `{"max_tokens":0,"max_completion_tokens":0}`, want: `{"max_tokens":0,"max_completion_tokens":0}`},
		} {
			t.Run(modelName+"/"+tt.name, func(t *testing.T) {
				request := &dto.GeneralOpenAIRequest{Model: modelName, Messages: []dto.Message{{Role: "user", Content: "hi"}}}
				require.NoError(t, common.UnmarshalJsonStr(tt.input, request))
				encoded := convertChatCompatibilityRequest(t, request, constant.ChannelTypeOpenAI, nil)
				want := dto.GeneralOpenAIRequest{Model: modelName, Messages: []dto.Message{{Role: "user", Content: "hi"}}}
				require.NoError(t, common.UnmarshalJsonStr(tt.want, &want))
				wantJSON, err := common.Marshal(want)
				require.NoError(t, err)
				assert.JSONEq(t, string(wantJSON), string(encoded))
			})
		}
	}
}

func TestDirectOpenAIResponsesKeepsExistingParameters(t *testing.T) {
	const body = `{"model":"gpt-6-astra","input":"hi","max_output_tokens":100,"temperature":0.2,"top_p":0.8,"top_logprobs":5,"include":["message.output_text.logprobs"],"reasoning":{"effort":"high"}}`
	var request dto.OpenAIResponsesRequest
	require.NoError(t, common.UnmarshalJsonStr(body, &request))
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-6-astra",
		RelayFormat:     types.RelayFormatOpenAIResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			UpstreamModelName: "gpt-6-astra",
		},
	}
	converted, err := (&openai.Adaptor{}).ConvertOpenAIResponsesRequest(nil, info, request)
	require.NoError(t, err)
	encoded, err := common.Marshal(converted)
	require.NoError(t, err)
	assert.JSONEq(t, body, string(encoded))
}

func TestCloudflareEmbeddingResponseCompatibility(t *testing.T) {
	tests := []struct {
		name        string
		body        string
		forceFormat bool
		wantTokens  int
	}{
		{
			name:       "single embedding preserves upstream usage",
			body:       `{"object":"list","data":[{"object":"embedding","index":0,"embedding":[0.1,-0.2]}],"model":"@cf/baai/bge-large-en-v1.5","usage":{"prompt_tokens":8,"total_tokens":8}}`,
			wantTokens: 8,
		},
		{
			name:        "batch embeddings survive force format",
			body:        `{"object":"list","data":[{"object":"embedding","index":0,"embedding":[0.1,-0.2]},{"object":"embedding","index":1,"embedding":[0.3,0.4]}],"model":"@cf/baai/bge-large-en-v1.5","usage":{"prompt_tokens":16,"total_tokens":16},"extra":"preserved"}`,
			forceFormat: true,
			wantTokens:  16,
		},
		{
			name:       "base64 embedding is forwarded unchanged",
			body:       `{"object":"list","data":[{"object":"embedding","index":0,"embedding":"zczMPc3MTL4="}],"model":"@cf/baai/bge-large-en-v1.5","usage":{"prompt_tokens":5,"total_tokens":5}}`,
			wantTokens: 5,
		},
		{
			name:        "missing usage falls back to input estimate",
			body:        `{"object":"list","data":[{"object":"embedding","index":0,"embedding":[0.1,-0.2]}],"model":"@cf/baai/bge-large-en-v1.5"}`,
			forceFormat: true,
			wantTokens:  99,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/embeddings", nil)
			info := &relaycommon.RelayInfo{
				RelayMode:   relayconstant.RelayModeEmbeddings,
				RelayFormat: types.RelayFormatEmbedding,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:       constant.ChannelCloudflare,
					UpstreamModelName: "@cf/baai/bge-large-en-v1.5",
					ChannelSetting:    dto.ChannelSettings{ForceFormat: tt.forceFormat},
				},
			}
			info.SetEstimatePromptTokens(99)
			resp := &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(tt.body)),
			}

			usage, apiErr := (&cloudflare.Adaptor{}).DoResponse(c, resp, info)
			require.Nil(t, apiErr)
			require.IsType(t, &dto.Usage{}, usage)
			assert.Equal(t, &dto.Usage{PromptTokens: tt.wantTokens, TotalTokens: tt.wantTokens}, usage)
			assert.Equal(t, http.StatusOK, w.Code)
			assert.Equal(t, "application/json", w.Header().Get("Content-Type"))
			assert.JSONEq(t, tt.body, w.Body.String())
		})
	}
}
