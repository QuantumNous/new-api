package claude

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func commonPointer[T any](value T) *T {
	return &value
}

func TestFormatClaudeResponseInfo_MessageStart(t *testing.T) {
	claudeInfo := &ClaudeResponseInfo{
		Usage: &dto.Usage{},
	}
	claudeResponse := &dto.ClaudeResponse{
		Type: "message_start",
		Message: &dto.ClaudeMediaMessage{
			Id:    "msg_123",
			Model: "claude-3-5-sonnet",
			Usage: &dto.ClaudeUsage{
				InputTokens:              100,
				OutputTokens:             1,
				CacheCreationInputTokens: 50,
				CacheReadInputTokens:     30,
			},
		},
	}

	ok := FormatClaudeResponseInfo(claudeResponse, nil, claudeInfo)
	if !ok {
		t.Fatal("expected true")
	}
	if claudeInfo.Usage.PromptTokens != 100 {
		t.Errorf("PromptTokens = %d, want 100", claudeInfo.Usage.PromptTokens)
	}
	if claudeInfo.Usage.PromptTokensDetails.CachedTokens != 30 {
		t.Errorf("CachedTokens = %d, want 30", claudeInfo.Usage.PromptTokensDetails.CachedTokens)
	}
	if claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens != 50 {
		t.Errorf("CachedCreationTokens = %d, want 50", claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens)
	}
	if claudeInfo.ResponseId != "msg_123" {
		t.Errorf("ResponseId = %s, want msg_123", claudeInfo.ResponseId)
	}
	if claudeInfo.Model != "claude-3-5-sonnet" {
		t.Errorf("Model = %s, want claude-3-5-sonnet", claudeInfo.Model)
	}
}

func TestFormatClaudeResponseInfo_MessageDelta_FullUsage(t *testing.T) {
	// message_start 先积累 usage
	claudeInfo := &ClaudeResponseInfo{
		Usage: &dto.Usage{
			PromptTokens: 100,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:         30,
				CachedCreationTokens: 50,
			},
			CompletionTokens: 1,
		},
	}

	// message_delta 带完整 usage（原生 Anthropic 场景）
	claudeResponse := &dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			InputTokens:              100,
			OutputTokens:             200,
			CacheCreationInputTokens: 50,
			CacheReadInputTokens:     30,
		},
	}

	ok := FormatClaudeResponseInfo(claudeResponse, nil, claudeInfo)
	if !ok {
		t.Fatal("expected true")
	}
	if claudeInfo.Usage.PromptTokens != 100 {
		t.Errorf("PromptTokens = %d, want 100", claudeInfo.Usage.PromptTokens)
	}
	if claudeInfo.Usage.CompletionTokens != 200 {
		t.Errorf("CompletionTokens = %d, want 200", claudeInfo.Usage.CompletionTokens)
	}
	if claudeInfo.Usage.TotalTokens != 300 {
		t.Errorf("TotalTokens = %d, want 300", claudeInfo.Usage.TotalTokens)
	}
	if !claudeInfo.Done {
		t.Error("expected Done = true")
	}
}

