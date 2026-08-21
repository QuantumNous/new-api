package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelValidateSettingsRejectsInvalidHTTPTransport(t *testing.T) {
	tests := []struct {
		name    string
		setting dto.ChannelSettings
		wantErr string
	}{
		{
			name:    "auto with shards is valid",
			setting: dto.ChannelSettings{HTTPProtocol: "auto", HTTP2ConnectionShards: 4},
		},
		{
			name:    "http1 with shards greater than one rejected",
			setting: dto.ChannelSettings{HTTPProtocol: "http1", HTTP2ConnectionShards: 2},
			wantErr: "http2_connection_shards",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := &Channel{}
			channel.SetSetting(tt.setting)
			err := channel.ValidateSettings()
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestAdvancedCustomChannelRequiresModelListRouteOnlyWhenUpdateChecksEnabled(t *testing.T) {
	inferenceRoute := dto.AdvancedCustomRoute{
		IncomingPath: "/v1/chat/completions",
		UpstreamPath: "/v1/chat/completions",
		Converter:    "none",
	}

	tests := []struct {
		name          string
		checksEnabled bool
		routes        []dto.AdvancedCustomRoute
		wantErr       string
	}{
		{
			name:   "legacy channel without discovery route remains valid",
			routes: []dto.AdvancedCustomRoute{inferenceRoute},
		},
		{
			name:          "enabled checks require discovery route",
			checksEnabled: true,
			routes:        []dto.AdvancedCustomRoute{inferenceRoute},
			wantErr:       dto.AdvancedCustomModelListPath,
		},
		{
			name:          "enabled checks accept discovery route",
			checksEnabled: true,
			routes: []dto.AdvancedCustomRoute{
				inferenceRoute,
				{
					IncomingPath: dto.AdvancedCustomModelListPath,
					UpstreamPath: dto.AdvancedCustomModelListPath,
					Converter:    "none",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := &Channel{Type: constant.ChannelTypeAdvancedCustom}
			channel.SetOtherSettings(dto.ChannelOtherSettings{
				UpstreamModelUpdateCheckEnabled: tt.checksEnabled,
				AdvancedCustom: &dto.AdvancedCustomConfig{
					Routes: tt.routes,
				},
			})

			err := channel.ValidateSettings()
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestContentToReasoningSettingsValidation(t *testing.T) {
	tests := []struct {
		name    string
		channel *Channel
		wantErr string
	}{
		{
			name: "enabled with default markers",
			channel: func() *Channel {
				channel := &Channel{}
				channel.SetOtherSettings(dto.ChannelOtherSettings{
					ContentToReasoning: &dto.ContentToReasoningSettings{Enabled: true},
				})
				return channel
			}(),
		},
		{
			name: "enabled with paired markers",
			channel: func() *Channel {
				channel := &Channel{}
				channel.SetOtherSettings(dto.ChannelOtherSettings{
					ContentToReasoning: &dto.ContentToReasoningSettings{
						Enabled: true,
						Markers: []dto.ContentToReasoningMarkerPair{
							{Start: "<think>", End: "</think>"},
							{Start: "[think]", End: "[/think]"},
						},
					},
				})
				return channel
			}(),
		},
		{
			name: "incomplete marker rejected",
			channel: func() *Channel {
				channel := &Channel{}
				channel.SetOtherSettings(dto.ChannelOtherSettings{
					ContentToReasoning: &dto.ContentToReasoningSettings{
						Enabled: true,
						Markers: []dto.ContentToReasoningMarkerPair{
							{Start: "<think>", End: ""},
						},
					},
				})
				return channel
			}(),
			wantErr: "both start and end",
		},
		{
			name: "disabled with invalid marker is tolerated",
			channel: func() *Channel {
				channel := &Channel{}
				channel.SetOtherSettings(dto.ChannelOtherSettings{
					ContentToReasoning: &dto.ContentToReasoningSettings{
						Enabled: false,
						Markers: []dto.ContentToReasoningMarkerPair{
							{Start: "<think>", End: ""},
						},
					},
				})
				return channel
			}(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.channel.ValidateSettings()
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}
}

func TestContentToReasoningConflictsWithThinkingToContent(t *testing.T) {
	channel := &Channel{}
	channel.SetSetting(dto.ChannelSettings{ThinkingToContent: true})
	channel.SetOtherSettings(dto.ChannelOtherSettings{
		ContentToReasoning: &dto.ContentToReasoningSettings{Enabled: true},
	})

	err := channel.ValidateSettings()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot both be enabled")
}
