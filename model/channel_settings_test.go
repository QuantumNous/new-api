package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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

func TestChannelUpstreamCostRateValidation(t *testing.T) {
	validRate := 0.495
	zeroRate := 0.0
	tooLargeRate := float64(dto.MaxUpstreamCostRateCNY + 1)

	tests := []struct {
		name    string
		rate    *float64
		wantErr bool
	}{
		{name: "unset disables cost tracking"},
		{name: "positive fractional rate", rate: &validRate},
		{name: "zero is rejected", rate: &zeroRate, wantErr: true},
		{name: "excessive rate is rejected", rate: &tooLargeRate, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := &Channel{Type: constant.ChannelTypeOpenAI}
			channel.SetOtherSettings(dto.ChannelOtherSettings{UpstreamCostRateCNY: tt.rate})

			err := channel.ValidateSettings()
			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), "upstream_cost_rate_cny")
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestChannelUpstreamCostProfileValidation(t *testing.T) {
	validRate := 0.495
	tests := []struct {
		name     string
		settings dto.ChannelOtherSettings
		wantErr  string
	}{
		{
			name: "automatic profile is accepted",
			settings: dto.ChannelOtherSettings{
				UpstreamCostMode:         dto.UpstreamCostModeAuto,
				UpstreamCostUnit:         "CREDIT",
				UpstreamCostRateCNY:      &validRate,
				UpstreamCostPriceVersion: "yunwu-2026-07",
			},
		},
		{
			name: "mode requires a rate",
			settings: dto.ChannelOtherSettings{
				UpstreamCostMode: dto.UpstreamCostModeBillingUnits,
			},
			wantErr: "upstream_cost_rate_cny is required",
		},
		{
			name: "unknown mode is rejected",
			settings: dto.ChannelOtherSettings{
				UpstreamCostMode:    "guess",
				UpstreamCostRateCNY: &validRate,
			},
			wantErr: "unsupported upstream_cost_mode",
		},
		{
			name: "control characters in unit are rejected",
			settings: dto.ChannelOtherSettings{
				UpstreamCostMode:    dto.UpstreamCostModeAuto,
				UpstreamCostUnit:    "USD\nCNY",
				UpstreamCostRateCNY: &validRate,
			},
			wantErr: "upstream_cost_unit",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			channel := &Channel{Type: constant.ChannelTypeOpenAI}
			channel.SetOtherSettings(tt.settings)

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