func TestFormatClaudeResponseInfo_MessageDelta_OnlyOutputTokens(t *testing.T) {
	// 模拟 Bedrock: message_start 已积累 usage
	claudeInfo := &ClaudeResponseInfo{
		Usage: &dto.Usage{
			PromptTokens: 100,
			PromptTokensDetails: dto.InputTokenDetails{
				CachedTokens:         30,
				CachedCreationTokens: 50,
			},
			CompletionTokens:            1,
			ClaudeCacheCreation5mTokens: 10,
			ClaudeCacheCreation1hTokens: 20,
		},
	}

	// Bedrock 的 message_delta 只有 output_tokens，缺少 input_tokens 和 cache 字段
	claudeResponse := &dto.ClaudeResponse{
		Type: "message_delta",
		Usage: &dto.ClaudeUsage{
			OutputTokens: 200,
			// InputTokens, CacheCreationInputTokens, CacheReadInputTokens 都是 0
		},
	}

	ok := FormatClaudeResponseInfo(claudeResponse, nil, claudeInfo)
	if !ok {
		t.Fatal("expected true")
	}
	// PromptTokens 应保持 message_start 的值（因为 message_delta 的 InputTokens=0，不更新）
	if claudeInfo.Usage.PromptTokens != 100 {
		t.Errorf("PromptTokens = %d, want 100", claudeInfo.Usage.PromptTokens)
	}
	if claudeInfo.Usage.CompletionTokens != 200 {
		t.Errorf("CompletionTokens = %d, want 200", claudeInfo.Usage.CompletionTokens)
	}
	if claudeInfo.Usage.TotalTokens != 300 {
		t.Errorf("TotalTokens = %d, want 300", claudeInfo.Usage.TotalTokens)
	}
	// cache 字段应保持 message_start 的值
	if claudeInfo.Usage.PromptTokensDetails.CachedTokens != 30 {
		t.Errorf("CachedTokens = %d, want 30", claudeInfo.Usage.PromptTokensDetails.CachedTokens)
	}
	if claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens != 50 {
		t.Errorf("CachedCreationTokens = %d, want 50", claudeInfo.Usage.PromptTokensDetails.CachedCreationTokens)
	}
	if claudeInfo.Usage.ClaudeCacheCreation5mTokens != 10 {
		t.Errorf("ClaudeCacheCreation5mTokens = %d, want 10", claudeInfo.Usage.ClaudeCacheCreation5mTokens)
	}
	if claudeInfo.Usage.ClaudeCacheCreation1hTokens != 20 {
		t.Errorf("ClaudeCacheCreation1hTokens = %d, want 20", claudeInfo.Usage.ClaudeCacheCreation1hTokens)
	}
	if !claudeInfo.Done {
		t.Error("expected Done = true")
	}
}

func TestFormatClaudeResponseInfo_NilClaudeInfo(t *testing.T) {
	claudeResponse := &dto.ClaudeResponse{Type: "message_start"}
	ok := FormatClaudeResponseInfo(claudeResponse, nil, nil)
	if ok {
		t.Error("expected false for nil claudeInfo")
	}
}

func TestFormatClaudeResponseInfo_ContentBlockDelta(t *testing.T) {
	text := "hello"
	claudeInfo := &ClaudeResponseInfo{
		Usage:        &dto.Usage{},
		ResponseText: strings.Builder{},
	}
	claudeResponse := &dto.ClaudeResponse{
		Type: "content_block_delta",
		Delta: &dto.ClaudeMediaMessage{
			Text: &text,
		},
	}

	ok := FormatClaudeResponseInfo(claudeResponse, nil, claudeInfo)
	if !ok {
		t.Fatal("expected true")
	}
	if claudeInfo.ResponseText.String() != "hello" {
		t.Errorf("ResponseText = %q, want %q", claudeInfo.ResponseText.String(), "hello")
	}
}

func TestBuildOpenAIStyleUsageFromClaudeUsage(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 20,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         30,
			CachedCreationTokens: 50,
		},
		ClaudeCacheCreation5mTokens: 10,
		ClaudeCacheCreation1hTokens: 20,
		UsageSemantic:               "anthropic",
	}

	openAIUsage := buildOpenAIStyleUsageFromClaudeUsage(usage)

	if openAIUsage.PromptTokens != 180 {
		t.Fatalf("PromptTokens = %d, want 180", openAIUsage.PromptTokens)
	}
	if openAIUsage.InputTokens != 180 {
		t.Fatalf("InputTokens = %d, want 180", openAIUsage.InputTokens)
	}
	if openAIUsage.TotalTokens != 200 {
		t.Fatalf("TotalTokens = %d, want 200", openAIUsage.TotalTokens)
	}
	if openAIUsage.UsageSemantic != "openai" {
		t.Fatalf("UsageSemantic = %s, want openai", openAIUsage.UsageSemantic)
	}
	if openAIUsage.UsageSource != "anthropic" {
		t.Fatalf("UsageSource = %s, want anthropic", openAIUsage.UsageSource)
	}
}

