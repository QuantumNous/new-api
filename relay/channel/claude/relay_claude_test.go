package claude

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

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

func TestShouldUseUpstreamStreamForNonStreamClaude(t *testing.T) {
	info := &relaycommon.RelayInfo{
		IsStream:    false,
		RelayMode:   relayconstant.RelayModeUnknown,
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeAnthropic,
			ChannelSetting: dto.ChannelSettings{
				ForceUpstreamStream: true,
			},
		},
	}

	require.True(t, info.ShouldUseUpstreamStream())

	claudeReq := &dto.ClaudeRequest{Model: "claude-3-5-sonnet"}
	enableClaudeUpstreamStreamIfNeeded(info, claudeReq)
	require.NotNil(t, claudeReq.Stream)
	require.True(t, *claudeReq.Stream)
}

func TestShouldUseUpstreamStreamSkipsDownstreamStream(t *testing.T) {
	info := &relaycommon.RelayInfo{
		IsStream:    true,
		RelayMode:   relayconstant.RelayModeUnknown,
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeAnthropic,
			ChannelSetting: dto.ChannelSettings{
				ForceUpstreamStream: true,
			},
		},
	}

	require.False(t, info.ShouldUseUpstreamStream())
}

func TestShouldUseUpstreamStreamSkipsPassThroughBody(t *testing.T) {
	info := &relaycommon.RelayInfo{
		IsStream:    false,
		RelayMode:   relayconstant.RelayModeUnknown,
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeAnthropic,
			ChannelSetting: dto.ChannelSettings{
				ForceUpstreamStream:    true,
				PassThroughBodyEnabled: true,
			},
		},
	}

	require.False(t, info.ShouldUseUpstreamStream())
}

func TestEnsureUpstreamStreamFieldRestoresStreamAfterOverride(t *testing.T) {
	info := &relaycommon.RelayInfo{UpstreamStream: true}

	result, err := relaycommon.EnsureUpstreamStreamField([]byte(`{"model":"claude","stream":false}`), info)
	require.NoError(t, err)
	require.JSONEq(t, `{"model":"claude","stream":true}`, string(result))
}

func TestEnsureUpstreamStreamFieldKeepsExistingStreamTrue(t *testing.T) {
	info := &relaycommon.RelayInfo{UpstreamStream: true}

	result, err := relaycommon.EnsureUpstreamStreamField([]byte(`{"model":"claude","stream":true}`), info)
	require.NoError(t, err)
	require.JSONEq(t, `{"model":"claude","stream":true}`, string(result))
}

func TestAggregateClaudeStreamWithNilInfoFallsBackToOpenAIResponse(t *testing.T) {
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"type":"message_start","message":{"id":"msg_nil","model":"claude-3-5-sonnet","usage":{"input_tokens":5}}}`,
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Hello"}}`,
			`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":5,"output_tokens":1}}`,
			`data: [DONE]`,
		}, "\n"))),
	}

	result, usage, err := AggregateClaudeStreamResponse(nil, resp, nil)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 5, usage.PromptTokens)
	require.Equal(t, 1, usage.CompletionTokens)

	openAIResp, ok := result.(*dto.OpenAITextResponse)
	require.True(t, ok)
	require.Equal(t, "msg_nil", openAIResp.Id)
	require.Equal(t, "claude-3-5-sonnet", openAIResp.Model)
	require.Equal(t, "Hello", openAIResp.Choices[0].Message.StringContent())
}

