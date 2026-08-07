package constant

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPath2RelayModeRecognizesStudioImageEndpoints(t *testing.T) {
	tests := []struct {
		path string
		want int
	}{
		{path: "/v1/studio/images/generations", want: RelayModeImagesGenerations},
		{path: "/v1/studio/images/edits", want: RelayModeImagesEdits},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			require.Equal(t, test.want, Path2RelayMode(test.path))
		})
	}
}

func TestPath2RelayMode(t *testing.T) {
	tests := []struct {
		path string
		want int
	}{
		{path: "/v1/alpha/search", want: RelayModeAlphaSearch},
		{path: "/v1/alpha/search?foo=1", want: RelayModeAlphaSearch},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			assert.Equal(t, tt.want, Path2RelayMode(tt.path))
		})
	}
}
