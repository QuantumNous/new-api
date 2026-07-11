package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/modelroute"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildCaptureOpenAI(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "gpt-x", RelayFormat: types.RelayFormatOpenAI}
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-x",
		Messages: []dto.Message{
			{Role: "system", Content: "sys"},
			{Role: "user", Content: "hello openai full"},
		},
		MaxTokens: lo.ToPtr(uint(32)),
	}
	cap := BuildProductionShadowCaptureFromRelay(nil, info, req)
	require.NotNil(t, cap)
	assert.Equal(t, string(types.RelayFormatOpenAI), cap.RelayFormat)
	assert.Equal(t, 32, cap.MaxTokens)
	assert.True(t, cap.View.TextIndependentComplete)
	assert.Equal(t, "hello openai full", cap.View.Messages[len(cap.View.Messages)-1].Text)
}

func TestBuildCaptureClaude(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "claude-3", RelayFormat: types.RelayFormatClaude}
	req := &dto.ClaudeRequest{
		Model: "claude-3",
		System: "be helpful",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hello claude full body"},
		},
		MaxTokens: lo.ToPtr(uint(64)),
	}
	cap := BuildProductionShadowCaptureFromRelay(nil, info, req)
	require.NotNil(t, cap)
	assert.Equal(t, string(types.RelayFormatClaude), cap.RelayFormat)
	assert.Equal(t, "/v1/messages", cap.RequestPath)
	assert.Equal(t, 64, cap.MaxTokens)
	require.GreaterOrEqual(t, len(cap.View.Messages), 2)
	assert.Equal(t, "system", cap.View.Messages[0].Role)
	assert.Equal(t, "be helpful", cap.View.Messages[0].Text)
	assert.Equal(t, "user", cap.View.Messages[1].Role)
	assert.Equal(t, "hello claude full body", cap.View.Messages[1].Text)
}

func TestBuildCaptureGemini(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "gemini-2.0-flash", RelayFormat: types.RelayFormatGemini}
	req := &dto.GeminiChatRequest{
		SystemInstructions: &dto.GeminiChatContent{Parts: []dto.GeminiPart{{Text: "sys-g"}}},
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: "hello gemini full"}}},
			{Role: "model", Parts: []dto.GeminiPart{{Text: "prior"}}},
			{Role: "user", Parts: []dto.GeminiPart{{Text: "follow up"}}},
		},
		GenerationConfig: dto.GeminiChatGenerationConfig{MaxOutputTokens: lo.ToPtr(uint(48))},
	}
	cap := BuildProductionShadowCaptureFromRelay(nil, info, req)
	require.NotNil(t, cap)
	assert.Equal(t, string(types.RelayFormatGemini), cap.RelayFormat)
	assert.Equal(t, 48, cap.MaxTokens)
	assert.Contains(t, cap.RequestPath, "generateContent")
	// system + turns
	require.NotEmpty(t, cap.View.Messages)
	assert.Equal(t, "system", cap.View.Messages[0].Role)
	// last user text present
	foundUser := false
	for _, m := range cap.View.Messages {
		if m.Role == "user" && m.Text == "follow up" {
			foundUser = true
		}
		if m.Role == "assistant" {
			assert.Equal(t, "prior", m.Text)
		}
	}
	assert.True(t, foundUser)
}

func TestBuildCaptureClaudeSkipsToolsOnly(t *testing.T) {
	info := &relaycommon.RelayInfo{OriginModelName: "claude-3", RelayFormat: types.RelayFormatClaude}
	// tool-only content without text → no capture
	req := &dto.ClaudeRequest{
		Model: "claude-3",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: []any{
				map[string]any{"type": "tool_result", "content": "x"},
			}},
		},
	}
	cap := BuildProductionShadowCaptureFromRelay(nil, info, req)
	assert.Nil(t, cap)
}

func TestBuildShadowDTOClaudeAndGemini(t *testing.T) {
	msgs := []modelroute.ShadowMessage{
		{Role: "system", Text: "s"},
		{Role: "user", Text: "u1"},
	}
	req := &modelroute.ShadowRequest{Messages: msgs, MaxTokens: 16}
	cr, ok := buildShadowDTORequest(req, nil, "claude-x", types.RelayFormatClaude)
	require.True(t, ok)
	claude, ok := cr.(*dto.ClaudeRequest)
	require.True(t, ok)
	assert.Equal(t, "s", claude.GetStringSystem())
	require.Len(t, claude.Messages, 1)
	assert.Nil(t, claude.Tools)

	gr, ok := buildShadowDTORequest(req, nil, "gemini-x", types.RelayFormatGemini)
	require.True(t, ok)
	gem, ok := gr.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.NotNil(t, gem.SystemInstructions)
	require.Len(t, gem.Contents, 1)
	assert.Equal(t, "user", gem.Contents[0].Role)
	assert.Nil(t, gem.Tools)
}
