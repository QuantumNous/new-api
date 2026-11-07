package relay

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/dto/prompt_presets"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJailbreakPayloadReachesMockUpstream(t *testing.T) {
	preset := promptpresets.Get(promptpresets.PresetTavernCard)
	require.NotEmpty(t, preset)
	require.Greater(t, len(preset), 50*1024)

	captured := make(chan []byte, 4)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		captured <- body
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	postToMock := func(body []byte) []byte {
		request, err := http.NewRequest(http.MethodPost, server.URL, bytes.NewReader(body))
		require.NoError(t, err)
		request.Header.Set("Content-Type", "application/json")
		response, err := http.DefaultClient.Do(request)
		require.NoError(t, err)
		defer response.Body.Close()
		_, _ = io.Copy(io.Discard, response.Body)
		require.Equal(t, http.StatusOK, response.StatusCode)
		return <-captured
	}

	newInfo := func(setting dto.ChannelSettings) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			OriginModelName: "gpt-test",
			ChannelMeta:     &relaycommon.ChannelMeta{ChannelSetting: setting},
		}
	}
	newContext := func(path string) contract.Context {
		context, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, path, nil))
		return context
	}
	preview := func(value string) string {
		if len(value) > 60 {
			return value[:60]
		}
		return value
	}

	setting := dto.ChannelSettings{SystemPromptPreset: promptpresets.PresetTavernCard}

	chatContext := newContext("/v1/chat/completions")
	chatRequest := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "system", Content: "USER-SYSTEM"},
			{Role: "user", Content: "USER-CONTEXT"},
		},
	}
	applySystemPromptIfNeeded(chatContext, newInfo(setting), chatRequest)
	chatBody, err := common.Marshal(chatRequest)
	require.NoError(t, err)
	chatWireBody := postToMock(chatBody)
	var chatWire struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	require.NoError(t, common.Unmarshal(chatWireBody, &chatWire))
	require.Len(t, chatWire.Messages, 2)
	assert.Equal(t, "system", chatWire.Messages[0].Role)
	assert.Equal(t, preset+"\nUSER-SYSTEM", chatWire.Messages[0].Content)
	assert.Equal(t, "USER-CONTEXT", chatWire.Messages[1].Content)
	t.Logf("chat mock body: bytes=%d system_prefix=%q", len(chatWire.Messages[0].Content), preview(chatWire.Messages[0].Content))

	claudeContext := newContext("/v1/messages")
	claudeRequest := &dto.ClaudeRequest{
		Model:    "claude-test",
		System:   "USER-SYSTEM",
		Messages: []dto.ClaudeMessage{{Role: "user", Content: "USER-CONTEXT"}},
	}
	applyClaudeSystemPrompt(claudeContext, newInfo(setting), claudeRequest)
	claudeBody, err := common.Marshal(claudeRequest)
	require.NoError(t, err)
	claudeWireBody := postToMock(claudeBody)
	var claudeWire struct {
		System   json.RawMessage     `json:"system"`
		Messages []dto.ClaudeMessage `json:"messages"`
	}
	require.NoError(t, common.Unmarshal(claudeWireBody, &claudeWire))
	var claudeSystem string
	require.NoError(t, common.Unmarshal(claudeWire.System, &claudeSystem))
	assert.Equal(t, preset+"\nUSER-SYSTEM", claudeSystem)
	assert.Equal(t, "USER-CONTEXT", claudeWire.Messages[0].GetStringContent())
	t.Logf("claude mock body: bytes=%d system_prefix=%q", len(claudeSystem), preview(claudeSystem))

	geminiContext := newContext("/v1beta/models/gemini-test:generateContent")
	geminiRequest := &dto.GeminiChatRequest{
		SystemInstructions: &dto.GeminiChatContent{Parts: []dto.GeminiPart{{Text: "USER-SYSTEM"}}},
		Contents:           []dto.GeminiChatContent{{Role: "user", Parts: []dto.GeminiPart{{Text: "USER-CONTEXT"}}}},
	}
	applyGeminiSystemPrompt(geminiContext, newInfo(setting), geminiRequest)
	geminiBody, err := common.Marshal(geminiRequest)
	require.NoError(t, err)
	geminiWireBody := postToMock(geminiBody)
	var geminiWire dto.GeminiChatRequest
	require.NoError(t, common.Unmarshal(geminiWireBody, &geminiWire))
	require.NotNil(t, geminiWire.SystemInstructions)
	require.NotEmpty(t, geminiWire.SystemInstructions.Parts)
	assert.Equal(t, preset+"\nUSER-SYSTEM", geminiWire.SystemInstructions.Parts[0].Text)
	assert.Equal(t, "USER-CONTEXT", geminiWire.Contents[0].Parts[0].Text)
	t.Logf("gemini mock body: bytes=%d system_prefix=%q", len(geminiWire.SystemInstructions.Parts[0].Text), preview(geminiWire.SystemInstructions.Parts[0].Text))

	responsesContext := newContext("/v1/responses")
	responsesRequest := &dto.OpenAIResponsesRequest{Instructions: json.RawMessage(`"USER-SYSTEM"`)}
	require.NoError(t, applyResponsesSystemPrompt(responsesContext, newInfo(setting), responsesRequest, preset))
	responsesBody, err := common.Marshal(responsesRequest)
	require.NoError(t, err)
	responsesWireBody := postToMock(responsesBody)
	var responsesWire struct {
		Instructions json.RawMessage `json:"instructions"`
	}
	require.NoError(t, common.Unmarshal(responsesWireBody, &responsesWire))
	var instructions string
	require.NoError(t, common.Unmarshal(responsesWire.Instructions, &instructions))
	assert.Equal(t, preset+"\nUSER-SYSTEM", instructions)
	t.Logf("responses mock body: bytes=%d instructions_prefix=%q", len(instructions), preview(instructions))

	assert.False(t, common.GetCtxKeyBool(chatContext, constant.ContextKeyUserSystemPromptOverridden))
}