func TestBuildOpenAIStyleUsageFromClaudeUsagePreservesCacheCreationRemainder(t *testing.T) {
	tests := []struct {
		name                    string
		cachedCreationTokens    int
		cacheCreationTokens5m   int
		cacheCreationTokens1h   int
		expectedTotalInputToken int
	}{
		{
			name:                    "prefers aggregate when it includes remainder",
			cachedCreationTokens:    50,
			cacheCreationTokens5m:   10,
			cacheCreationTokens1h:   20,
			expectedTotalInputToken: 180,
		},
		{
			name:                    "falls back to split tokens when aggregate missing",
			cachedCreationTokens:    0,
			cacheCreationTokens5m:   10,
			cacheCreationTokens1h:   20,
			expectedTotalInputToken: 160,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			usage := &dto.Usage{
				PromptTokens:     100,
				CompletionTokens: 20,
				PromptTokensDetails: dto.InputTokenDetails{
					CachedTokens:         30,
					CachedCreationTokens: tt.cachedCreationTokens,
				},
				ClaudeCacheCreation5mTokens: tt.cacheCreationTokens5m,
				ClaudeCacheCreation1hTokens: tt.cacheCreationTokens1h,
				UsageSemantic:               "anthropic",
			}

			openAIUsage := buildOpenAIStyleUsageFromClaudeUsage(usage)

			if openAIUsage.PromptTokens != tt.expectedTotalInputToken {
				t.Fatalf("PromptTokens = %d, want %d", openAIUsage.PromptTokens, tt.expectedTotalInputToken)
			}
			if openAIUsage.InputTokens != tt.expectedTotalInputToken {
				t.Fatalf("InputTokens = %d, want %d", openAIUsage.InputTokens, tt.expectedTotalInputToken)
			}
		})
	}
}

func TestBuildOpenAIStyleUsageFromClaudeUsageDefaultsAggregateCacheCreationTo5m(t *testing.T) {
	usage := &dto.Usage{
		PromptTokens:     100,
		CompletionTokens: 20,
		PromptTokensDetails: dto.InputTokenDetails{
			CachedTokens:         30,
			CachedCreationTokens: 50,
		},
		UsageSemantic: "anthropic",
	}

	openAIUsage := buildOpenAIStyleUsageFromClaudeUsage(usage)

	require.Equal(t, 50, openAIUsage.ClaudeCacheCreation5mTokens)
	require.Equal(t, 0, openAIUsage.ClaudeCacheCreation1hTokens)
}

func TestRequestOpenAI2ClaudeMessage_IgnoresUnsupportedFileContent(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{
				Role: "user",
				Content: []any{
					dto.MediaContent{
						Type: dto.ContentTypeText,
						Text: "see attachment",
					},
					dto.MediaContent{
						Type: dto.ContentTypeFile,
						File: &dto.MessageFile{
							FileName: "blob.bin",
							FileData: "JVBERi0xLjQK",
						},
					},
				},
			},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	require.Len(t, claudeRequest.Messages, 1)

	content, ok := claudeRequest.Messages[0].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, content, 1)
	require.Equal(t, "text", content[0].Type)
	require.NotNil(t, content[0].Text)
	require.Equal(t, "see attachment", *content[0].Text)
}

func TestRequestOpenAI2ClaudeMessage_ClaudeOpus48HighUsesAdaptiveThinking(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model:       "claude-opus-4-8-high",
		Temperature: commonPointer(0.7),
		TopP:        commonPointer(0.9),
		TopK:        commonPointer(40),
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hello",
			},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	require.Equal(t, "claude-opus-4-8", claudeRequest.Model)
	require.NotNil(t, claudeRequest.Thinking)
	require.Equal(t, "adaptive", claudeRequest.Thinking.Type)
	require.Equal(t, "summarized", claudeRequest.Thinking.Display)
	require.JSONEq(t, `{"effort":"high"}`, string(claudeRequest.OutputConfig))
	require.Nil(t, claudeRequest.Temperature)
	require.Nil(t, claudeRequest.TopP)
	require.Nil(t, claudeRequest.TopK)
}

