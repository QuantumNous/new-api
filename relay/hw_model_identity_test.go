package relay

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHwEverySoldModelHasAnIdentity(t *testing.T) {
	want := map[string][2]string{
		"claude-fable-5-1":  {"Claude Fable 5.1", "Anthropic"},
		"claude-opus-5-5":   {"Claude Opus 5.5", "Anthropic"},
		"claude-sonnet-5-5": {"Claude Sonnet 5.5", "Anthropic"},
		"claude-haiku-5-5":  {"Claude Haiku 5.5", "Anthropic"},
		"gpt-6-luna":        {"GPT-6 Luna", "OpenAI"},
		"gpt-6.1-sol":       {"GPT-6.1 Sol", "OpenAI"},
		"gpt-6-astra":       {"GPT-6 Astra", "OpenAI"},
		"grok-4":            {"Grok 4", "xAI"},
		"grok-4-fast":       {"Grok 4 Fast", "xAI"},
	}
	for name, expected := range want {
		display, maker, ok := service.HwModelIdentity(name)
		require.True(t, ok, name)
		assert.Equal(t, expected[0], display, name)
		assert.Equal(t, expected[1], maker, name)
	}
	for _, name := range service.HwSoldModelNames() {
		line := service.HwModelIdentityLine(name, "")
		assert.NotEmpty(t, line, "sold model %s has no identity line", name)
		assert.LessOrEqual(t, len(strings.Fields(line)), 30, "line of %s is too long", name)
	}
	assert.Empty(t, service.HwModelIdentityLine("gpt-4o", ""), "a model we do not sell gets no line")
}

func TestHwModelIdentityLineSkipsOwnAssistantKey(t *testing.T) {
	t.Setenv(service.HwAdminAgentAPIKeyEnv, "sk-assistantkey")
	assert.Empty(t, service.HwModelIdentityLine("claude-haiku-5-5", "assistantkey"))
	assert.NotEmpty(t, service.HwModelIdentityLine("claude-haiku-5-5", "customerkey"))
}

func TestHwModelIdentityKeepsCustomerSystemPromptOnce(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "claude-fable-5-1"}
	line := service.HwModelIdentityLine("claude-fable-5-1", "")
	require.NotEmpty(t, line)

	t.Run("chat without system", func(t *testing.T) {
		request := &dto.GeneralOpenAIRequest{Model: "claude-fable-5-1", Stream: common.GetPointer(true), Messages: []dto.Message{{Role: "user", Content: "Wie ben je?"}}}
		hwApplyChatModelIdentity(info, request)
		hwApplyChatModelIdentity(info, request)
		require.Len(t, request.Messages, 2)
		assert.Equal(t, "system", request.Messages[0].Role)
		assert.Equal(t, line, request.Messages[0].StringContent())
	})
	t.Run("chat with string system", func(t *testing.T) {
		request := &dto.GeneralOpenAIRequest{Model: "claude-fable-5-1", Messages: []dto.Message{{Role: "system", Content: "You are Bob."}, {Role: "user", Content: "Hi"}}}
		hwApplyChatModelIdentity(info, request)
		hwApplyChatModelIdentity(info, request)
		require.Len(t, request.Messages, 2)
		assert.Equal(t, line+"\n\nYou are Bob.", request.Messages[0].StringContent())
	})
	t.Run("chat with multipart system", func(t *testing.T) {
		request := &dto.GeneralOpenAIRequest{Model: "claude-fable-5-1", Messages: []dto.Message{{Role: "system", Content: []any{map[string]any{"type": "text", "text": "You are Bob."}}}}}
		hwApplyChatModelIdentity(info, request)
		hwApplyChatModelIdentity(info, request)
		parts := request.Messages[0].ParseContent()
		require.Len(t, parts, 2)
		assert.Equal(t, line, parts[0].Text)
		assert.Equal(t, "You are Bob.", parts[1].Text)
	})
	t.Run("claude string and blocks", func(t *testing.T) {
		request := &dto.ClaudeRequest{Model: "claude-fable-5-1", System: "You are Bob."}
		hwApplyClaudeModelIdentity(info, request)
		hwApplyClaudeModelIdentity(info, request)
		assert.Equal(t, line+"\n\nYou are Bob.", request.GetStringSystem())

		block := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
		block.SetText("You are Bob.")
		blocks := &dto.ClaudeRequest{Model: "claude-fable-5-1", System: []dto.ClaudeMediaMessage{block}}
		hwApplyClaudeModelIdentity(info, blocks)
		hwApplyClaudeModelIdentity(info, blocks)
		parsed := blocks.ParseSystem()
		require.Len(t, parsed, 2)
		assert.Equal(t, line, parsed[0].GetText())
		assert.Equal(t, "You are Bob.", parsed[1].GetText())

		empty := &dto.ClaudeRequest{Model: "claude-fable-5-1"}
		hwApplyClaudeModelIdentity(info, empty)
		assert.Equal(t, line, empty.GetStringSystem())
	})
	t.Run("responses instructions", func(t *testing.T) {
		request := &dto.OpenAIResponsesRequest{Model: "claude-fable-5-1", Instructions: []byte(`"You are Bob."`)}
		hwApplyResponsesModelIdentity(info, request)
		hwApplyResponsesModelIdentity(info, request)
		var got string
		require.NoError(t, common.Unmarshal(request.Instructions, &got))
		assert.Equal(t, line+"\n\nYou are Bob.", got)

		empty := &dto.OpenAIResponsesRequest{Model: "claude-fable-5-1"}
		hwApplyResponsesModelIdentity(info, empty)
		require.NoError(t, common.Unmarshal(empty.Instructions, &got))
		assert.Equal(t, line, got)
	})
	t.Run("unsold model untouched", func(t *testing.T) {
		request := &dto.GeneralOpenAIRequest{Model: "gpt-4o", Messages: []dto.Message{{Role: "user", Content: "Hi"}}}
		hwApplyChatModelIdentity(&relaycommon.RelayInfo{OriginModelName: "gpt-4o"}, request)
		assert.Len(t, request.Messages, 1)
	})
}
