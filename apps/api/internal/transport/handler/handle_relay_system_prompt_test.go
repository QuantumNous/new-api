package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/dto/prompt_presets"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelSystemPromptTokenDelta(t *testing.T) {
	const (
		model      = "gpt-4o"
		prompt     = "JAILBREAK PRESET"
		userSystem = "USER"
	)

	tests := []struct {
		name    string
		setting dto.ChannelSettings
		request dto.Request
		want    int
	}{
		{
			name:    "counts channel prompt when caller has no system message",
			setting: dto.ChannelSettings{SystemPrompt: prompt},
			request: &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "user", Content: "hi"}}},
			want:    relaycommon.CountTextToken(prompt, model) + 3,
		},
		{
			name:    "adds nothing under passthrough",
			setting: dto.ChannelSettings{SystemPrompt: prompt, PassThroughBodyEnabled: true},
			request: &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "user", Content: "hi"}}},
			want:    0,
		},
		{
			name:    "override subtracts the replaced caller system prompt",
			setting: dto.ChannelSettings{SystemPrompt: prompt, UserSystemPromptOverride: true},
			request: &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "system", Content: userSystem}, {Role: "user", Content: "hi"}}},
			want:    relaycommon.CountTextToken(prompt, model) - relaycommon.CountTextToken(userSystem, model),
		},
		{
			name:    "ignores request types without injection",
			setting: dto.ChannelSettings{SystemPrompt: prompt},
			request: &dto.EmbeddingRequest{},
			want:    0,
		},
		{
			name:    "adds nothing without a resolved prompt",
			setting: dto.ChannelSettings{},
			request: &dto.GeneralOpenAIRequest{Messages: []dto.Message{{Role: "user", Content: "hi"}}},
			want:    0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cc, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
			common.SetCtxKey(cc, constant.ContextKeyChannelSetting, tt.setting)
			common.SetCtxKey(cc, constant.ContextKeyOriginalModel, model)
			info := &relaycommon.RelayInfo{
				OriginModelName: model,
				RelayMode:       relayconstant.RelayModeChatCompletions,
				Request:         tt.request,
			}

			assert.Equal(t, tt.want, channelSystemPromptTokenDelta(cc, info))
		})
	}
}

func TestChannelSystemPromptTokenDeltaCountsJailbreakPreset(t *testing.T) {
	preset := promptpresets.Get(promptpresets.PresetTavernCard)
	require.NotEmpty(t, preset)
	require.Greater(t, len(preset), 50*1024)

	const model = "gpt-4o"
	cc, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
	common.SetCtxKey(cc, constant.ContextKeyChannelSetting, dto.ChannelSettings{
		SystemPromptPreset: promptpresets.PresetTavernCard,
	})
	common.SetCtxKey(cc, constant.ContextKeyOriginalModel, model)
	info := &relaycommon.RelayInfo{
		OriginModelName: model,
		RelayMode:       relayconstant.RelayModeChatCompletions,
		Request: &dto.GeneralOpenAIRequest{
			Messages: []dto.Message{{Role: "user", Content: "hi"}},
		},
	}

	delta := channelSystemPromptTokenDelta(cc, info)
	assert.Equal(t, relaycommon.CountTextToken(preset, model)+3, delta)
	assert.Greater(t, delta, 1000, "the ~51KB jailbreak preset must materially enter the reserved token count")
}
