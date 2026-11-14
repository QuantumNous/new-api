package volcengine

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func volcRelayInfo(baseURL string, format types.RelayFormat) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat: format,
		RelayMode:   relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeVolcEngine,
			ChannelBaseUrl:    baseURL,
			ApiKey:            "app|ark-key",
			UpstreamModelName: "doubao-seed-2-1-pro",
		},
	}
}

func TestOfficialMessagesRequestURL(t *testing.T) {
	adaptor := &Adaptor{}
	tests := []struct {
		name    string
		baseURL string
		format  types.RelayFormat
		model   string
		want    string
	}{
		{
			name:    "beijing host",
			baseURL: "https://ark.cn-beijing.volces.com",
			format:  types.RelayFormatClaude,
			want:    officialMessagesURL,
		},
		{
			name:    "empty base uses default beijing host",
			baseURL: "",
			format:  types.RelayFormatClaude,
			want:    officialMessagesURL,
		},
		{
			name:    "api v3 path still uses messages url",
			baseURL: "https://ark.cn-beijing.volces.com/api/v3",
			format:  types.RelayFormatClaude,
			want:    officialMessagesURL,
		},
		{
			name:    "trailing slash",
			baseURL: "https://ark.cn-beijing.volces.com/",
			format:  types.RelayFormatClaude,
			want:    officialMessagesURL,
		},
		{
			name:    "host case",
			baseURL: "https://ARK.cn-beijing.volces.com",
			format:  types.RelayFormatClaude,
			want:    officialMessagesURL,
		},
		{
			name:    "coding plan stays on coding messages",
			baseURL: "doubao-coding-plan",
			format:  types.RelayFormatClaude,
			want:    "https://ark.cn-beijing.volces.com/api/coding/v1/messages",
		},
		{
			name:    "byteplus stays on chat completions",
			baseURL: "https://ark.ap-southeast.bytepluses.com",
			format:  types.RelayFormatClaude,
			want:    "https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions",
		},
		{
			name:    "third party stays on chat completions",
			baseURL: "https://api.ppio.com/v3/bytedance-cn",
			format:  types.RelayFormatClaude,
			want:    "https://api.ppio.com/v3/bytedance-cn/api/v3/chat/completions",
		},
		{
			name:    "beijing chat completions stays on chat",
			baseURL: "https://ark.cn-beijing.volces.com",
			format:  types.RelayFormatOpenAI,
			want:    "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
		},
		{
			name:    "beijing messages ignores bot prefix",
			baseURL: "https://ark.cn-beijing.volces.com",
			format:  types.RelayFormatClaude,
			model:   "bot-demo",
			want:    officialMessagesURL,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := volcRelayInfo(tt.baseURL, tt.format)
			if tt.model != "" {
				info.UpstreamModelName = tt.model
			}
			got, err := adaptor.GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestOfficialMessagesRequestHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("Authorization", "Bearer client-token")

	adaptor := &Adaptor{}
	header := make(http.Header)
	info := volcRelayInfo("https://ark.cn-beijing.volces.com", types.RelayFormatClaude)
	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))

	assert.Equal(t, "app|ark-key", header.Get("x-api-key"))
	assert.Empty(t, header.Get("Authorization"))
	assert.Equal(t, "application/json", header.Get("Content-Type"))
	assert.Empty(t, header.Get("anthropic-version"))

	chatHeader := make(http.Header)
	chatInfo := volcRelayInfo("https://ark.cn-beijing.volces.com", types.RelayFormatOpenAI)
	require.NoError(t, adaptor.SetupRequestHeader(c, &chatHeader, chatInfo))
	assert.Equal(t, "Bearer app|ark-key", chatHeader.Get("Authorization"))
	assert.Empty(t, chatHeader.Get("x-api-key"))
}

func TestPrepareOfficialMessagesBodyKeepsProtocolFields(t *testing.T) {
	raw := []byte(`{"model":"client-model","service_tier":"flex","stop_sequences":"stop-now","messages":[{"role":"developer","content":"keep"},{"role":"assistant","content":[{"type":"thinking","thinking":"t","signature":"sig-keep"},{"type":"tool_use","id":"toolu_1","name":"get_weather","input":{"city":"beijing"}}]}]}`)

	unchanged, err := PrepareOfficialMessagesBody(raw, "ep-mapped", false)
	require.NoError(t, err)
	assert.JSONEq(t, string(raw), string(unchanged))
	assert.False(t, gjson.GetBytes(unchanged, "messages.1.content.1.tool_calls").Exists())

	mapped, err := PrepareOfficialMessagesBody(raw, "ep-mapped", true)
	require.NoError(t, err)
	assert.Equal(t, "ep-mapped", gjson.GetBytes(mapped, "model").String())
	assert.Equal(t, "flex", gjson.GetBytes(mapped, "service_tier").String())
	assert.Equal(t, "stop-now", gjson.GetBytes(mapped, "stop_sequences").String())
	assert.Equal(t, "developer", gjson.GetBytes(mapped, "messages.0.role").String())
	assert.Equal(t, "sig-keep", gjson.GetBytes(mapped, "messages.1.content.0.signature").String())
	assert.Equal(t, "tool_use", gjson.GetBytes(mapped, "messages.1.content.1.type").String())
	assert.Equal(t, "get_weather", gjson.GetBytes(mapped, "messages.1.content.1.name").String())
	assert.False(t, gjson.GetBytes(mapped, "messages.1.content.1.tool_calls").Exists())
}

func TestConvertClaudeRequestOfficialMessagesDoesNotConvert(t *testing.T) {
	adaptor := &Adaptor{}
	req := &dto.ClaudeRequest{Model: "doubao-seed"}
	got, err := adaptor.ConvertClaudeRequest(nil, volcRelayInfo("https://ark.cn-beijing.volces.com", types.RelayFormatClaude), req)
	require.NoError(t, err)
	assert.Same(t, req, got)
}
