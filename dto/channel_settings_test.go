package dto

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImage2ChannelCapabilityValidate(t *testing.T) {
	for _, test := range []struct {
		name       string
		capability *Image2ChannelCapability
		wantError  string
	}{
		{
			name: "valid enabled capability",
			capability: &Image2ChannelCapability{
				Enabled:       true,
				Operations:    []string{"generations", "edits"},
				Resolutions:   []string{"1024", "2048", "uhd"},
				Qualities:     []string{"standard", "high"},
				MaxN:          4,
				EditsAccepted: true,
			},
		},
		{
			name:       "disabled capability may be empty",
			capability: &Image2ChannelCapability{Enabled: false},
		},
		{
			name:       "enabled operations required",
			capability: &Image2ChannelCapability{Enabled: true, Resolutions: []string{"1024"}},
			wantError:  "operations is required",
		},
		{
			name:       "enabled resolutions required",
			capability: &Image2ChannelCapability{Enabled: true, Operations: []string{"generations"}},
			wantError:  "resolutions is required",
		},
		{
			name: "unknown operation rejected",
			capability: &Image2ChannelCapability{
				Enabled: true, Operations: []string{"generate"}, Resolutions: []string{"1024"},
			},
			wantError: "unsupported value",
		},
		{
			name: "unknown resolution rejected",
			capability: &Image2ChannelCapability{
				Enabled: true, Operations: []string{"generations"}, Resolutions: []string{"4k"},
			},
			wantError: "unsupported value",
		},
		{
			name: "duplicates rejected case insensitively",
			capability: &Image2ChannelCapability{
				Enabled: true, Operations: []string{"edits", "EDITS"}, Resolutions: []string{"1024"},
			},
			wantError: "duplicate value",
		},
		{
			name: "blank quality rejected",
			capability: &Image2ChannelCapability{
				Enabled: true, Operations: []string{"generations"}, Resolutions: []string{"1024"}, Qualities: []string{""},
			},
			wantError: "cannot contain an empty value",
		},
		{
			name: "edits operation requires explicit acceptance",
			capability: &Image2ChannelCapability{
				Enabled: true, Operations: []string{"edits"}, Resolutions: []string{"1024"}, EditsAccepted: false,
			},
			wantError: "edits_accepted must be true",
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := test.capability.Validate()
			if test.wantError == "" {
				require.NoError(t, err)
				return
			}
			require.ErrorContains(t, err, test.wantError)
		})
	}
}
