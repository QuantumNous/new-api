package relay

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newRelayInfoWithSystemPrompt(systemPrompt string, override bool) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{}
	info.ChannelSetting.SystemPrompt = systemPrompt
	info.ChannelSetting.SystemPromptOverride = override
	return info
}

func newTestGinContext() *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	return c
}

func TestApplySystemPromptToClaudeRequest_InjectsWhenAbsent(t *testing.T) {
	info := newRelayInfoWithSystemPrompt("hide model info", false)
	request := &dto.ClaudeRequest{System: nil}
	applySystemPromptToClaudeRequest(newTestGinContext(), info, request)
	require.True(t, request.IsStringSystem())
	assert.Equal(t, "hide model info", request.GetStringSystem())
}

func TestApplySystemPromptToClaudeRequest_NoOverrideKeepsExisting(t *testing.T) {
	info := newRelayInfoWithSystemPrompt("hide model info", false)
	request := &dto.ClaudeRequest{System: "keep me"}
	applySystemPromptToClaudeRequest(newTestGinContext(), info, request)
	require.True(t, request.IsStringSystem())
	assert.Equal(t, "keep me", request.GetStringSystem())
	assert.False(t, common.GetContextKeyBool(newTestGinContext(), constant.ContextKeySystemPromptOverride))
}

func TestApplySystemPromptToClaudeRequest_OverrideStringPrepends(t *testing.T) {
	c := newTestGinContext()
	info := newRelayInfoWithSystemPrompt("hide model info", true)
	request := &dto.ClaudeRequest{System: "keep me"}
	applySystemPromptToClaudeRequest(c, info, request)
	require.True(t, request.IsStringSystem())
	assert.Equal(t, "hide model info\nkeep me", request.GetStringSystem())
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeySystemPromptOverride))
}

func TestApplySystemPromptToOpenAIRequest_InjectsWhenAbsent(t *testing.T) {
	info := newRelayInfoWithSystemPrompt("hide model info", false)
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
		},
	}
	applySystemPromptToOpenAIRequest(newTestGinContext(), info, request)
	require.Len(t, request.Messages, 2)
	assert.Equal(t, "system", request.Messages[0].Role)
	assert.Equal(t, "hide model info", request.Messages[0].StringContent())
}

func TestApplySystemPromptToGeminiRequest_InjectsWhenAbsent(t *testing.T) {
	info := newRelayInfoWithSystemPrompt("hide model info", false)
	request := &dto.GeminiChatRequest{}
	applySystemPromptToGeminiRequest(newTestGinContext(), info, request)
	require.NotNil(t, request.SystemInstructions)
	require.Len(t, request.SystemInstructions.Parts, 1)
	assert.Equal(t, "hide model info", request.SystemInstructions.Parts[0].Text)
}
