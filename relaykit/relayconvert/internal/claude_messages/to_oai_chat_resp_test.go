package claudemessages

import (
	"context"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func intPtr(v int) *int { return &v }

func kitutilPtr[T any](v T) *T { return &v }

// A3: untraceable tool deltas are defensively skipped with a diagnostic
// instead of aborting the stream.
func TestConvertChunkSkipsUntraceableToolDeltas(t *testing.T) {
	cases := []struct {
		name      string
		chunk     *dto.ClaudeResponse
		wantCode  string
		wantTrace bool
	}{
		{
			name:      "unknown block index",
			chunk:     &dto.ClaudeResponse{Type: "content_block_delta", Index: intPtr(7), Delta: &dto.ClaudeMediaMessage{Type: "input_json_delta", PartialJson: kitutilPtr(`{"q":1}`)}},
			wantCode:  "stream_unknown_block_index",
			wantTrace: true,
		},
		{
			name:      "missing block index",
			chunk:     &dto.ClaudeResponse{Type: "content_block_delta", Delta: &dto.ClaudeMediaMessage{Type: "input_json_delta", PartialJson: kitutilPtr(`{"q":1}`)}},
			wantCode:  "stream_index_missing",
			wantTrace: true,
		},
		{
			name:      "missing partial json",
			chunk:     &dto.ClaudeResponse{Type: "content_block_delta", Index: intPtr(0), Delta: &dto.ClaudeMediaMessage{Type: "input_json_delta"}},
			wantCode:  "stream_index_missing",
			wantTrace: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ctx, collector := convdiag.WithCollector(context.Background())
			state := NewClaudeToChatStreamState()
			chunk, err := state.ConvertChunk(ctx, tc.chunk)
			require.NoError(t, err)
			assert.Nil(t, chunk)
			if tc.wantTrace {
				diagnostics := collector.Diagnostics()
				require.Len(t, diagnostics, 1)
				assert.Equal(t, tc.wantCode, diagnostics[0].Code)
			}
		})
	}
}

// A3: a missing index on content_block_start is skipped, not fatal.
func TestConvertChunkSkipsBlockStartMissingIndex(t *testing.T) {
	ctx, collector := convdiag.WithCollector(context.Background())
	state := NewClaudeToChatStreamState()
	chunk, err := state.ConvertChunk(ctx, &dto.ClaudeResponse{
		Type:         "content_block_start",
		ContentBlock: &dto.ClaudeMediaMessage{Type: "tool_use", Id: "toolu_1", Name: "lookup"},
	})
	require.NoError(t, err)
	assert.Nil(t, chunk)
	diagnostics := collector.Diagnostics()
	require.Len(t, diagnostics, 1)
	assert.Equal(t, "stream_index_missing", diagnostics[0].Code)
}

