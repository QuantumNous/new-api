package service

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestExtractClientExclusive(t *testing.T) {
	require.Equal(t, ClientExclusiveCodex, ExtractClientExclusive(strPtr(`{"client_exclusive":"codex"}`)))
	require.Equal(t, ClientExclusiveClaudeCode, ExtractClientExclusive(strPtr(`{"client_exclusive":"claude_code"}`)))
	require.Equal(t, ClientExclusiveNone, ExtractClientExclusive(strPtr(`{"client_exclusive":""}`)))
	require.Equal(t, ClientExclusiveCodex, ExtractClientExclusive(strPtr(`{"key_group":"Codex 正价"}`)))
	require.Equal(t, ClientExclusiveNone, ExtractClientExclusive(strPtr(`{"key_group":"cc"}`)))
	require.Equal(t, ClientExclusiveNone, ExtractClientExclusive(nil))
}

func TestChannelMatchesClientPolicy_codexBidirectional(t *testing.T) {
	codexSetting := strPtr(`{"client_exclusive":"codex"}`)
	genericSetting := strPtr(`{"key_group":"default"}`)

	require.True(t, ChannelMatchesClientPolicy(codexSetting, ClientTypeCodex, "gpt-5.4"))
	require.False(t, ChannelMatchesClientPolicy(codexSetting, ClientTypeGeneric, "gpt-5.4"))
	require.True(t, ChannelMatchesClientPolicy(genericSetting, ClientTypeGeneric, "gpt-5.4"))
	require.False(t, ChannelMatchesClientPolicy(genericSetting, ClientTypeCodex, "gpt-5.4"))
}

func TestChannelMatchesClientPolicy_claudeCodeOneWay(t *testing.T) {
	ccSetting := strPtr(`{"client_exclusive":"claude_code"}`)
	genericSetting := strPtr(`{"key_group":"default"}`)

	require.True(t, ChannelMatchesClientPolicy(ccSetting, ClientTypeClaudeCode, "claude-sonnet-4-6"))
	require.False(t, ChannelMatchesClientPolicy(ccSetting, ClientTypeGeneric, "claude-sonnet-4-6"))
	require.True(t, ChannelMatchesClientPolicy(genericSetting, ClientTypeClaudeCode, "claude-sonnet-4-6"))
	require.True(t, ChannelMatchesClientPolicy(genericSetting, ClientTypeGeneric, "claude-sonnet-4-6"))
}

func TestChannelMatchesClientPolicy_matrix(t *testing.T) {
	settings := map[string]*string{
		"generic": strPtr(`{"key_group":"default"}`),
		"codex":   strPtr(`{"client_exclusive":"codex"}`),
		"cc":      strPtr(`{"client_exclusive":"claude_code"}`),
	}
	clients := []ClientType{ClientTypeGeneric, ClientTypeCodex, ClientTypeClaudeCode}
	modelName := "claude-sonnet-4-6"

	want := map[ClientType]map[string]bool{
		ClientTypeGeneric:    {"generic": true, "codex": false, "cc": false},
		ClientTypeCodex:      {"generic": true, "codex": false, "cc": false},
		ClientTypeClaudeCode: {"generic": true, "codex": false, "cc": true},
	}

	for _, client := range clients {
		for chName, setting := range settings {
			got := ChannelMatchesClientPolicy(setting, client, modelName)
			require.Equal(t, want[client][chName], got, "client=%s channel=%s", client, chName)
		}
	}
}

func TestDetectClaudeCodeClient_userAgent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/messages", strings.NewReader(`{"model":"claude-sonnet-4-6"}`))
	c.Request.Header.Set("User-Agent", "claude-cli/1.0.0")
	require.True(t, DetectClaudeCodeClient(c))
}

func TestDetectClaudeCodeClient_anthropicBeta(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/messages", strings.NewReader(`{"model":"claude-sonnet-4-6"}`))
	c.Request.Header.Set("anthropic-beta", "claude-code-20250219")
	require.True(t, DetectClaudeCodeClient(c))
}

func TestDetectClaudeCodeClient_openAICompatNotCC(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"model":"claude-sonnet-4-6"}`))
	c.Request.Header.Set("anthropic-beta", "claude-code-20250219")
	require.False(t, DetectClaudeCodeClient(c))
}

func TestDetectClientType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/messages", strings.NewReader(`{"model":"claude-fable-5"}`))
	c.Request.Header.Set("User-Agent", "claude-cli/2.0.0")
	require.Equal(t, ClientTypeClaudeCode, DetectClientType(c, "claude-fable-5"))
	require.Equal(t, ClientTypeGeneric, DetectClientType(c, "gpt-5.4"))
}

func TestRequiresClaudeCodeChannelPolicy(t *testing.T) {
	require.True(t, RequiresClaudeCodeChannelPolicy("claude-fable-5"))
	require.False(t, RequiresClaudeCodeChannelPolicy("gpt-5.4"))
}

func TestValidateChannelClientPolicy_ccExclusive(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/messages", strings.NewReader(`{"model":"claude-fable-5"}`))
	c.Request.Header.Set("User-Agent", "curl/8.0")

	ch := &model.Channel{Setting: strPtr(`{"client_exclusive":"claude_code"}`)}
	err := ValidateChannelClientPolicy(c, ch, "claude-fable-5")
	require.ErrorIs(t, err, ErrNonClaudeCodeClaudeChannel)
}