func TestAggregateClaudeStreamToOpenAIResponse(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-5-sonnet",
		},
	}
	info.SetEstimatePromptTokens(7)

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"type":"message_start","message":{"id":"msg_123","model":"claude-3-5-sonnet","usage":{"input_tokens":10}}}`,
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Hello"}}`,
			`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}`,
			`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":10,"output_tokens":3}}`,
			`data: [DONE]`,
		}, "\n"))),
	}

	result, usage, err := AggregateClaudeStreamResponse(nil, resp, info)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 10, usage.PromptTokens)
	require.Equal(t, 3, usage.CompletionTokens)

	openAIResp, ok := result.(*dto.OpenAITextResponse)
	require.True(t, ok)
	require.Equal(t, "msg_123", openAIResp.Id)
	require.Equal(t, "chat.completion", openAIResp.Object)
	require.Equal(t, "claude-3-5-sonnet", openAIResp.Model)
	require.Len(t, openAIResp.Choices, 1)
	require.Equal(t, "assistant", openAIResp.Choices[0].Message.Role)
	require.Equal(t, "Hello world", openAIResp.Choices[0].Message.StringContent())
	require.Equal(t, "stop", openAIResp.Choices[0].FinishReason)
	require.Equal(t, 13, openAIResp.Usage.TotalTokens)
}

func TestAggregateClaudeStreamToClaudeResponse(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-5-sonnet",
		},
	}

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"type":"message_start","message":{"id":"msg_456","model":"claude-3-5-sonnet","usage":{"input_tokens":11}}}`,
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Bonjour"}}`,
			`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"!"}}`,
			`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":11,"output_tokens":2}}`,
			`data: [DONE]`,
		}, "\n"))),
	}

	result, usage, err := AggregateClaudeStreamResponse(nil, resp, info)
	require.Nil(t, err)
	require.NotNil(t, usage)

	claudeResp, ok := result.(*dto.ClaudeResponse)
	require.True(t, ok)
	require.Equal(t, "msg_456", claudeResp.Id)
	require.Equal(t, "message", claudeResp.Type)
	require.Equal(t, "assistant", claudeResp.Role)
	require.Equal(t, "claude-3-5-sonnet", claudeResp.Model)
	require.Equal(t, "end_turn", claudeResp.StopReason)
	require.Len(t, claudeResp.Content, 1)
	require.Equal(t, "text", claudeResp.Content[0].Type)
	require.Equal(t, "Bonjour!", claudeResp.Content[0].GetText())
	require.NotNil(t, claudeResp.Usage)
	require.Equal(t, 11, claudeResp.Usage.InputTokens)
	require.Equal(t, 2, claudeResp.Usage.OutputTokens)
}

func TestAggregateClaudeStreamToClaudeResponsePreservesCacheUsage(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-5-sonnet",
		},
	}

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"type":"message_start","message":{"id":"msg_cache","model":"claude-3-5-sonnet","usage":{"input_tokens":11,"cache_read_input_tokens":3,"cache_creation_input_tokens":7,"cache_creation":{"ephemeral_5m_input_tokens":2,"ephemeral_1h_input_tokens":5}}}}`,
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Cached"}}`,
			`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":11,"output_tokens":2,"cache_read_input_tokens":3,"cache_creation_input_tokens":7,"cache_creation":{"ephemeral_5m_input_tokens":2,"ephemeral_1h_input_tokens":5}}}`,
			`data: [DONE]`,
		}, "\n"))),
	}

	result, usage, err := AggregateClaudeStreamResponse(nil, resp, info)
	require.Nil(t, err)
	require.NotNil(t, usage)
	require.Equal(t, 3, usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 7, usage.PromptTokensDetails.CachedCreationTokens)
	require.Equal(t, 2, usage.ClaudeCacheCreation5mTokens)
	require.Equal(t, 5, usage.ClaudeCacheCreation1hTokens)

	claudeResp, ok := result.(*dto.ClaudeResponse)
	require.True(t, ok)
	require.NotNil(t, claudeResp.Usage)
	require.Equal(t, 3, claudeResp.Usage.CacheReadInputTokens)
	require.Equal(t, 7, claudeResp.Usage.CacheCreationInputTokens)
	require.NotNil(t, claudeResp.Usage.CacheCreation)
	require.Equal(t, 2, claudeResp.Usage.CacheCreation.Ephemeral5mInputTokens)
	require.Equal(t, 5, claudeResp.Usage.CacheCreation.Ephemeral1hInputTokens)
}