// A4: the stream state synthesizes the terminal chunk only when the upstream
// never delivered a stop event.
func TestFinalizeClaudeToChatStream(t *testing.T) {
	t.Run("synthesizes stop after plain text", func(t *testing.T) {
		state := NewClaudeToChatStreamState()
		_, err := state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
			Type:    "message_start",
			Message: &dto.ClaudeMediaMessage{Id: "msg_1", Model: "claude-test", Type: "message"},
		})
		require.NoError(t, err)
		_, err = state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
			Type:  "content_block_start",
			Index: intPtr(0),
			ContentBlock: &dto.ClaudeMediaMessage{
				Type: "text",
				Text: kitutilPtr(""),
			},
		})
		require.NoError(t, err)

		terminal := FinalizeClaudeToChatStream(state)
		require.NotNil(t, terminal)
		require.Len(t, terminal.Choices, 1)
		require.NotNil(t, terminal.Choices[0].FinishReason)
		assert.Equal(t, "stop", *terminal.Choices[0].FinishReason)
		assert.Equal(t, "msg_1", terminal.Id)
		assert.Equal(t, "claude-test", terminal.Model)
		assert.Empty(t, terminal.Choices[0].Delta.GetContentString())

		// A second finalize is a no-op.
		assert.Nil(t, FinalizeClaudeToChatStream(state))
	})

	t.Run("synthesizes tool_calls after tool use", func(t *testing.T) {
		state := NewClaudeToChatStreamState()
		_, err := state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
			Type:         "content_block_start",
			Index:        intPtr(0),
			ContentBlock: &dto.ClaudeMediaMessage{Type: "tool_use", Id: "toolu_1", Name: "lookup"},
		})
		require.NoError(t, err)

		terminal := FinalizeClaudeToChatStream(state)
		require.NotNil(t, terminal)
		require.Len(t, terminal.Choices, 1)
		require.NotNil(t, terminal.Choices[0].FinishReason)
		assert.Equal(t, "tool_calls", *terminal.Choices[0].FinishReason)
	})

	t.Run("no-op after message_delta stop reason", func(t *testing.T) {
		state := NewClaudeToChatStreamState()
		_, err := state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
			Type:  "message_delta",
			Delta: &dto.ClaudeMediaMessage{Type: "message_delta", StopReason: kitutilPtr("end_turn")},
		})
		require.NoError(t, err)
		assert.Nil(t, FinalizeClaudeToChatStream(state))
	})

	t.Run("no-op after error event", func(t *testing.T) {
		state := NewClaudeToChatStreamState()
		chunk, err := state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
			Type:  "error",
			Error: map[string]any{"type": "overloaded_error", "message": "Overloaded"},
		})
		require.NoError(t, err)
		assert.Nil(t, chunk)
		assert.Nil(t, FinalizeClaudeToChatStream(state))
	})
}

// A5 (response side): signature deltas never surface as reasoning content.
func TestSignatureDeltaIsNotReasoningContent(t *testing.T) {
	signatureChunk := &dto.ClaudeResponse{
		Type:  "content_block_delta",
		Index: intPtr(0),
		Delta: &dto.ClaudeMediaMessage{Type: "signature_delta", Signature: "sig=="},
	}

	t.Run("stateless", func(t *testing.T) {
		chunk := StreamResponseClaude2OpenAI(signatureChunk)
		require.NotNil(t, chunk)
		require.Len(t, chunk.Choices, 1)
		assert.Nil(t, chunk.Choices[0].Delta.ReasoningContent)
	})

	t.Run("stateful", func(t *testing.T) {
		state := NewClaudeToChatStreamState()
		chunk, err := state.ConvertChunk(context.Background(), signatureChunk)
		require.NoError(t, err)
		assert.Nil(t, chunk)
	})
}

// A4/A9 seam: message_start and message_delta usage merge into the state and
// ride on the synthesized terminal chunk.
func TestFinalizeCarriesMergedUsage(t *testing.T) {
	state := NewClaudeToChatStreamState()
	_, err := state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
		Type: "message_start",
		Message: &dto.ClaudeMediaMessage{
			Id:    "msg_1",
			Model: "claude-test",
			Type:  "message",
			Usage: &dto.ClaudeUsage{InputTokens: 4, OutputTokens: 0},
		},
	})
	require.NoError(t, err)
	_, err = state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
		Type:  "message_delta",
		Delta: &dto.ClaudeMediaMessage{StopReason: kitutilPtr("max_tokens")},
		Usage: &dto.ClaudeUsage{OutputTokens: 9},
	})
	require.NoError(t, err)

	usage := state.StreamUsage()
	require.NotNil(t, usage)
	assert.Equal(t, 4, usage.PromptTokens)
	assert.Equal(t, 9, usage.CompletionTokens)
}

