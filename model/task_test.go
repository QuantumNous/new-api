package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitTaskPreservesSelectedKeyForPolling(t *testing.T) {
	tests := []struct {
		name        string
		channelType int
		isMultiKey  bool
		wantKey     string
	}{
		{
			name:        "multi-key task keeps the selected key",
			channelType: constant.ChannelTypeAli,
			isMultiKey:  true,
			wantKey:     "selected-key",
		},
		{
			name:        "single-key task does not persist the channel key",
			channelType: constant.ChannelTypeAli,
			isMultiKey:  false,
			wantKey:     "",
		},
		{
			name:        "Gemini task keeps its key",
			channelType: constant.ChannelTypeGemini,
			isMultiKey:  false,
			wantKey:     "selected-key",
		},
		{
			name:        "Vertex AI task keeps its key",
			channelType: constant.ChannelTypeVertexAi,
			isMultiKey:  false,
			wantKey:     "selected-key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			relayInfo := &relaycommon.RelayInfo{
				UserId:     1,
				UsingGroup: "default",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelId:         2,
					ChannelType:       tt.channelType,
					ChannelIsMultiKey: tt.isMultiKey,
					ApiKey:            "selected-key",
				},
			}

			task := InitTask(constant.TaskPlatform("ali"), relayInfo)

			require.NotNil(t, task)
			assert.Equal(t, tt.wantKey, task.PrivateData.Key)
		})
	}
}
