package service

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestIsCodexKeyGroup(t *testing.T) {
	require.True(t, IsCodexKeyGroup("Codex"))
	require.True(t, IsCodexKeyGroup("codex"))
	require.True(t, IsCodexKeyGroup("Codex 正价"))
	require.True(t, IsCodexKeyGroup("CodeX专用"))
	require.True(t, IsCodexKeyGroup("GPT Codex"))
	require.True(t, IsCodexKeyGroup("codex-基础"))
	require.False(t, IsCodexKeyGroup("default"))
	require.False(t, IsCodexKeyGroup("OpenAI"))
}

func TestChannelMatchesCodexPolicy(t *testing.T) {
	codexSetting := strPtr(`{"key_group":"Codex"}`)
	defaultSetting := strPtr(`{"key_group":"default"}`)

	require.True(t, ChannelMatchesCodexPolicy(codexSetting, true))
	require.False(t, ChannelMatchesCodexPolicy(codexSetting, false))
	require.True(t, ChannelMatchesCodexPolicy(defaultSetting, false))
	require.True(t, ChannelMatchesCodexPolicy(defaultSetting, true))
}

func TestDetectCodexClient_originator(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/responses", strings.NewReader(`{"model":"gpt-5.5"}`))
	c.Request.Header.Set("Originator", "codex_cli_rs")
	require.True(t, DetectCodexClient(c))
}

func TestDetectCodexClient_promptCacheKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body := `{"model":"gpt-5.5","prompt_cache_key":"sess-abc"}`
	c.Request = httptest.NewRequest("POST", "/v1/responses", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	require.True(t, DetectCodexClient(c))
}

func TestDetectCodexClient_chatCompletionsNotCodex(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"model":"gpt-5.5","messages":[]}`))
	require.False(t, DetectCodexClient(c))
}

func TestRequiresCodexChannelPolicy(t *testing.T) {
	require.True(t, RequiresCodexChannelPolicy("gpt-5.4"))
	require.True(t, RequiresCodexChannelPolicy("gpt-5.5"))
	require.False(t, RequiresCodexChannelPolicy("claude-sonnet-4-6"))
}

func strPtr(s string) *string {
	return &s
}