func TestRequestOpenAI2ClaudeMessage_ClaudeOpus48ThinkingUsesAdaptiveHighEffort(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model:       "claude-opus-4-8-thinking",
		Temperature: commonPointer(0.7),
		TopP:        commonPointer(0.9),
		TopK:        commonPointer(40),
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hello",
			},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	require.Equal(t, "claude-opus-4-8", claudeRequest.Model)
	require.NotNil(t, claudeRequest.Thinking)
	require.Equal(t, "adaptive", claudeRequest.Thinking.Type)
	require.Equal(t, "summarized", claudeRequest.Thinking.Display)
	require.JSONEq(t, `{"effort":"high"}`, string(claudeRequest.OutputConfig))
	require.Nil(t, claudeRequest.Temperature)
	require.Nil(t, claudeRequest.TopP)
	require.Nil(t, claudeRequest.TopK)
}

func TestRequestOpenAI2ClaudeMessage_SupportsPDFFileContent(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{
				Role: "user",
				Content: []any{
					dto.MediaContent{
						Type: dto.ContentTypeFile,
						File: &dto.MessageFile{
							FileName: "spec.pdf",
							FileData: "JVBERi0xLjQK",
						},
					},
					dto.MediaContent{
						Type: dto.ContentTypeText,
						Text: "summarize it",
					},
				},
			},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	require.Len(t, claudeRequest.Messages, 1)

	content, ok := claudeRequest.Messages[0].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, content, 2)
	require.Equal(t, "document", content[0].Type)
	require.NotNil(t, content[0].Source)
	require.Equal(t, "base64", content[0].Source.Type)
	require.Equal(t, "application/pdf", content[0].Source.MediaType)
	require.Equal(t, "JVBERi0xLjQK", content[0].Source.Data)
	require.Equal(t, "text", content[1].Type)
	require.NotNil(t, content[1].Text)
	require.Equal(t, "summarize it", *content[1].Text)
}

func TestRequestOpenAI2ClaudeMessage_ConvertsTextFileContentToText(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{
				Role: "user",
				Content: []any{
					dto.MediaContent{
						Type: dto.ContentTypeFile,
						File: &dto.MessageFile{
							FileName: "notes.txt",
							FileData: base64.StdEncoding.EncodeToString([]byte("alpha\nbeta")),
						},
					},
				},
			},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	require.Len(t, claudeRequest.Messages, 1)

	content, ok := claudeRequest.Messages[0].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, content, 1)
	require.Equal(t, "text", content[0].Type)
	require.NotNil(t, content[0].Text)
	require.Equal(t, "alpha\nbeta", *content[0].Text)
}

// -----------------------------------------------------------------------------
// GAP-A: response_format JSON-mode shim
// -----------------------------------------------------------------------------

func systemTexts(t *testing.T, system any) []string {
	t.Helper()
	msgs, ok := system.([]dto.ClaudeMediaMessage)
	require.True(t, ok, "expected []ClaudeMediaMessage system, got %T", system)
	out := make([]string, 0, len(msgs))
	for _, m := range msgs {
		require.Equal(t, "text", m.Type)
		require.NotNil(t, m.Text)
		out = append(out, *m.Text)
	}
	return out
}

func TestRequestOpenAI2ClaudeMessage_ResponseFormat_JsonObject_AppendsSystemShim(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{Role: "system", Content: "You are helpful."},
			{Role: "user", Content: "ping"},
		},
		ResponseFormat: &dto.ResponseFormat{Type: "json_object"},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	texts := systemTexts(t, claudeRequest.System)
	require.Len(t, texts, 2)
	require.Equal(t, "You are helpful.", texts[0])
	// Spec §19 / GAP-A: json_object must contain BOTH literal phrases
	// (exact case, including the article "a" in "a JSON object").
	require.Contains(t, texts[1], "You must respond with valid JSON")
	require.Contains(t, texts[1], "Respond ONLY with a JSON object")
}

