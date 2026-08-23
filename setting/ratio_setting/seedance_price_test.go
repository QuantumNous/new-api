package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultSeedanceRatiosUseBaseListPrice(t *testing.T) {
	assert.InDelta(t, 0.046*RMB, defaultModelRatio["doubao-seedance-2-0-260128"], 1e-12)
	assert.InDelta(t, 0.037*RMB, defaultModelRatio["doubao-seedance-2-0-fast-260128"], 1e-12)
	assert.InDelta(t, 0.070*RMB, defaultModelRatio["doubao-seedance-2-5-260628"], 1e-12)
}

func TestGetVideoBillingRatioDefaults(t *testing.T) {
	tests := []struct {
		name       string
		model      string
		resolution string
		hasVideo   bool
		want       float64
		wantOK     bool
	}{
		{
			name:       "seedance 2.0 720p text input uses base price",
			model:      "doubao-seedance-2-0-260128",
			resolution: "720p",
			want:       1,
			wantOK:     true,
		},
		{
			name:       "seedance 2.0 1080p text input",
			model:      "doubao-seedance-2-0-260128",
			resolution: " 1080P ",
			want:       51.0 / 46.0,
			wantOK:     true,
		},
		{
			name:       "seedance 2.0 1080p video input",
			model:      "doubao-seedance-2-0-260128",
			resolution: "1080p",
			hasVideo:   true,
			want:       31.0 / 46.0,
			wantOK:     true,
		},
		{
			name:       "seedance 2.0 4k text input",
			model:      "doubao-seedance-2-0-260128",
			resolution: "4K",
			want:       26.0 / 46.0,
			wantOK:     true,
		},
		{
			name:       "seedance 2.0 4k video input",
			model:      "doubao-seedance-2-0-260128",
			resolution: "4k",
			hasVideo:   true,
			want:       16.0 / 46.0,
			wantOK:     true,
		},
		{
			name:       "seedance 2.5 text input",
			model:      "doubao-seedance-2-5-260628",
			resolution: "720p",
			want:       1,
			wantOK:     true,
		},
		{
			name:       "seedance 2.5 video input",
			model:      "doubao-seedance-2-5-260628",
			resolution: "480p",
			hasVideo:   true,
			want:       42.0 / 70.0,
			wantOK:     true,
		},
		{
			name:       "unknown model has no price table",
			model:      "custom-seedance",
			resolution: "1080p",
			wantOK:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := GetVideoBillingRatio(tt.model, tt.resolution, tt.hasVideo)
			assert.Equal(t, tt.wantOK, ok)
			assert.InDelta(t, tt.want, got, 1e-9)
		})
	}
}

func TestLookupSeedanceBillingRatioPrefersRequestNameThenUpstream(t *testing.T) {
	ratio, ok := LookupSeedanceBillingRatio("1080p", true, "my-seedance-alias", "doubao-seedance-2-0-260128")
	require.True(t, ok)
	assert.InDelta(t, 31.0/46.0, ratio, 1e-9)
}

func TestLoadSeedancePricesFromJSONStringOverridesDefaults(t *testing.T) {
	original := seedancePriceSetting.Prices
	t.Cleanup(func() {
		seedancePriceSetting.Prices = original
		RebuildSeedancePriceIndex()
	})

	LoadSeedancePricesFromJSONString(`{
		"my-seedance-alias": {
			"text": {"720p": 10, "1080p": 20},
			"video": {"720p": 5, "1080p": 8}
		}
	}`)

	ratio, ok := GetVideoBillingRatio("my-seedance-alias", "1080p", false)
	require.True(t, ok)
	assert.InDelta(t, 2.0, ratio, 1e-9)

	_, ok = GetVideoBillingRatio("doubao-seedance-2-0-260128", "1080p", false)
	assert.False(t, ok)
}

func TestLoadSeedancePricesEmptyFallsBackToDefaults(t *testing.T) {
	original := seedancePriceSetting.Prices
	t.Cleanup(func() {
		seedancePriceSetting.Prices = original
		RebuildSeedancePriceIndex()
	})

	LoadSeedancePricesFromJSONString("{}")
	ratio, ok := GetVideoBillingRatio("doubao-seedance-2-0-260128", "1080p", false)
	require.True(t, ok)
	assert.InDelta(t, 51.0/46.0, ratio, 1e-9)
}
