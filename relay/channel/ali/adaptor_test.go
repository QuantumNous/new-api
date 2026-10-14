package ali

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestConvertOpenAIRequestFiltersThinkingBudgetByUpstreamModel(t *testing.T) {
	tests := []struct {
		name          string
		requestModel  string
		upstreamModel string
		budget        string
		wantBudget    bool
		wantValue     int64
	}{
		{
			name:          "qwen",
			requestModel:  "qwen-plus",
			upstreamModel: "qwen-plus",
			budget:        "128",
			wantBudget:    true,
			wantValue:     128,
		},
		{
			name:          "qwq explicit zero",
			requestModel:  "qwq-32b",
			upstreamModel: "qwq-32b",
			budget:        "0",
			wantBudget:    true,
			wantValue:     0,
		},
		{
			name:          "unsupported upstream overrides qwen request",
			requestModel:  "qwen-plus",
			upstreamModel: "deepseek-r1",
			budget:        "128",
			wantBudget:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.GeneralOpenAIRequest{
				Model:          tt.requestModel,
				EnableThinking: json.RawMessage(`true`),
				ThinkingBudget: json.RawMessage(tt.budget),
			}
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: tt.upstreamModel,
				},
			}

			convertedValue, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, request)
			require.NoError(t, err)
			converted, ok := convertedValue.(*dto.GeneralOpenAIRequest)
			require.True(t, ok)

			if tt.wantBudget {
				assert.Equal(t, tt.budget, string(converted.ThinkingBudget))
			} else {
				assert.Nil(t, converted.ThinkingBudget)
			}

			encoded, err := common.Marshal(converted)
			require.NoError(t, err)

			assert.True(t, gjson.GetBytes(encoded, "enable_thinking").Bool())
			value := gjson.GetBytes(encoded, "thinking_budget")
			assert.Equal(t, tt.wantBudget, value.Exists())
			if tt.wantBudget {
				assert.Equal(t, tt.wantValue, value.Int())
			}
		})
	}
}

func TestConvertOpenAIRequestPreservesExplicitZeroForMappedQwenModel(t *testing.T) {
	const (
		clientModel   = "customer-model"
		upstreamModel = "Qwen/Qwen3-235B-A22B-Thinking-2507"
	)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("model_mapping", `{"customer-model":"Qwen/Qwen3-235B-A22B-Thinking-2507"}`)

	request := &dto.GeneralOpenAIRequest{
		Model:          clientModel,
		EnableThinking: json.RawMessage(`true`),
		ThinkingBudget: json.RawMessage(`0`),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: clientModel,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: clientModel,
		},
	}

	err := relayhelper.ModelMappedHelper(c, info, request)
	require.NoError(t, err)
	assert.True(t, info.IsModelMapped)
	assert.Equal(t, upstreamModel, info.UpstreamModelName)
	assert.Equal(t, upstreamModel, request.Model)

	convertedValue, err := (&Adaptor{}).ConvertOpenAIRequest(c, info, request)
	require.NoError(t, err)
	converted, ok := convertedValue.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	assert.Equal(t, json.RawMessage(`0`), converted.ThinkingBudget)

	encoded, err := common.Marshal(converted)
	require.NoError(t, err)

	value := gjson.GetBytes(encoded, "thinking_budget")
	assert.True(t, value.Exists())
	assert.Equal(t, int64(0), value.Int())
}

// Image models the alibaba task plugin does not claim reach this adaptor only
// through a channel misconfiguration. The rejection is a client error that
// skips channel retries; a retryable 500 would be re-attempted on unrelated
// channels and still end as a 500 for the client.
func TestConvertImageRequestRejectsUnclaimedModelWithoutRetry(t *testing.T) {
	for _, name := range []string{"wanx-style-repaint-v1", "custom-image-model"} {
		info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: name}}
		_, err := (&Adaptor{}).ConvertImageRequest(nil, info, dto.ImageRequest{Model: name, Prompt: "a cat"})
		var apiErr *types.NewAPIError
		require.ErrorAs(t, err, &apiErr, name)
		assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode, name)
		assert.True(t, types.IsSkipRetryError(apiErr), name)
		assert.Contains(t, apiErr.Error(), name)
	}
}