func TestRequestOpenAI2ClaudeMessage_ResponseFormat_JsonSchema_AppendsSystemShim(t *testing.T) {
	schema := json.RawMessage(`{"name":"weather","schema":{"type":"object","properties":{"answer":{"type":"number"}}}}`)
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{Role: "user", Content: "ping"},
		},
		ResponseFormat: &dto.ResponseFormat{Type: "json_schema", JsonSchema: schema},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	texts := systemTexts(t, claudeRequest.System)
	require.Len(t, texts, 1)
	// Spec §19 / GAP-A: json_schema must contain ALL THREE literal phrases.
	require.Contains(t, texts[0], "You must respond with valid JSON")
	require.Contains(t, texts[0], "Respond ONLY with the JSON object")
	// The pretty-printed schema must include the inner property key.
	require.Contains(t, texts[0], "answer")
}

func TestRequestOpenAI2ClaudeMessage_ResponseFormat_Nil_NoSystemShim(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{Role: "system", Content: "You are helpful."},
			{Role: "user", Content: "ping"},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	texts := systemTexts(t, claudeRequest.System)
	require.Len(t, texts, 1)
	require.Equal(t, "You are helpful.", texts[0])
}

// -----------------------------------------------------------------------------
// GAP-B: cache_control marker on the last tool
// -----------------------------------------------------------------------------

func TestRequestOpenAI2ClaudeMessage_CacheControl_OnLastTool(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{Role: "user", Content: "ping"},
		},
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:        "first",
					Description: "first tool",
					Parameters:  map[string]any{"type": "object"},
				},
			},
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:        "second",
					Description: "second tool",
					Parameters:  map[string]any{"type": "object"},
				},
			},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)

	tools, ok := claudeRequest.Tools.([]any)
	require.True(t, ok)
	require.Len(t, tools, 2)

	first, ok := tools[0].(*dto.Tool)
	require.True(t, ok)
	require.Nil(t, first.CacheControl, "first tool must NOT carry cache_control")

	last, ok := tools[1].(*dto.Tool)
	require.True(t, ok)
	require.NotNil(t, last.CacheControl, "last tool MUST carry cache_control")
	require.Equal(t, "ephemeral", last.CacheControl.Type)
	require.Equal(t, "1h", last.CacheControl.TTL)
}

func TestRequestOpenAI2ClaudeMessage_CacheControl_NoToolsNoChange(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{Role: "user", Content: "ping"},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)
	tools, ok := claudeRequest.Tools.([]any)
	require.True(t, ok)
	require.Len(t, tools, 0)
}

// -----------------------------------------------------------------------------
// GAP-C: cache_control on the last assistant message's last eligible block.
// Spec §22 (lines 581-583): eligible block types are {text, tool_use,
// tool_result, image}; thinking is NOT eligible. The marker emitted on the
// assistant side MUST NOT carry a TTL field — emit only {type:"ephemeral"}.
// -----------------------------------------------------------------------------

// cacheControlHasNoTTL asserts the cache_control marker is exactly the
// no-TTL ephemeral shape (`{"type":"ephemeral"}`). Spec §22 forbids a TTL
// field on the assistant-side marker.
func cacheControlHasNoTTL(t *testing.T, raw json.RawMessage) {
	t.Helper()
	require.NotNil(t, raw)
	var parsed map[string]any
	require.NoError(t, json.Unmarshal(raw, &parsed))
	require.Equal(t, "ephemeral", parsed["type"], "marker must be ephemeral")
	_, hasTTL := parsed["ttl"]
	require.False(t, hasTTL, "assistant-side cache_control MUST NOT include a ttl field; got %s", string(raw))
}

