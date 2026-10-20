package claudemessages

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func claudeMessagesFixture(messages []dto.ClaudeMessage) dto.ClaudeRequest {
	return dto.ClaudeRequest{
		Model:    "claude-test",
		MaxTokens: func() *uint { v := uint(1024); return &v }(),
		Messages: messages,
	}
}

// A1: an assistant message carrying both text and tool_use must keep the text.
func TestClaudeToChatKeepsTextAlongsideToolCalls(t *testing.T) {
	request := claudeMessagesFixture([]dto.ClaudeMessage{
		{
			Role: "assistant",
			Content: []any{
				map[string]any{"type": "text", "text": "Let me look that up."},
				map[string]any{"type": "tool_use", "id": "toolu_1", "name": "lookup", "input": map[string]any{"q": "x"}},
			},
		},
	})

	result, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), request, nil)
	require.NoError(t, err)
	require.Len(t, result.Messages, 1)

	message := result.Messages[0]
	toolCalls := message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "lookup", toolCalls[0].Function.Name)
	content := message.ParseContent()
	require.Len(t, content, 1)
	assert.Equal(t, "Let me look that up.", content[0].Text)
}

// A2: Claude tool_choice maps onto the Chat Completions shape.
func TestClaudeToChatToolChoiceMapping(t *testing.T) {
	cases := []struct {
		name                  string
		toolChoice            any
		wantToolChoice        any
		wantParallelToolCalls *bool
		wantError             bool
	}{
		{name: "absent stays absent", toolChoice: nil, wantToolChoice: nil},
		{
			name:           "auto",
			toolChoice:     map[string]any{"type": "auto"},
			wantToolChoice: "auto",
		},
		{
			name:           "any becomes required",
			toolChoice:     map[string]any{"type": "any"},
			wantToolChoice: "required",
		},
		{
			name:           "none",
			toolChoice:     map[string]any{"type": "none"},
			wantToolChoice: "none",
		},
		{
			name:           "named tool",
			toolChoice:     map[string]any{"type": "tool", "name": "lookup"},
			wantToolChoice: map[string]any{"type": "function", "function": map[string]any{"name": "lookup"}},
		},
		{
			name:                  "disable parallel tool use",
			toolChoice:            map[string]any{"type": "auto", "disable_parallel_tool_use": true},
			wantToolChoice:        "auto",
			wantParallelToolCalls: func() *bool { v := false; return &v }(),
		},
		{
			name:      "unknown type errors",
			toolChoice: map[string]any{"type": "bogus"},
			wantError: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			request := claudeMessagesFixture([]dto.ClaudeMessage{
				{Role: "user", Content: "hi"},
			})
			request.ToolChoice = tc.toolChoice

			result, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), request, nil)
			if tc.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantToolChoice, result.ToolChoice)
			if tc.wantParallelToolCalls == nil {
				assert.Nil(t, result.ParallelTooCalls)
			} else {
				require.NotNil(t, result.ParallelTooCalls)
				assert.Equal(t, *tc.wantParallelToolCalls, *result.ParallelTooCalls)
			}
		})
	}
}

// A5 (request side): thinking history blocks are dropped with a diagnostic,
// never forwarded as content.
func TestClaudeToChatThinkingHistoryDroppedWithDiagnostic(t *testing.T) {
	request := claudeMessagesFixture([]dto.ClaudeMessage{
		{
			Role: "assistant",
			Content: []any{
				map[string]any{"type": "thinking", "thinking": "deliberating"},
				map[string]any{"type": "text", "text": "Answer"},
			},
		},
	})

	ctx, collector := convdiag.WithCollector(context.Background())
	result, err := ClaudeMessagesRequestToOpenAIChat(ctx, request, &convmeta.Values{})
	require.NoError(t, err)
	require.Len(t, result.Messages, 1)
	content := result.Messages[0].ParseContent()
	require.Len(t, content, 1)
	assert.Equal(t, "text", content[0].Type)

	diagnostics := collector.Diagnostics()
	require.Len(t, diagnostics, 1)
	assert.Equal(t, "thinking_history_dropped", diagnostics[0].Code)
	assert.Equal(t, types.ConversionDiagnosticWarning, diagnostics[0].Severity)
	assert.Contains(t, diagnostics[0].Path, "messages[0].content[0]")
}
