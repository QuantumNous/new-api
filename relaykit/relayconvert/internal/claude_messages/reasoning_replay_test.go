package claudemessages

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeMessagesRequestToOpenAIChatPreservesAssistantReasoningHistoryWhenOptedIn(t *testing.T) {
	got, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
		Model: "standard",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "first prompt"},
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "thinking", Thinking: reasoningString("thought one"), Signature: "opaque-signature"},
				{Type: "text", Text: reasoningString("answer one")},
				{Type: "thinking", Thinking: reasoningString(" + thought two")},
			}},
			{Role: "user", Content: []dto.ClaudeMediaMessage{
				{Type: "thinking", Thinking: reasoningString("user-side text must not become reasoning")},
				{Type: "text", Text: reasoningString("second prompt")},
			}},
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "thinking", Signature: "signature-without-plaintext"},
				{Type: "text", Text: reasoningString("answer two")},
			}},
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "text", Text: reasoningString("visible answer")},
				{Type: "redacted_thinking", Data: "opaque-redacted-payload", Signature: "opaque-redacted-signature"},
			}},
		},
	}, &convmeta.Values{Options: reasoningOptIn()})
	require.NoError(t, err)
	require.Len(t, got.Messages, 5)

	firstAssistant := got.Messages[1]
	assert.Equal(t, "assistant", firstAssistant.Role)
	require.NotNil(t, firstAssistant.ReasoningContent)
	assert.Equal(t, "thought one + thought two", *firstAssistant.ReasoningContent)
	firstParts := firstAssistant.ParseContent()
	require.Len(t, firstParts, 1)
	assert.Equal(t, "answer one", firstParts[0].Text)

	userMessage := got.Messages[2]
	assert.Equal(t, "user", userMessage.Role)
	assert.Nil(t, userMessage.ReasoningContent, "user-side thinking blocks are not assistant reasoning")
	userParts := userMessage.ParseContent()
	require.Len(t, userParts, 1)
	assert.Equal(t, "second prompt", userParts[0].Text)

	secondAssistant := got.Messages[3]
	assert.Equal(t, "assistant", secondAssistant.Role)
	assert.Nil(t, secondAssistant.ReasoningContent, "a history without plaintext thinking must not gain an empty field")
	secondParts := secondAssistant.ParseContent()
	require.Len(t, secondParts, 1)
	assert.Equal(t, "answer two", secondParts[0].Text)

	thirdAssistant := got.Messages[4]
	assert.Equal(t, "assistant", thirdAssistant.Role)
	assert.Nil(t, thirdAssistant.ReasoningContent, "redacted or opaque reasoning metadata is not plaintext reasoning")
	thirdParts := thirdAssistant.ParseContent()
	require.Len(t, thirdParts, 1)
	assert.Equal(t, "visible answer", thirdParts[0].Text)
}

func TestClaudeMessagesRequestToOpenAIChatKeepsReasoningOnlyAssistantAndToolHistoryWhenOptedIn(t *testing.T) {
	got, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
		Model: "deepseek-v4.1-flash",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "use a tool"},
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "thinking", Thinking: reasoningString("before tool")},
				{Type: "tool_use", Id: "toolu_1", Name: "lookup", Input: map[string]any{"q": "value"}},
			}},
			{Role: "user", Content: []dto.ClaudeMediaMessage{
				{Type: "tool_result", ToolUseId: "toolu_1", Content: "tool result body"},
			}},
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "thinking", Thinking: reasoningString("reasoning-only continuation")},
			}},
		},
	}, &convmeta.Values{Options: reasoningOptIn()})
	require.NoError(t, err)
	require.Len(t, got.Messages, 4)

	assistantWithTool := got.Messages[1]
	assert.Equal(t, "assistant", assistantWithTool.Role)
	require.NotNil(t, assistantWithTool.ReasoningContent)
	assert.Equal(t, "before tool", *assistantWithTool.ReasoningContent)
	require.Len(t, assistantWithTool.ParseToolCalls(), 1)
	assert.Equal(t, "toolu_1", assistantWithTool.ParseToolCalls()[0].ID)

	toolResult := got.Messages[2]
	assert.Equal(t, "tool", toolResult.Role)
	assert.Equal(t, "toolu_1", toolResult.ToolCallId)
	assert.Equal(t, "tool result body", toolResult.StringContent())

	reasoningOnly := got.Messages[3]
	assert.Equal(t, "assistant", reasoningOnly.Role)
	require.NotNil(t, reasoningOnly.ReasoningContent, "reasoning-only assistant history must remain representable")
	assert.Equal(t, "reasoning-only continuation", *reasoningOnly.ReasoningContent)
	assert.Empty(t, reasoningOnly.ParseContent())
}

func TestClaudeMessagesRequestToOpenAIChatPreservesExplicitEmptyReasoningWhenOptedIn(t *testing.T) {
	got, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
		Model: "standard",
		Messages: []dto.ClaudeMessage{
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "thinking", Thinking: reasoningString("")},
			}},
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "text", Text: reasoningString("no thinking block")},
			}},
		},
	}, &convmeta.Values{Options: reasoningOptIn()})
	require.NoError(t, err)
	require.Len(t, got.Messages, 2, "an explicit empty thinking block still represents an assistant message")
	assert.Equal(t, "assistant", got.Messages[0].Role)
	require.NotNil(t, got.Messages[0].ReasoningContent)
	assert.Empty(t, *got.Messages[0].ReasoningContent)
	assert.Nil(t, got.Messages[1].ReasoningContent)
}

func TestClaudeMessagesRequestToOpenAIChatDoesNotForwardReasoningByDefault(t *testing.T) {
	got, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
		Model: "deepseek-v4.1-flash",
		Messages: []dto.ClaudeMessage{{
			Role: "assistant",
			Content: []dto.ClaudeMediaMessage{
				{Type: "thinking", Thinking: reasoningString("opt-in disabled")},
				{Type: "text", Text: reasoningString("visible answer")},
			},
		}},
	}, nil)
	require.NoError(t, err)
	require.Len(t, got.Messages, 1)
	assert.Nil(t, got.Messages[0].ReasoningContent)
	parts := got.Messages[0].ParseContent()
	require.Len(t, parts, 1)
	assert.Equal(t, "visible answer", parts[0].Text)
}

func reasoningOptIn() *convmeta.Options {
	return &convmeta.Options{PreserveAssistantReasoning: true}
}

func reasoningString(value string) *string {
	return &value
}