func TestRequestOpenAI2ClaudeMessage_CacheControl_OnLastAssistantTextBlock(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{Role: "user", Content: "hi"},
			{
				Role: "assistant",
				Content: []any{
					dto.MediaContent{Type: dto.ContentTypeText, Text: "first"},
					dto.MediaContent{Type: dto.ContentTypeText, Text: "second"},
				},
			},
			{Role: "user", Content: "more"},
			{
				Role: "assistant",
				Content: []any{
					dto.MediaContent{Type: dto.ContentTypeText, Text: "final-one"},
					dto.MediaContent{Type: dto.ContentTypeText, Text: "final-two"},
				},
			},
		},
	}

	claudeRequest, err := RequestOpenAI2ClaudeMessage(nil, request)
	require.NoError(t, err)

	// The last message should be the second assistant message.
	require.GreaterOrEqual(t, len(claudeRequest.Messages), 1)
	lastIdx := len(claudeRequest.Messages) - 1
	require.Equal(t, "assistant", claudeRequest.Messages[lastIdx].Role)
	blocks, ok := claudeRequest.Messages[lastIdx].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.GreaterOrEqual(t, len(blocks), 1)

	last := blocks[len(blocks)-1]
	require.NotNil(t, last.CacheControl, "last assistant content block MUST carry cache_control")
	// Spec §22: the assistant-side marker must NOT carry a TTL field.
	cacheControlHasNoTTL(t, last.CacheControl)
	// All earlier blocks of the same assistant must NOT carry the marker.
	for i := 0; i < len(blocks)-1; i++ {
		require.Nil(t, blocks[i].CacheControl, "earlier block %d carries unexpected cache_control", i)
	}
}

// TestApplyCacheControlToLastAssistantContent_BroadenedEligibility drives the
// helper directly and asserts the broadened eligibility set: the marker MUST
// land on text, tool_use, tool_result, or image blocks (whichever is the last
// non-thinking block of the last assistant message).
func TestApplyCacheControlToLastAssistantContent_BroadenedEligibility(t *testing.T) {
	cases := []struct {
		name      string
		blockType string
		extra     func(b *dto.ClaudeMediaMessage)
	}{
		{name: "text", blockType: "text", extra: func(b *dto.ClaudeMediaMessage) { b.Text = stringPtr("ok") }},
		{name: "tool_use", blockType: "tool_use", extra: func(b *dto.ClaudeMediaMessage) { b.Id = "tu_1"; b.Name = "fn" }},
		{name: "tool_result", blockType: "tool_result", extra: func(b *dto.ClaudeMediaMessage) { b.ToolUseId = "tu_1"; b.Content = "out" }},
		{name: "image", blockType: "image", extra: func(b *dto.ClaudeMediaMessage) {
			b.Source = &dto.ClaudeMessageSource{Type: "base64", MediaType: "image/png", Data: "AAA"}
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			eligible := dto.ClaudeMediaMessage{Type: tc.blockType}
			tc.extra(&eligible)
			messages := []dto.ClaudeMessage{
				{Role: "user", Content: "hi"},
				{Role: "assistant", Content: []dto.ClaudeMediaMessage{
					// A trailing thinking block must NOT receive the marker;
					// the helper should skip past it to find the eligible
					// block before it.
					eligible,
					{Type: "thinking", Thinking: stringPtr("T")},
				}},
			}
			applyCacheControlToLastAssistantContent(messages)
			blocks, ok := messages[1].Content.([]dto.ClaudeMediaMessage)
			require.True(t, ok)
			require.Len(t, blocks, 2)

			// Eligible block (index 0) got the marker.
			require.NotNil(t, blocks[0].CacheControl, "eligible %s block must receive cache_control", tc.blockType)
			cacheControlHasNoTTL(t, blocks[0].CacheControl)

			// Trailing thinking block (index 1) must NOT receive the marker.
			require.Nil(t, blocks[1].CacheControl, "thinking block must not receive cache_control")
		})
	}
}

