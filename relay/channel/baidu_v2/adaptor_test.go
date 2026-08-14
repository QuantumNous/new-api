package baidu_v2

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// baiduV2RelayInfo builds a minimal RelayInfo for header/URL tests.
// ApiKey format: "<bearer_token>|<appid>", matching the Baidu Qianfan v2 gateway
// convention where the pipe splits the authorization token and app id.
func baiduV2RelayInfo(apiKey string, format types.RelayFormat) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayFormat:     format,
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RequestURLPath:  "/v1/chat/completions",
		OriginModelName: "ernie-x1",
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiKey:            apiKey,
			ChannelBaseUrl:    "https://qianfan.baidubce.com",
			ChannelType:       constant.ChannelTypeBaiduV2,
			UpstreamModelName: "ernie-x1",
		},
	}
}

func baiduV2GinContext(path string, clientHeaders map[string]string) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	c.Request.Header.Set("Content-Type", "application/json")
	for k, v := range clientHeaders {
		c.Request.Header.Set(k, v)
	}
	return c
}

// TestSetupRequestHeader_OpenAI_UsesBearerAuth ensures the OpenAI-format branch
// still writes the Authorization: Bearer <token> header (regression guard).
func TestSetupRequestHeader_OpenAI_UsesBearerAuth(t *testing.T) {
	adaptor := &Adaptor{}
	info := baiduV2RelayInfo("bce-v2-token|my-app", types.RelayFormatOpenAI)
	c := baiduV2GinContext("/v1/chat/completions", nil)
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t, "Bearer bce-v2-token", header.Get("Authorization"))
	assert.Equal(t, "my-app", header.Get("appid"))
	assert.Empty(t, header.Get("x-api-key"))
	assert.Empty(t, header.Get("anthropic-version"))
}

// TestSetupRequestHeader_OpenAI_NoAppID handles the single-segment key case.
func TestSetupRequestHeader_OpenAI_NoAppID(t *testing.T) {
	adaptor := &Adaptor{}
	info := baiduV2RelayInfo("bce-v2-token", types.RelayFormatOpenAI)
	c := baiduV2GinContext("/v1/chat/completions", nil)
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t, "Bearer bce-v2-token", header.Get("Authorization"))
	assert.Empty(t, header.Get("appid"))
}

// TestSetupRequestHeader_Claude_DefaultVersion asserts the default
// anthropic-version fallback when the client does not send one.
func TestSetupRequestHeader_Claude_DefaultVersion(t *testing.T) {
	adaptor := &Adaptor{}
	info := baiduV2RelayInfo("bce-claude-token|claude-app", types.RelayFormatClaude)
	c := baiduV2GinContext("/anthropic/v1/messages", nil)
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t, "bce-claude-token", header.Get("x-api-key"))
	assert.Equal(t, "claude-app", header.Get("appid"))
	assert.Equal(t, "2023-06-01", header.Get("anthropic-version"))
	assert.Empty(t, header.Get("Authorization"), "Claude branch must not set Bearer Authorization")
}

// TestSetupRequestHeader_Claude_PreservesClientVersion regressions PR #6849:
// when the client sends anthropic-version, the adapter MUST forward it
// instead of overwriting with the hard-coded default.
func TestSetupRequestHeader_Claude_PreservesClientVersion(t *testing.T) {
	adaptor := &Adaptor{}
	info := baiduV2RelayInfo("bce-claude-token|claude-app", types.RelayFormatClaude)
	c := baiduV2GinContext("/anthropic/v1/messages", map[string]string{
		"anthropic-version": "2024-01-01",
	})
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t, "2024-01-01", header.Get("anthropic-version"),
		"client-provided anthropic-version must not be overwritten by the default")
}

// TestSetupRequestHeader_Claude_ForwardsAnthropicBeta regressions PR #6849:
// anthropic-beta must be forwarded via claude.CommonClaudeHeadersOperation.
func TestSetupRequestHeader_Claude_ForwardsAnthropicBeta(t *testing.T) {
	adaptor := &Adaptor{}
	info := baiduV2RelayInfo("bce-claude-token|claude-app", types.RelayFormatClaude)
	c := baiduV2GinContext("/anthropic/v1/messages", map[string]string{
		"anthropic-beta": "prompt-caching-2024-07-31,fine-grained-tool-streaming-2025-05-14",
	})
	header := http.Header{}

	require.NoError(t, adaptor.SetupRequestHeader(c, &header, info))
	assert.Equal(t,
		"prompt-caching-2024-07-31,fine-grained-tool-streaming-2025-05-14",
		header.Get("anthropic-beta"),
		"anthropic-beta must be forwarded from the client request headers")
}

// TestSetupRequestHeader_InvalidKey guards against callers with an empty
// authorization segment, which would otherwise reach the upstream with a blank
// bearer/x-api-key.
func TestSetupRequestHeader_InvalidKey(t *testing.T) {
	adaptor := &Adaptor{}
	info := baiduV2RelayInfo("|only-appid", types.RelayFormatOpenAI)
	c := baiduV2GinContext("/v1/chat/completions", nil)
	header := http.Header{}

	err := adaptor.SetupRequestHeader(c, &header, info)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid API key")
}

// TestGetRequestURL_ClaudeRoutesToAnthropicMessages verifies the Claude branch
// of the URL builder — the routing half of PR #6849.
func TestGetRequestURL_ClaudeRoutesToAnthropicMessages(t *testing.T) {
	adaptor := &Adaptor{}
	info := baiduV2RelayInfo("bce-claude-token|claude-app", types.RelayFormatClaude)

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://qianfan.baidubce.com/anthropic/v1/messages", url)
}

// TestGetRequestURL_OpenAIChatCompletionsUnchanged ensures the OpenAI URL is
// still emitted for the standard chat/completions relay mode.
func TestGetRequestURL_OpenAIChatCompletionsUnchanged(t *testing.T) {
	adaptor := &Adaptor{}
	info := baiduV2RelayInfo("bce-v2-token|my-app", types.RelayFormatOpenAI)

	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://qianfan.baidubce.com/v2/chat/completions", url)
}
