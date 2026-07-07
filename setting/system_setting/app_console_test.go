package system_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeAppConsoleOriginAcceptsEmptyAndHttpOrigins(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "empty",
			in:   " ",
			want: "",
		},
		{
			name: "https origin with trailing slash",
			in:   " https://console.flatkey.ai/ ",
			want: "https://console.flatkey.ai",
		},
		{
			name: "http origin with port",
			in:   "http://localhost:3000",
			want: "http://localhost:3000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeAppConsoleOrigin(tt.in)
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestNormalizeAppConsoleOriginRejectsNonOrigins(t *testing.T) {
	tests := []string{
		"console.flatkey.ai",
		"//console.flatkey.ai",
		"javascript:alert(1)",
		"https://console.flatkey.ai/path",
		"https://console.flatkey.ai?next=/console",
		"https://console.flatkey.ai/#fragment",
		"https://user:pass@console.flatkey.ai",
	}

	for _, in := range tests {
		t.Run(in, func(t *testing.T) {
			_, err := NormalizeAppConsoleOrigin(in)
			require.Error(t, err)
		})
	}
}
