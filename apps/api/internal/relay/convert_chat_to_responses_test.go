package relay

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/internal/types"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/dto/prompt_presets"
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

func TestApplySystemPromptIfNeededMergesAndOverrides(t *testing.T) {
	tests := []struct {
		name           string
		setting        dto.ChannelSettings
		messages       []dto.Message
		wantContent    string
		wantOverridden bool
	}{
		{
			name:        "prepends when caller has no system prompt",
			setting:     dto.ChannelSettings{SystemPrompt: "CHANNEL"},
			messages:    []dto.Message{{Role: "user", Content: "hi"}},
			wantContent: "CHANNEL",
		},
		{
			name:        "merges channel prompt in front of caller system prompt",
			setting:     dto.ChannelSettings{SystemPrompt: "CHANNEL"},
			messages:    []dto.Message{{Role: "system", Content: "USER"}, {Role: "user", Content: "hi"}},
			wantContent: "CHANNEL\nUSER",
		},
		{
			name:           "override replaces caller system prompt",
			setting:        dto.ChannelSettings{SystemPrompt: "CHANNEL", UserSystemPromptOverride: true},
			messages:       []dto.Message{{Role: "system", Content: "USER"}, {Role: "user", Content: "hi"}},
			wantContent:    "CHANNEL",
			wantOverridden: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cc, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
			info := &relaycommon.RelayInfo{
				OriginModelName: "gpt-test",
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelSetting: tt.setting},
			}
			request := &dto.GeneralOpenAIRequest{Messages: tt.messages}

			applySystemPromptIfNeeded(cc, info, request)

			require.NotEmpty(t, request.Messages)
			assert.Equal(t, "system", request.Messages[0].Role)
			assert.Equal(t, tt.wantContent, request.Messages[0].StringContent())
			assert.Equal(t, tt.wantOverridden, common.GetCtxKeyBool(cc, constant.ContextKeyUserSystemPromptOverridden))
		})
	}
}

func TestApplyResponsesSystemPromptMergesAndOverrides(t *testing.T) {
	tests := []struct {
		name           string
		setting        dto.ChannelSettings
		instructions   string
		want           string
		wantOverridden bool
	}{
		{
			name: "sets instructions when the caller sent none",
			want: `"CHANNEL"`,
		},
		{
			name:         "merges channel prompt in front of caller instructions",
			instructions: `"USER"`,
			want:         `"CHANNEL\nUSER"`,
		},
		{
			name:           "override replaces caller instructions",
			setting:        dto.ChannelSettings{UserSystemPromptOverride: true},
			instructions:   `"USER"`,
			want:           `"CHANNEL"`,
			wantOverridden: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cc, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/responses", nil))
			info := &relaycommon.RelayInfo{
				OriginModelName: "gpt-test",
				ChannelMeta:     &relaycommon.ChannelMeta{ChannelSetting: tt.setting},
			}
			request := &dto.OpenAIResponsesRequest{}
			if tt.instructions != "" {
				request.Instructions = json.RawMessage(tt.instructions)
			}

			require.NoError(t, applyResponsesSystemPrompt(cc, info, request, "CHANNEL"))

			assert.Equal(t, tt.want, string(request.Instructions))
			assert.Equal(t, tt.wantOverridden, common.GetCtxKeyBool(cc, constant.ContextKeyUserSystemPromptOverridden))
		})
	}
}

func TestChannelJailbreakPresetReachesChatWirePayload(t *testing.T) {
	preset := promptpresets.Get(promptpresets.PresetTavernCard)
	require.NotEmpty(t, preset)
	require.Greater(t, len(preset), 50*1024)

	const userSystemPrompt = "USER-SYSTEM"
	setting := dto.ChannelSettings{SystemPromptPreset: promptpresets.PresetTavernCard}
	cc, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelSetting: setting},
	}
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "system", Content: userSystemPrompt},
			{Role: "user", Content: "hello"},
		},
	}

	applySystemPromptIfNeeded(cc, info, request)
	payload, err := common.Marshal(request)
	require.NoError(t, err)

	var wire struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
	}
	require.NoError(t, common.Unmarshal(payload, &wire))
	require.Len(t, wire.Messages, 2)
	assert.Equal(t, "system", wire.Messages[0].Role)
	assert.Equal(t, preset+"\n"+userSystemPrompt, wire.Messages[0].Content)
	assert.Equal(t, "user", wire.Messages[1].Role)
	assert.Equal(t, "hello", wire.Messages[1].Content)
	assert.False(t, common.GetCtxKeyBool(cc, constant.ContextKeyUserSystemPromptOverridden))
}

func TestChannelJailbreakPresetOverrideDropsUserSystemPrompt(t *testing.T) {
	preset := promptpresets.Get(promptpresets.PresetTavernCard)
	require.NotEmpty(t, preset)

	setting := dto.ChannelSettings{
		SystemPromptPreset:       promptpresets.PresetTavernCard,
		UserSystemPromptOverride: true,
	}
	cc, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelSetting: setting},
	}
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "system", Content: "USER-SYSTEM"},
			{Role: "user", Content: "hello"},
		},
	}

	applySystemPromptIfNeeded(cc, info, request)

	require.Len(t, request.Messages, 2)
	assert.Equal(t, "system", request.Messages[0].Role)
	assert.Equal(t, preset, request.Messages[0].StringContent())
	assert.Equal(t, "hello", request.Messages[1].StringContent())
	assert.True(t, common.GetCtxKeyBool(cc, constant.ContextKeyUserSystemPromptOverridden))
}

func TestResponsesJailbreakPresetReachesWireShape(t *testing.T) {
	preset := promptpresets.Get(promptpresets.PresetTavernCard)
	require.NotEmpty(t, preset)

	setting := dto.ChannelSettings{SystemPromptPreset: promptpresets.PresetTavernCard}
	cc, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/responses", nil))
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelSetting: setting},
	}
	request := &dto.OpenAIResponsesRequest{Instructions: json.RawMessage(`"USER-SYSTEM"`)}

	require.NoError(t, applyResponsesSystemPrompt(cc, info, request, preset))

	var got string
	require.NoError(t, json.Unmarshal(request.Instructions, &got))
	assert.Equal(t, preset+"\nUSER-SYSTEM", got)
}

func TestChannelSettingsResolveSystemPromptPriorityAndOverrideKey(t *testing.T) {
	var setting dto.ChannelSettings
	require.NoError(t, common.UnmarshalJsonStr(`{
		"system_prompt": "channel",
		"system_prompt_preset": "silly_tavern",
		"system_prompt_models": {"gpt-x": "model"},
		"user_system_prompt_override": true
	}`, &setting))

	assert.True(t, setting.UserSystemPromptOverride)
	assert.Equal(t, "model", setting.ResolveSystemPrompt("gpt-x"))
	resolved := setting.ResolveSystemPrompt("other")
	require.NotEmpty(t, resolved)
	assert.NotEqual(t, "channel", resolved, "preset must take priority over the plain channel prompt")
}

func TestRecalcQuotaFromRatiosIgnoresInvalidMultipliers(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
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
		PriceData: types.PriceData{
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
