package claudemessages

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/internal/convdiag"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func claudeMessagesFixture(messages []dto.ClaudeMessage) dto.ClaudeRequest {
	return dto.ClaudeRequest{
		Model:     "claude-test",
		MaxTokens: func() *uint { v := uint(1024); return &v }(),
		Messages:  messages,
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
			name:       "unknown type errors",
			toolChoice: map[string]any{"type": "bogus"},
			wantError:  true,
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

// A6: image sources use claudeSourceURL (remote URLs pass through; nil
// sources are skipped with a diagnostic instead of producing "data:;base64,").
func TestClaudeToChatImageSourceHandling(t *testing.T) {
	t.Run("remote url source", func(t *testing.T) {
		request := claudeMessagesFixture([]dto.ClaudeMessage{
			{
				Role: "user",
				Content: []any{
					map[string]any{"type": "image", "source": map[string]any{"type": "url", "url": "https://example.test/a.png"}},
				},
			},
		})
		result, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), request, nil)
		require.NoError(t, err)
		parts := result.Messages[0].ParseContent()
		require.Len(t, parts, 1)
		media := parts[0].GetImageMedia()
		require.NotNil(t, media)
		assert.Equal(t, "https://example.test/a.png", media.Url)
	})

	t.Run("missing source skipped with diagnostic", func(t *testing.T) {
		request := claudeMessagesFixture([]dto.ClaudeMessage{
			{
				Role: "user",
				Content: []any{
					map[string]any{"type": "text", "text": "hi"},
					map[string]any{"type": "image"},
				},
			},
		})
		ctx, collector := convdiag.WithCollector(context.Background())
		result, err := ClaudeMessagesRequestToOpenAIChat(ctx, request, nil)
		require.NoError(t, err)
		parts := result.Messages[0].ParseContent()
		require.Len(t, parts, 1)
		assert.Equal(t, "text", parts[0].Type)

		diagnostics := collector.Diagnostics()
		require.Len(t, diagnostics, 1)
		assert.Equal(t, "unsupported_media_source", diagnostics[0].Code)
		assert.Equal(t, types.ConversionDiagnosticError, diagnostics[0].Severity)
	})
}

// A7: block order is preserved across tool_result boundaries and tool names
// resolve from earlier tool_use blocks (nil when unknown).
func TestClaudeToChatPreservesBlockOrderAroundToolResults(t *testing.T) {
	request := claudeMessagesFixture([]dto.ClaudeMessage{
		{
			Role: "assistant",
			Content: []any{
				map[string]any{"type": "tool_use", "id": "toolu_1", "name": "lookup", "input": map[string]any{}},
			},
		},
		{
			Role: "user",
			Content: []any{
				map[string]any{"type": "tool_result", "tool_use_id": "toolu_1", "content": "found it"},
				map[string]any{"type": "text", "text": "and also this"},
				map[string]any{"type": "tool_result", "tool_use_id": "toolu_unknown", "content": "?"},
			},
		},
	})

	result, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), request, nil)
	require.NoError(t, err)
	// Block order is preserved: tool_result, text, tool_result.
	require.Len(t, result.Messages, 4)

	assert.Equal(t, "assistant", result.Messages[0].Role)

	toolMsg := result.Messages[1]
	assert.Equal(t, "tool", toolMsg.Role)
	require.NotNil(t, toolMsg.Name)
	assert.Equal(t, "lookup", *toolMsg.Name)
	assert.Equal(t, "toolu_1", toolMsg.ToolCallId)

	assert.Equal(t, "user", result.Messages[2].Role)
	userParts := result.Messages[2].ParseContent()
	require.Len(t, userParts, 1)
	assert.Equal(t, "and also this", userParts[0].Text)

	unknownToolMsg := result.Messages[3]
	assert.Equal(t, "tool", unknownToolMsg.Role)
	assert.Nil(t, unknownToolMsg.Name, "unknown tool names must stay nil, not empty")
}

// A11: max_tokens_to_sample is honored when max_tokens is absent.
func TestClaudeToChatMaxTokensToSampleFallback(t *testing.T) {
	request := claudeMessagesFixture([]dto.ClaudeMessage{{Role: "user", Content: "hi"}})
	request.MaxTokens = nil
	request.MaxTokensToSample = func() *uint { v := uint(777); return &v }()

	result, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), request, nil)
	require.NoError(t, err)
	require.NotNil(t, result.MaxTokens)
	assert.Equal(t, uint(777), *result.MaxTokens)
}