// Claude clients reach DashScope two ways: models on the Anthropic-compatible
// list keep Claude Messages and get the cc_entrypoint marker block (block
// form verified live 2026-10-05; a plain string system did not search) and
// the agent billing key; other models are converted to compatible-mode Chat,
// where hosted web search becomes enable_search / search_options and a forced
// search is billed as one turbo call.
func TestConvertClaudeRequestWebSearch(t *testing.T) {
	t.Setenv(aliAnthropicMessagesModelsEnv, defaultAliAnthropicMessagesModels)
	const (
		chatModel      = "llama-4-scout"
		anthropicModel = "qwen3.8-flash"
		marker         = `{"type":"text","text":"x-anthropic-billing-header: cc_entrypoint=cli;"}`
		messages       = `"messages":[{"role":"user","content":"Weather?"}]`
		searchTool     = `{"type":"web_search_20250305","name":"web_search"}`
		forcedChoice   = `"tool_choice":{"type":"tool","name":"web_search"},`
	)
	domains := make([]string, 26)
	for i := range domains {
		domains[i] = fmt.Sprintf("d%d.example", i)
	}
	tooManyDomains, err := common.Marshal(domains)
	require.NoError(t, err)

	tests := []struct {
		name      string
		model     string
		body      string            // Claude request fields after model and max_tokens
		want      map[string]string // gjson path -> raw JSON; "" means absent
		wantCodes []string
		noCodes   []string
		wantTurbo int
	}{
		{
			name:  "auto search on Chat",
			model: chatModel,
			body:  messages + `,"tools":[` + searchTool + `]`,
			want:  map[string]string{"enable_search": "true", "search_options": "", "tool_choice": "", "web_search_options": ""},
		},
		{
			name:      "forced search on Chat",
			model:     chatModel,
			body:      forcedChoice + messages + `,"tools":[` + searchTool + `]`,
			want:      map[string]string{"enable_search": "true", "search_options": `{"forced_search":true}`, "tool_choice": "", "web_search_options": ""},
			wantTurbo: 1,
		},
		{
			name:    "allowed domains become assigned_site_list",
			model:   chatModel,
			body:    messages + `,"tools":[{"type":"web_search_20250305","name":"web_search","allowed_domains":["a.example","b.example"]}]`,
			want:    map[string]string{"search_options": `{"assigned_site_list":["a.example","b.example"]}`},
			noCodes: []string{"unsupported_domain_filter"},
		},
		{
			name:      "more than 25 allowed domains are dropped",
			model:     chatModel,
			body:      messages + `,"tools":[{"type":"web_search_20250305","name":"web_search","allowed_domains":` + string(tooManyDomains) + `}]`,
			want:      map[string]string{"enable_search": "true", "search_options": ""},
			wantCodes: []string{"unsupported_domain_filter"},
		},
		{
			name:      "search limits and excluded domains are semantic loss",
			model:     chatModel,
			body:      messages + `,"tools":[{"type":"web_search_20250305","name":"web_search","max_uses":2,"blocked_domains":["a.example"]}]`,
			want:      map[string]string{"enable_search": "true"},
			wantCodes: []string{"unsupported_search_limit", "unsupported_domain_filter"},
		},
		{
			name:      "user location is presentation loss",
			model:     chatModel,
			body:      messages + `,"tools":[{"type":"web_search_20250305","name":"web_search","user_location":{"type":"approximate","city":"Paris"}}]`,
			want:      map[string]string{"enable_search": "true", "search_options": ""},
			wantCodes: []string{"unsupported_search_tuning"},
		},
		{
			name:  "marker without system",
			model: anthropicModel,
			body:  messages + `,"tools":[` + searchTool + `]`,
			want:  map[string]string{"system": `[` + marker + `]`},
		},
		{
			name:  "marker before string system",
			model: anthropicModel,
			body:  `"system":"Be brief.",` + messages + `,"tools":[` + searchTool + `]`,
			want:  map[string]string{"system": `[` + marker + `,{"type":"text","text":"Be brief."}]`},
		},
		{
			name:  "marker before array system",
			model: anthropicModel,
			body:  `"system":[{"type":"text","text":"Be brief."}],` + messages + `,"tools":[` + searchTool + `]`,
			want:  map[string]string{"system": `[` + marker + `,{"type":"text","text":"Be brief."}]`},
		},
		{
			name:  "marker for empty array system",
			model: anthropicModel,
			body:  `"system":[],` + messages + `,"tools":[` + searchTool + `]`,
			want:  map[string]string{"system": `[` + marker + `]`},
		},
		{
			name:  "marker already sent by the client",
			model: anthropicModel,
			body:  `"system":"x-anthropic-billing-header: cc_version=2.1; cc_entrypoint=cli;",` + messages + `,"tools":[` + searchTool + `]`,
			want:  map[string]string{"system": `"x-anthropic-billing-header: cc_version=2.1; cc_entrypoint=cli;"`},
		},
		{
			name:  "no marker without a search tool",
			model: anthropicModel,
			body:  `"system":"Be brief.",` + messages + `,"tools":[{"name":"f","input_schema":{"type":"object"}}]`,
			want:  map[string]string{"system": `"Be brief."`},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			info := &relaycommon.RelayInfo{
				RelayFormat:     types.RelayFormatClaude,
				OriginModelName: tt.model,
				ChannelMeta:     &relaycommon.ChannelMeta{UpstreamModelName: tt.model},
			}
			adaptor := &Adaptor{}
			adaptor.Init(info)
			var request dto.ClaudeRequest
			require.NoError(t, common.UnmarshalJsonStr(`{"model":"`+tt.model+`","max_tokens":64,`+tt.body+`}`, &request))
			var converted any
			for range 2 { // converting the same request twice adds one marker
				converted, err = adaptor.ConvertClaudeRequest(c, info, &request)
				require.NoError(t, err)
			}
			wire, err := common.Marshal(converted)
			require.NoError(t, err)
			for path, want := range tt.want {
				value := gjson.GetBytes(wire, path)
				if want == "" {
					assert.False(t, value.Exists(), "%s in %s", path, wire)
					continue
				}
				assert.JSONEq(t, want, value.Raw, path)
			}
			var codes []string
			for _, diagnostic := range info.ConversionDiagnostics() {
				codes = append(codes, diagnostic.Code)
			}
			for _, code := range tt.wantCodes {
				assert.Contains(t, codes, code)
			}
			for _, code := range tt.noCodes {
				assert.NotContains(t, codes, code)
			}
			turbo := 0
			if info.ResponsesUsageInfo != nil && info.ResponsesUsageInfo.BuiltInTools[aliSearchTurboKey] != nil {
				turbo = info.ResponsesUsageInfo.BuiltInTools[aliSearchTurboKey].CallCount
			}
			assert.Equal(t, tt.wantTurbo, turbo)
			wantKey := ""
			if tt.model == anthropicModel {
				wantKey = aliSearchAgentKey
			}
			assert.Equal(t, wantKey, info.WebSearchBillingKey)
		})
	}
}

