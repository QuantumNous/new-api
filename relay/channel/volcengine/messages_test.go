package volcengine

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	channelconstant "github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func volcRelayInfo(baseURL string, format types.RelayFormat, model string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat: format,
		RelayMode:   constant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       channelconstant.ChannelTypeVolcEngine,
			ChannelBaseUrl:    baseURL,
			ApiKey:            "ark-key",
			UpstreamModelName: model,
		},
	}
}

func TestNativeMessagesRequestURL(t *testing.T) {
	adaptor := &Adaptor{}
	tests := []struct {
		name    string
		baseURL string
		format  types.RelayFormat
		model   string
		want    string
	}{
		{"beijing host", "https://ark.cn-beijing.volces.com", types.RelayFormatClaude, "doubao-seed-2-1-pro", "https://ark.cn-beijing.volces.com/api/compatible/v1/messages"},
		{"empty base uses beijing", "", types.RelayFormatClaude, "doubao-seed-2-1-pro", "https://ark.cn-beijing.volces.com/api/compatible/v1/messages"},
		{"api v3 path ignored", "https://ark.cn-beijing.volces.com/api/v3", types.RelayFormatClaude, "deepseek-v4-pro", "https://ark.cn-beijing.volces.com/api/compatible/v1/messages"},
		{"trailing slash", "https://ark.cn-beijing.volces.com/", types.RelayFormatClaude, "doubao-seed-2-1-pro", "https://ark.cn-beijing.volces.com/api/compatible/v1/messages"},
		{"host case", "https://ARK.cn-beijing.volces.com", types.RelayFormatClaude, "doubao-seed-2-1-pro", "https://ark.cn-beijing.volces.com/api/compatible/v1/messages"},
		{"explicit port kept", "https://ark.cn-beijing.volces.com:8443", types.RelayFormatClaude, "doubao-seed-2-1-pro", "https://ark.cn-beijing.volces.com:8443/api/compatible/v1/messages"},
		{"byteplus host", "https://ark.ap-southeast.bytepluses.com", types.RelayFormatClaude, "dola-seed-2-1-turbo", "https://ark.ap-southeast.bytepluses.com/api/compatible/v1/messages"},
		{"other path on official host stays on chat", "https://ark.cn-beijing.volces.com/api/coding", types.RelayFormatClaude, "doubao-seed-code", "https://ark.cn-beijing.volces.com/api/coding/api/v3/chat/completions"},
		{"coding plan keeps coding messages", "doubao-coding-plan", types.RelayFormatClaude, "doubao-seed-code", "https://ark.cn-beijing.volces.com/api/coding/v1/messages"},
		{"third party stays on chat", "https://api.ppio.com/v3/bytedance-cn", types.RelayFormatClaude, "doubao-seed-2-1-pro", "https://api.ppio.com/v3/bytedance-cn/api/v3/chat/completions"},
		{"bot model stays on bots chat", "https://ark.cn-beijing.volces.com", types.RelayFormatClaude, "bot-demo", "https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions"},
		{"openai format stays on chat", "https://ark.cn-beijing.volces.com", types.RelayFormatOpenAI, "doubao-seed-2-1-pro", "https://ark.cn-beijing.volces.com/api/v3/chat/completions"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := adaptor.GetRequestURL(volcRelayInfo(tt.baseURL, tt.format, tt.model))
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestNativeMessagesRequestHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	c.Request.Header.Set("Authorization", "Bearer client-token")

	adaptor := &Adaptor{}

	header := make(http.Header)
	require.NoError(t, adaptor.SetupRequestHeader(c, &header, volcRelayInfo("https://ark.ap-southeast.bytepluses.com", types.RelayFormatClaude, "dola-seed-2-1-turbo")))
	assert.Equal(t, "ark-key", header.Get("x-api-key"))
	assert.Empty(t, header.Get("Authorization"))
	assert.Equal(t, "application/json", header.Get("Content-Type"))

	codingHeader := make(http.Header)
	require.NoError(t, adaptor.SetupRequestHeader(c, &codingHeader, volcRelayInfo("doubao-coding-plan", types.RelayFormatClaude, "doubao-seed-code")))
	assert.Equal(t, "Bearer ark-key", codingHeader.Get("Authorization"))
	assert.Empty(t, codingHeader.Get("x-api-key"))

	chatHeader := make(http.Header)
	require.NoError(t, adaptor.SetupRequestHeader(c, &chatHeader, volcRelayInfo("https://ark.cn-beijing.volces.com", types.RelayFormatOpenAI, "doubao-seed-2-1-pro")))
	assert.Equal(t, "Bearer ark-key", chatHeader.Get("Authorization"))
	assert.Empty(t, chatHeader.Get("x-api-key"))
}

func TestNativeMessagesKeepsThinkingBlocks(t *testing.T) {
	var req dto.ClaudeRequest
	require.NoError(t, common.UnmarshalJsonStr(`{"model":"doubao-seed-2-1-pro","max_tokens":1024,"thinking":{"type":"enabled"},"messages":[
		{"role":"user","content":"weather?"},
		{"role":"assistant","content":[
			{"type":"thinking","thinking":"need tool","signature":"sig-keep"},
			{"type":"text","text":"checking"},
			{"type":"tool_use","id":"toolu_1","name":"get_weather","input":{"city":"beijing"}}
		]},
		{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_1","content":"sunny"}]}
	]}`, &req))

	adaptor := &Adaptor{}
	converted, err := adaptor.ConvertClaudeRequest(nil, volcRelayInfo("https://ark.cn-beijing.volces.com", types.RelayFormatClaude, "doubao-seed-2-1-pro"), &req)
	require.NoError(t, err)

	body, err := common.Marshal(converted)
	require.NoError(t, err)
	assistant := gjson.GetBytes(body, "messages.1.content")
	require.Len(t, assistant.Array(), 3)
	assert.Equal(t, "thinking", assistant.Get("0.type").String())
	assert.Equal(t, "need tool", assistant.Get("0.thinking").String())
	assert.Equal(t, "sig-keep", assistant.Get("0.signature").String())
	assert.Equal(t, "text", assistant.Get("1.type").String())
	assert.Equal(t, "tool_use", assistant.Get("2.type").String())
	assert.Equal(t, "enabled", gjson.GetBytes(body, "thinking.type").String())
}
