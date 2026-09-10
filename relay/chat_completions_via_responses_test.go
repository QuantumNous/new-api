package relay

import (
	"encoding/json"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	openaichannel "github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsResponsesEventStreamContentType(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		want        bool
	}{
		{name: "plain", contentType: "text/event-stream", want: true},
		{name: "mixed case with charset", contentType: "Text/Event-Stream; charset=utf-8", want: true},
		{name: "json", contentType: "application/json", want: false},
		{name: "empty", contentType: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isResponsesEventStreamContentType(tt.contentType))
		})
	}
}

func TestRecalcQuotaFromRatiosIgnoresInvalidMultipliers(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: hosttypes.PriceData{
			Quota: 100,
		},
	}
	info.PriceData.AddOtherRatio("duration", 2)

	quota, ok := recalcQuotaFromRatios(info, map[string]float64{
		"duration": 3,
		"zero":     0,
		"negative": -1,
		"nan":      math.NaN(),
		"inf":      math.Inf(1),
	})

	require.True(t, ok)
	assert.Equal(t, 150, quota)
	assert.True(t, info.PriceData.HasOtherRatio("duration"))
}

func TestRecalcQuotaFromRatiosRejectsAllInvalidAdjustedRatios(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: hosttypes.PriceData{
			Quota: 100,
		},
	}
	info.PriceData.AddOtherRatio("duration", 2)

	quota, ok := recalcQuotaFromRatios(info, map[string]float64{
		"zero":     0,
		"negative": -1,
		"nan":      math.NaN(),
		"inf":      math.Inf(1),
	})

	require.False(t, ok)
	assert.Equal(t, 0, quota)
	assert.True(t, info.PriceData.HasOtherRatio("duration"))
}

func TestTextRequestViaResponsesConvertsClaudeDirectly(t *testing.T) {
	type capturedRequest struct {
		path string
		body []byte
	}
	captured := make(chan capturedRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		captured <- capturedRequest{path: r.URL.Path, body: body}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"id":"resp_1",
			"object":"response",
			"status":"completed",
			"model":"gpt-5.6-sol",
			"output":[{"type":"message","id":"msg_1","role":"assistant","content":[{"type":"output_text","text":"ok"}]}],
			"usage":{"input_tokens":3,"output_tokens":2,"total_tokens":5}
		}`))
	}))
	defer server.Close()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	c.Request.Header.Set("Content-Type", "application/json")

	info := &relaycommon.RelayInfo{
		RelayMode:              relayconstant.RelayModeChatCompletions,
		RelayFormat:            relaytypes.RelayFormatClaude,
		OriginModelName:        "gpt-5.6-sol",
		RequestConversionChain: []relaytypes.RelayFormat{relaytypes.RelayFormatClaude},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelBaseUrl:    server.URL,
			ApiKey:            "test-key",
			UpstreamModelName: "gpt-5.6-sol",
		},
	}
	adaptor := &openaichannel.Adaptor{}
	adaptor.Init(info)
	request := &dto.ClaudeRequest{
		Model:    "gpt-5.6-sol",
		Thinking: &dto.Thinking{Type: "adaptive", Display: "summarized"},
		Messages: []dto.ClaudeMessage{{Role: "user", Content: "hello"}},
	}

	usage, apiErr := textRequestViaResponses(c, info, adaptor, request)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 5, usage.TotalTokens)
	assert.Equal(t, []relaytypes.RelayFormat{relaytypes.RelayFormatClaude, relaytypes.RelayFormatOpenAIResponses}, info.RequestConversionChain)

	upstream := <-captured
	assert.Equal(t, "/v1/responses", upstream.path)
	var upstreamBody map[string]any
	require.NoError(t, common.Unmarshal(upstream.body, &upstreamBody))
	assert.NotContains(t, upstreamBody, "messages")
	reasoning, ok := upstreamBody["reasoning"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "high", reasoning["effort"])
	assert.Equal(t, "detailed", reasoning["summary"])

	var response dto.ClaudeResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.Len(t, response.Content, 1)
	assert.Equal(t, "ok", response.Content[0].GetText())
}

func TestApplySystemPromptIfNeededSkipsToolLoadingMessages(t *testing.T) {
	tools := json.RawMessage(`[{"type":"function","function":{"name":"get_current_time","parameters":{"type":"object","properties":{"city":{"type":"string"}}}}}]`)
	toolLoading := dto.Message{Role: "system", Tools: tools}
	user := dto.Message{Role: "user", Content: "What time is it in Beijing?"}

	tests := []struct {
		name         string
		messages     []dto.Message
		wantMessages []dto.Message
		wantOverride bool
	}{
		{
			name:     "tool loading message alone is not a system prompt",
			messages: []dto.Message{toolLoading, user},
			wantMessages: []dto.Message{
				{Role: "system", Content: "Answer in English."},
				toolLoading,
				user,
			},
		},
		{
			name:     "override targets the real system prompt only",
			messages: []dto.Message{toolLoading, {Role: "system", Content: "You are Kimi."}, user},
			wantMessages: []dto.Message{
				toolLoading,
				{Role: "system", Content: "Answer in English.\nYou are Kimi."},
				user,
			},
			wantOverride: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelSetting: dto.ChannelSettings{
						SystemPrompt:         "Answer in English.",
						SystemPromptOverride: true,
					},
				},
			}
			request := &dto.GeneralOpenAIRequest{
				Model:    "kimi-k3",
				Messages: append([]dto.Message(nil), tt.messages...),
			}

			applySystemPromptIfNeeded(c, info, request)

			require.Len(t, request.Messages, len(tt.wantMessages))
			for i, want := range tt.wantMessages {
				got := request.Messages[i]
				assert.Equal(t, want.Role, got.Role, "message %d role", i)
				assert.Equal(t, want.Content, got.Content, "message %d content", i)
				if len(want.Tools) > 0 {
					assert.JSONEq(t, string(want.Tools), string(got.Tools), "message %d tools", i)
				} else {
					assert.Empty(t, got.Tools, "message %d tools", i)
				}
			}
			_, overrideSet := common.GetContextKey(c, constant.ContextKeySystemPromptOverride)
			assert.Equal(t, tt.wantOverride, overrideSet)
		})
	}
}