// A19: anthropic cache_control only rides on content parts for the OpenRouter
// dialect.
func TestClaudeToChatCacheControlOnlyForOpenRouter(t *testing.T) {
	cacheControl := json.RawMessage(`{"type":"ephemeral"}`)
	request := claudeMessagesFixture([]dto.ClaudeMessage{
		{
			Role: "user",
			Content: []any{
				map[string]any{"type": "text", "text": "hi", "cache_control": cacheControl},
			},
		},
	})

	t.Run("default dialect drops cache_control", func(t *testing.T) {
		result, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), request, nil)
		require.NoError(t, err)
		parts := result.Messages[0].ParseContent()
		require.Len(t, parts, 1)
		assert.Nil(t, parts[0].CacheControl)
	})

	t.Run("openrouter dialect keeps cache_control", func(t *testing.T) {
		info := &convmeta.Values{Options: &convmeta.Options{OpenRouterDialect: true}}
		result, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), request, info)
		require.NoError(t, err)
		parts := result.Messages[0].ParseContent()
		require.Len(t, parts, 1)
		assert.JSONEq(t, `{"type":"ephemeral"}`, string(parts[0].CacheControl))
	})
}

// A21: Claude-only request fields are reported as dropped_request_field.
func TestClaudeToChatDroppedRequestFieldDiagnostics(t *testing.T) {
	request := claudeMessagesFixture([]dto.ClaudeMessage{{Role: "user", Content: "hi"}})
	request.Metadata = json.RawMessage(`{"user_id":"u1"}`)
	request.McpServers = json.RawMessage(`[]`)
	request.ServiceTier = "standard_only"

	ctx, collector := convdiag.WithCollector(context.Background())
	_, err := ClaudeMessagesRequestToOpenAIChat(ctx, request, nil)
	require.NoError(t, err)

	codes := map[string]int{}
	for _, diagnostic := range collector.Diagnostics() {
		if diagnostic.Code == "dropped_request_field" {
			codes[diagnostic.Path]++
		}
	}
	assert.Equal(t, 1, codes["metadata"])
	assert.Equal(t, 1, codes["service_tier"])
	// mcp_servers: `[]` is present JSON, so it is still reported.
	assert.Equal(t, 1, codes["mcp_servers"])
	assert.Equal(t, 0, codes["context_management"])
	assert.Equal(t, 0, codes["chat_template_kwargs"])
}