// A8/A17/A18: non-stream conversion accumulates every thinking block, keeps
// the generated id when upstream omits one, and defaults finish_reason.
func TestResponseClaude2OpenAINonStream(t *testing.T) {
	claudeResponse := &dto.ClaudeResponse{
		Type:  "message",
		Model: "claude-test",
		Content: []dto.ClaudeMediaMessage{
			{Type: "thinking", Thinking: kitutilPtr("first part")},
			{Type: "tool_use", Id: "toolu_1", Name: "lookup", Input: map[string]any{"q": 1}},
			{Type: "thinking", Thinking: kitutilPtr(" second part")},
			{Type: "text", Text: kitutilPtr("Answer")},
		},
	}

	t.Run("accumulates all thinking blocks", func(t *testing.T) {
		result := ResponseClaude2OpenAI(claudeResponse)
		require.Len(t, result.Choices, 1)
		require.NotNil(t, result.Choices[0].ReasoningContent)
		assert.Equal(t, "first part second part", *result.Choices[0].ReasoningContent)
		assert.Equal(t, "Answer", result.Choices[0].StringContent())
		require.Len(t, result.Choices[0].ParseToolCalls(), 1)
	})

	t.Run("keeps generated id when upstream id empty", func(t *testing.T) {
		result := ResponseClaude2OpenAI(claudeResponse)
		assert.True(t, strings.HasPrefix(result.Id, "chatcmpl-"))
	})

	t.Run("empty finish reason becomes stop", func(t *testing.T) {
		result := ResponseClaude2OpenAI(claudeResponse)
		assert.Equal(t, "stop", result.Choices[0].FinishReason)
	})
}

// A15/A16: a message_delta without a stop reason is skipped by the stateful
// path instead of emitting an empty choice; stateless keeps the finish reason.
func TestMessageDeltaWithoutStopReason(t *testing.T) {
	delta := &dto.ClaudeResponse{
		Type:  "message_delta",
		Usage: &dto.ClaudeUsage{OutputTokens: 3},
	}

	t.Run("stateful skips chunk but keeps usage", func(t *testing.T) {
		state := NewClaudeToChatStreamState()
		chunk, err := state.ConvertChunk(context.Background(), delta)
		require.NoError(t, err)
		assert.Nil(t, chunk)
		require.NotNil(t, state.StreamUsage())
		assert.Equal(t, 3, state.StreamUsage().CompletionTokens)
	})

	t.Run("stateless emits no finish reason", func(t *testing.T) {
		chunk := StreamResponseClaude2OpenAI(delta)
		require.NotNil(t, chunk)
		require.Len(t, chunk.Choices, 1)
		assert.Nil(t, chunk.Choices[0].FinishReason)
	})
}

// A9/A10: the terminal chunk carries merged usage and consistent identity.
func TestTerminalChunkCarriesUsageAndIdentity(t *testing.T) {
	state := NewClaudeToChatStreamState()
	_, err := state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
		Type: "message_start",
		Message: &dto.ClaudeMediaMessage{
			Id:    "msg_9",
			Model: "claude-test",
			Type:  "message",
			Usage: &dto.ClaudeUsage{InputTokens: 6, OutputTokens: 0},
		},
	})
	require.NoError(t, err)

	chunk, err := state.ConvertChunk(context.Background(), &dto.ClaudeResponse{
		Type:  "message_delta",
		Delta: &dto.ClaudeMediaMessage{StopReason: kitutilPtr("end_turn")},
		Usage: &dto.ClaudeUsage{OutputTokens: 5},
	})
	require.NoError(t, err)
	require.NotNil(t, chunk)
	assert.Equal(t, "msg_9", chunk.Id)
	assert.Equal(t, "claude-test", chunk.Model)
	require.NotNil(t, chunk.Usage)
	assert.Equal(t, 6, chunk.Usage.PromptTokens)
	assert.Equal(t, 5, chunk.Usage.CompletionTokens)
	assert.NotZero(t, chunk.Usage.TotalTokens)
	require.NotNil(t, chunk.Choices[0].FinishReason)
	assert.Equal(t, "stop", *chunk.Choices[0].FinishReason)
}