// TestApplyCacheControlToLastAssistantContent_ThinkingOnlySkipped confirms
// that an assistant message whose only blocks are non-eligible (e.g. only
// thinking) receives no marker at all.
func TestApplyCacheControlToLastAssistantContent_ThinkingOnlySkipped(t *testing.T) {
	messages := []dto.ClaudeMessage{
		{Role: "user", Content: "hi"},
		{Role: "assistant", Content: []dto.ClaudeMediaMessage{
			{Type: "thinking", Thinking: stringPtr("T1")},
			{Type: "thinking", Thinking: stringPtr("T2")},
		}},
	}
	applyCacheControlToLastAssistantContent(messages)
	blocks, ok := messages[1].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	for i, b := range blocks {
		require.Nil(t, b.CacheControl, "thinking-only assistant block %d must not receive marker", i)
	}
}

// -----------------------------------------------------------------------------
// GAP-D: missing tool_result auto-injection
// -----------------------------------------------------------------------------

func TestInjectMissingToolResults_AddsEmptyResultWhenNoNextUser(t *testing.T) {
	use := dto.ClaudeMediaMessage{Type: "tool_use", Id: "tu_abc"}
	messages := []dto.ClaudeMessage{
		{Role: "user", Content: "hi"},
		{Role: "assistant", Content: []dto.ClaudeMediaMessage{use}},
	}

	out := injectMissingToolResults(messages)
	require.Len(t, out, 3)
	require.Equal(t, "user", out[2].Role)
	blocks, ok := out[2].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, blocks, 1)
	require.Equal(t, "tool_result", blocks[0].Type)
	require.Equal(t, "tu_abc", blocks[0].ToolUseId)
	require.Equal(t, "", blocks[0].Content)
}

func TestInjectMissingToolResults_AppendsToExistingNextUser(t *testing.T) {
	use1 := dto.ClaudeMediaMessage{Type: "tool_use", Id: "tu_1"}
	use2 := dto.ClaudeMediaMessage{Type: "tool_use", Id: "tu_2"}
	existing := dto.ClaudeMediaMessage{Type: "tool_result", ToolUseId: "tu_1", Content: "done"}
	messages := []dto.ClaudeMessage{
		{Role: "assistant", Content: []dto.ClaudeMediaMessage{use1, use2}},
		{Role: "user", Content: []dto.ClaudeMediaMessage{existing}},
	}

	out := injectMissingToolResults(messages)
	require.Len(t, out, 2)
	require.Equal(t, "user", out[1].Role)
	blocks, ok := out[1].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, blocks, 2)
	require.Equal(t, "tu_1", blocks[0].ToolUseId)
	require.Equal(t, "done", blocks[0].Content)
	require.Equal(t, "tu_2", blocks[1].ToolUseId)
	require.Equal(t, "", blocks[1].Content)
}

func TestInjectMissingToolResults_DoesNotDuplicateExistingResults(t *testing.T) {
	use := dto.ClaudeMediaMessage{Type: "tool_use", Id: "tu_x"}
	existing := dto.ClaudeMediaMessage{Type: "tool_result", ToolUseId: "tu_x", Content: "result"}
	messages := []dto.ClaudeMessage{
		{Role: "assistant", Content: []dto.ClaudeMediaMessage{use}},
		{Role: "user", Content: []dto.ClaudeMediaMessage{existing}},
	}

	out := injectMissingToolResults(messages)
	require.Len(t, out, 2)
	blocks, ok := out[1].Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok)
	require.Len(t, blocks, 1, "must not duplicate existing matched tool_result")
}

func TestInjectMissingToolResults_NoToolUseLeavesMessagesUntouched(t *testing.T) {
	messages := []dto.ClaudeMessage{
		{Role: "user", Content: "hi"},
		{Role: "assistant", Content: []dto.ClaudeMediaMessage{{Type: "text", Text: stringPtr("ok")}}},
	}

	out := injectMissingToolResults(messages)
	require.Len(t, out, 2)
}

func stringPtr(s string) *string {
	return &s
}