func TestClaudeMessagesRequestToOpenAIChatToolResultContent(t *testing.T) {
	const imageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
	const dataURL = "data:image/png;base64," + imageData
	imageBlock := dto.ClaudeMediaMessage{
		Type:   "image",
		Source: &dto.ClaudeMessageSource{Type: "base64", MediaType: "image/png", Data: imageData},
	}
	textBlock := func(text string) dto.ClaudeMediaMessage {
		return dto.ClaudeMediaMessage{Type: "text", Text: lo.ToPtr(text)}
	}

	tests := []struct {
		name        string
		content     any
		wantContent string
		wantImages  []string
	}{
		{
			name:        "string passes through",
			content:     "done",
			wantContent: "done",
		},
		{
			name:        "text and image keep text on tool message",
			content:     []dto.ClaudeMediaMessage{textBlock("screenshot taken"), imageBlock},
			wantContent: "screenshot taken",
			wantImages:  []string{dataURL},
		},
		{
			name:        "image only uses placeholder",
			content:     []dto.ClaudeMediaMessage{imageBlock},
			wantContent: "[image]",
			wantImages:  []string{dataURL},
		},
		{
			name: "url image source is forwarded as is",
			content: []dto.ClaudeMediaMessage{{
				Type:   "image",
				Source: &dto.ClaudeMessageSource{Type: "url", Url: "https://example.com/shot.png"},
			}},
			wantContent: "[image]",
			wantImages:  []string{"https://example.com/shot.png"},
		},
		{
			name:        "text blocks join with newline",
			content:     []dto.ClaudeMediaMessage{textBlock("first"), textBlock(""), textBlock("second")},
			wantContent: "first\nsecond",
		},
		{
			name:        "unknown block keeps whole array",
			content:     []dto.ClaudeMediaMessage{textBlock("see doc"), {Type: "document", Data: "opaque"}},
			wantContent: `[{"type":"text","text":"see doc"},{"type":"document","data":"opaque"}]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
				Model:     "claude-test",
				MaxTokens: lo.ToPtr(uint(64)),
				Messages: []dto.ClaudeMessage{
					{Role: "user", Content: "take a screenshot"},
					{Role: "assistant", Content: []dto.ClaudeMediaMessage{
						{Type: "tool_use", Id: "toolu_1", Name: "screenshot", Input: map[string]any{}},
					}},
					{Role: "user", Content: []dto.ClaudeMediaMessage{
						{Type: "tool_result", ToolUseId: "toolu_1", Content: tt.content},
						textBlock("what do you see?"),
					}},
				},
			}, &convmeta.Values{})
			require.NoError(t, err)

			require.Len(t, got.Messages, 4)
			tool := got.Messages[2]
			assert.Equal(t, "tool", tool.Role)
			assert.Equal(t, "toolu_1", tool.ToolCallId)
			if tt.wantImages == nil && tt.wantContent[0] == '[' {
				assert.JSONEq(t, tt.wantContent, tool.StringContent())
			} else {
				assert.Equal(t, tt.wantContent, tool.StringContent())
			}

			user := got.Messages[3]
			assert.Equal(t, "user", user.Role)
			parts := user.ParseContent()
			require.Len(t, parts, len(tt.wantImages)+1)
			for i, wantURL := range tt.wantImages {
				assert.Equal(t, dto.ContentTypeImageURL, parts[i].Type)
				require.NotNil(t, parts[i].GetImageMedia())
				assert.Equal(t, wantURL, parts[i].GetImageMedia().Url)
			}
			assert.Equal(t, dto.ContentTypeText, parts[len(parts)-1].Type)
			assert.Equal(t, "what do you see?", parts[len(parts)-1].Text)
		})
	}
}

func TestClaudeMessagesRequestToOpenAIChatKeepsParallelToolResultsContiguous(t *testing.T) {
	const dataURL = "data:image/png;base64,iVBORw0KGgo="
	got, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
		Model:     "claude-test",
		MaxTokens: lo.ToPtr(uint(64)),
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "screenshot and read the note"},
			{Role: "assistant", Content: []dto.ClaudeMediaMessage{
				{Type: "text", Text: lo.ToPtr("Let me look.")},
				{Type: "tool_use", Id: "toolu_shot", Name: "screenshot", Input: map[string]any{}},
				{Type: "tool_use", Id: "toolu_read", Name: "read_file", Input: map[string]any{"path": "note.txt"}},
			}},
			{Role: "user", Content: []dto.ClaudeMediaMessage{
				{Type: "tool_result", ToolUseId: "toolu_shot", Content: []dto.ClaudeMediaMessage{{
					Type:   "image",
					Source: &dto.ClaudeMessageSource{Type: "base64", MediaType: "image/png", Data: "iVBORw0KGgo="},
				}}},
				{Type: "tool_result", ToolUseId: "toolu_read", Content: "note contents"},
			}},
		},
	}, &convmeta.Values{})
	require.NoError(t, err)

	roles := make([]string, 0, len(got.Messages))
	for _, message := range got.Messages {
		roles = append(roles, message.Role)
	}
	assert.Equal(t, []string{"user", "assistant", "tool", "tool", "user"}, roles)
	assert.Len(t, got.Messages[1].ParseToolCalls(), 2)
	assert.Equal(t, "[image]", got.Messages[2].StringContent())
	assert.Equal(t, "toolu_shot", got.Messages[2].ToolCallId)
	assert.Equal(t, "note contents", got.Messages[3].StringContent())
	assert.NotContains(t, got.Messages[2].StringContent()+got.Messages[3].StringContent(), "base64")

	parts := got.Messages[4].ParseContent()
	require.Len(t, parts, 1)
	assert.Equal(t, dto.ContentTypeImageURL, parts[0].Type)
	require.NotNil(t, parts[0].GetImageMedia())
	assert.Equal(t, dataURL, parts[0].GetImageMedia().Url)
}

// #7175: single-element stop_sequences must stay an array; some upstreams
// reject the collapsed string form. #4317: output_config drops are reported.
func TestClaudeToChatStopSequencesAndOutputConfigDiagnostics(t *testing.T) {
	request := claudeMessagesFixture([]dto.ClaudeMessage{{Role: "user", Content: "hi"}})
	request.StopSequences = []string{"END"}
	request.OutputConfig = json.RawMessage(`{"effort":"high"}`)

	ctx, collector := convdiag.WithCollector(context.Background())
	result, err := ClaudeMessagesRequestToOpenAIChat(ctx, request, nil)
	require.NoError(t, err)

	stopRaw, err := json.Marshal(result.Stop)
	require.NoError(t, err)
	assert.JSONEq(t, `["END"]`, string(stopRaw), "single stop must serialize as an array")

	codes := map[string]int{}
	for _, diagnostic := range collector.Diagnostics() {
		if diagnostic.Code == "dropped_request_field" {
			codes[diagnostic.Path]++
		}
	}
	assert.Equal(t, 1, codes["output_config"])
}

// A12: an invalid Claude tools payload errors out instead of silently
// converting to zero tools.
func TestClaudeToChatInvalidToolsPayloadErrors(t *testing.T) {
	request := claudeMessagesFixture([]dto.ClaudeMessage{{Role: "user", Content: "hi"}})
	request.Tools = "not-an-array"

	_, err := ClaudeMessagesRequestToOpenAIChat(context.Background(), request, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid Claude tools")
}