// DashScope Responses bills web search like the agent strategy and reports
// the count in usage.x_tools; it replaces the web_search_call items counted
// under the protocol keys.
func TestAliResponsesWebSearchUsage(t *testing.T) {
	for _, raw := range []string{
		`{"status":"completed","usage":{"x_tools":{"web_search":{"count":2}}}}`,
		`{"type":"response.completed","response":{"usage":{"x_tools":{"web_search":{"count":2}}}}}`,
	} {
		info := &relaycommon.RelayInfo{
			RelayMode:   constant.RelayModeResponses,
			RelayFormat: types.RelayFormatOpenAIResponses,
			ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://dashscope.invalid"},
		}
		adaptor := &Adaptor{}
		adaptor.Init(info)
		url, err := adaptor.GetRequestURL(info)
		require.NoError(t, err)
		assert.Equal(t, "https://dashscope.invalid/compatible-mode/v1/responses", url)

		info.CountBillableToolCall(dto.BuildInCallWebSearchCall, "")
		info.ApplyVendorToolUsage([]byte(raw))
		counts := map[string]int{}
		for name, tool := range info.ResponsesUsageInfo.BuiltInTools {
			counts[name] = tool.CallCount
		}
		assert.Equal(t, map[string]int{aliSearchAgentKey: 2, dto.BuildInToolWebSearch: 0, dto.BuildInToolWebSearchPreview: 0}, counts, raw)
	}
}
