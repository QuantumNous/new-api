package helper

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyResponsesSystemPrompt(t *testing.T) {
	tests := []struct {
		name                string
		channelSetting      dto.ChannelSettings
		instructions        json.RawMessage
		wantInstructions    string
		wantPromptOverwrite bool
	}{
		{
			name:             "no channel prompt",
			instructions:     json.RawMessage(`"user rules"`),
			wantInstructions: `"user rules"`,
		},
		{
			name: "missing instructions",
			channelSetting: dto.ChannelSettings{
				SystemPrompt: "channel rules",
			},
			wantInstructions: `"channel rules"`,
		},
		{
			name: "existing instructions take priority",
			channelSetting: dto.ChannelSettings{
				SystemPrompt: "channel rules",
			},
			instructions:     json.RawMessage(`"user rules"`),
			wantInstructions: `"user rules"`,
		},
		{
			name: "null instructions become channel prompt without override",
			channelSetting: dto.ChannelSettings{
				SystemPrompt: "channel rules",
			},
			instructions:     json.RawMessage(`null`),
			wantInstructions: `"channel rules"`,
		},
		{
			name: "empty instructions become channel prompt without override",
			channelSetting: dto.ChannelSettings{
				SystemPrompt: "channel rules",
			},
			instructions:     json.RawMessage(`""`),
			wantInstructions: `"channel rules"`,
		},
		{
			name: "blank instructions become channel prompt without override",
			channelSetting: dto.ChannelSettings{
				SystemPrompt: "channel rules",
			},
			instructions:     json.RawMessage(`"   "`),
			wantInstructions: `"channel rules"`,
		},
		{
			name: "channel prompt is prepended and existing whitespace is trimmed",
			channelSetting: dto.ChannelSettings{
				SystemPrompt:         "channel rules",
				SystemPromptOverride: true,
			},
			instructions:        json.RawMessage(`"  user rules  "`),
			wantInstructions:    `"channel rules\nuser rules"`,
			wantPromptOverwrite: true,
		},
		{
			name: "blank instructions become channel prompt when override is enabled",
			channelSetting: dto.ChannelSettings{
				SystemPrompt:         "channel rules",
				SystemPromptOverride: true,
			},
			instructions:     json.RawMessage(`"   "`),
			wantInstructions: `"channel rules"`,
		},
		{
			name: "non-string instructions become channel prompt when override is enabled",
			channelSetting: dto.ChannelSettings{
				SystemPrompt:         "channel rules",
				SystemPromptOverride: true,
			},
			instructions:     json.RawMessage(`[{"role":"developer"}]`),
			wantInstructions: `"channel rules"`,
		},
		{
			name: "invalid instructions become channel prompt when override is enabled",
			channelSetting: dto.ChannelSettings{
				SystemPrompt:         "channel rules",
				SystemPromptOverride: true,
			},
			instructions:     json.RawMessage(`invalid`),
			wantInstructions: `"channel rules"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			request := &dto.OpenAIResponsesRequest{
				Instructions: append(json.RawMessage(nil), tt.instructions...),
			}

			err := ApplyResponsesSystemPrompt(c, tt.channelSetting, request)

			require.NoError(t, err)
			assert.Equal(t, tt.wantInstructions, string(request.Instructions))
			assert.Equal(t, tt.wantPromptOverwrite, common.GetContextKeyBool(c, constant.ContextKeySystemPromptOverride))
		})
	}
}
