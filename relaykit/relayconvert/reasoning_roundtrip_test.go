package relayconvert_test

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	claudemessages "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/claude_messages"
	oaichat "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/oai_chat"
	oairesponses "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/oai_responses"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// chat -> responses -> chat: replayed assistant reasoning must survive the full
// circle on the same assistant message that carries the tool call.
func TestReasoningRoundTripChatResponsesChat(t *testing.T) {
	reasoning := "先定位城市，再查天气"
	assistant := dto.Message{Role: "assistant", ReasoningContent: lo.ToPtr(reasoning)}
	assistant.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "get_weather",
				Arguments: `{"city":"beijing"}`,
			},
		},
	})

	responsesReq, err := oaichat.ChatCompletionsRequestToResponsesRequest(&dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "user", Content: "查天气"},
			assistant,
			{Role: "tool", ToolCallId: "call_1", Content: "晴"},
			{Role: "user", Content: "继续"},
		},
	})
	require.NoError(t, err)

	back, err := oairesponses.ResponsesRequestToChatCompletionsRequest(responsesReq)
	require.NoError(t, err)

	var found *dto.Message
	for i := range back.Messages {
		if back.Messages[i].Role == "assistant" && len(back.Messages[i].ParseToolCalls()) > 0 {
			found = &back.Messages[i]
		}
	}
	require.NotNil(t, found, "assistant message carrying the tool call is missing")
	assert.Equal(t, reasoning, found.GetReasoningContent())
	toolCalls := found.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "call_1", toolCalls[0].ID)
}

// claude -> chat -> claude: thinking text survives the full circle (the
// signature cannot cross the chat format and is intentionally dropped). The
// thinking-bearing assistant turn is followed by a later assistant turn, so it
// is not the latest assistant message and its thinking block is replayed.
func TestReasoningRoundTripClaudeChatClaude(t *testing.T) {
	chatReq, err := claudemessages.ClaudeMessagesRequestToOpenAIChat(dto.ClaudeRequest{
		Model: "claude-test",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "查天气"},
			{Role: "assistant", Content: []any{
				map[string]any{"type": "thinking", "thinking": "先定位城市", "signature": "sig"},
				map[string]any{"type": "tool_use", "id": "call_1", "name": "get_weather", "input": map[string]any{}},
			}},
			{Role: "user", Content: []any{
				map[string]any{"type": "tool_result", "tool_use_id": "call_1", "content": "晴"},
			}},
			{Role: "assistant", Content: "北京今天晴"},
		},
	}, nil)
	require.NoError(t, err)
	chatReq.MaxTokens = lo.ToPtr(uint(1024))

	back, err := oaichat.OpenAIChatRequestToClaudeMessages(nil, nil, *chatReq)
	require.NoError(t, err)

	var thinkingText string
	toolUseFound := false
	for _, message := range back.Messages {
		if message.Role != "assistant" {
			continue
		}
		blocks, ok := message.Content.([]dto.ClaudeMediaMessage)
		if !ok {
			continue
		}
		for _, block := range blocks {
			if block.Type == "thinking" && block.Thinking != nil {
				thinkingText = *block.Thinking
			}
			if block.Type == "tool_use" {
				toolUseFound = true
			}
		}
	}
	assert.Equal(t, "先定位城市", thinkingText)
	assert.True(t, toolUseFound, "tool_use block missing after round trip")
}

// claude -> chat -> claude with the thinking-bearing assistant turn as the
// LATEST assistant message (tool-use continuation): Anthropic signature-verifies
// thinking blocks in that position and a synthesized unsigned block would be
// rejected with a 400, so the converter deliberately withholds it and keeps the
// pre-fix accepted shape (text + tool_use, no thinking block).
func TestReasoningRoundTripClaudeChatClaudeLatestTurnWithheld(t *testing.T) {
	chatReq, err := claudemessages.ClaudeMessagesRequestToOpenAIChat(dto.ClaudeRequest{
		Model: "claude-test",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "查天气"},
			{Role: "assistant", Content: []any{
				map[string]any{"type": "thinking", "thinking": "先定位城市", "signature": "sig"},
				map[string]any{"type": "tool_use", "id": "call_1", "name": "get_weather", "input": map[string]any{}},
			}},
			{Role: "user", Content: []any{
				map[string]any{"type": "tool_result", "tool_use_id": "call_1", "content": "晴"},
			}},
		},
	}, nil)
	require.NoError(t, err)
	chatReq.MaxTokens = lo.ToPtr(uint(1024))

	back, err := oaichat.OpenAIChatRequestToClaudeMessages(nil, nil, *chatReq)
	require.NoError(t, err)

	toolUseFound := false
	for _, message := range back.Messages {
		if message.Role != "assistant" {
			continue
		}
		blocks, ok := message.Content.([]dto.ClaudeMediaMessage)
		if !ok {
			continue
		}
		for _, block := range blocks {
			assert.NotEqual(t, "thinking", block.Type, "unsigned thinking block must not be emitted on the latest assistant turn")
			if block.Type == "tool_use" {
				toolUseFound = true
			}
		}
	}
	assert.True(t, toolUseFound, "tool_use block missing after round trip")
}