func TestAggregateClaudeStreamToClaudeResponseJoinsTextBlocksByIndex(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-5-sonnet",
		},
	}

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"type":"message_start","message":{"id":"msg_blocks","model":"claude-3-5-sonnet","usage":{"input_tokens":8}}}`,
			`data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":"second"}}`,
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"first "}}`,
			`data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":" block"}}`,
			`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":8,"output_tokens":3}}`,
			`data: [DONE]`,
		}, "\n"))),
	}

	result, _, err := AggregateClaudeStreamResponse(nil, resp, info)
	require.Nil(t, err)

	claudeResp, ok := result.(*dto.ClaudeResponse)
	require.True(t, ok)
	require.Len(t, claudeResp.Content, 1)
	require.Equal(t, "first second block", claudeResp.Content[0].GetText())
}

func TestAggregateClaudeStreamToClaudeResponsePreservesStopSequence(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-5-sonnet",
		},
	}

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"type":"message_start","message":{"id":"msg_stop","model":"claude-3-5-sonnet","usage":{"input_tokens":9}}}`,
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Done"}}`,
			`data: {"type":"message_delta","delta":{"stop_reason":"stop_sequence","stop_sequence":"END"},"usage":{"input_tokens":9,"output_tokens":1}}`,
			`data: [DONE]`,
		}, "\n"))),
	}

	result, _, err := AggregateClaudeStreamResponse(nil, resp, info)
	require.Nil(t, err)

	claudeResp, ok := result.(*dto.ClaudeResponse)
	require.True(t, ok)
	require.Equal(t, "stop_sequence", claudeResp.StopReason)
	require.NotNil(t, claudeResp.StopSequence)
	require.Equal(t, "END", *claudeResp.StopSequence)
}

func TestAggregateClaudeStreamToOpenAIResponseWithToolUse(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-5-sonnet",
		},
	}

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"type":"message_start","message":{"id":"msg_tool","model":"claude-3-5-sonnet","usage":{"input_tokens":20}}}`,
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"get_weather","input":{}}}`,
			`data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"city\""}}`,
			`data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":":\"Paris\"}"}}`,
			`data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"input_tokens":20,"output_tokens":4}}`,
			`data: [DONE]`,
		}, "\n"))),
	}

	result, _, err := AggregateClaudeStreamResponse(nil, resp, info)
	require.Nil(t, err)

	openAIResp, ok := result.(*dto.OpenAITextResponse)
	require.True(t, ok)
	require.Equal(t, "tool_calls", openAIResp.Choices[0].FinishReason)

	toolCalls := openAIResp.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	require.Equal(t, "toolu_1", toolCalls[0].ID)
	require.Equal(t, "function", toolCalls[0].Type)
	require.Equal(t, "get_weather", toolCalls[0].Function.Name)
	require.Equal(t, `{"city":"Paris"}`, toolCalls[0].Function.Arguments)
}

func TestAggregateClaudeStreamRecordsWebSearchUsage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "claude-3-5-sonnet",
		},
	}

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Join([]string{
			`data: {"type":"message_start","message":{"id":"msg_search","model":"claude-3-5-sonnet","usage":{"input_tokens":15}}}`,
			`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":"Done"}}`,
			`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":15,"output_tokens":2,"server_tool_use":{"web_search_requests":2}}}`,
			`data: [DONE]`,
		}, "\n"))),
	}

	result, _, err := AggregateClaudeStreamResponse(ctx, resp, info)
	require.Nil(t, err)
	require.Equal(t, 2, ctx.GetInt("claude_web_search_requests"))

	claudeResp, ok := result.(*dto.ClaudeResponse)
	require.True(t, ok)
	require.NotNil(t, claudeResp.Usage)
	require.NotNil(t, claudeResp.Usage.ServerToolUse)
	require.Equal(t, 2, claudeResp.Usage.ServerToolUse.WebSearchRequests)
}
