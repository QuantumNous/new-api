package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestThemeAwarePathAlwaysRewritesKnownLegacyConsoleRoutes(t *testing.T) {
	tests := []struct {
		name string
		path string
		want string
	}{
		{name: "top up", path: "/console/topup", want: "/wallet"},
		{name: "top up suffix", path: "/console/topup/pay?method=card", want: "/wallet/pay?method=card"},
		{name: "usage logs", path: "/console/log?type=2", want: "/usage-logs?type=2"},
		{name: "profile", path: "/console/personal/edit", want: "/profile/edit"},
		{name: "unknown console route", path: "/console/channel", want: "/console/channel"},
		{name: "default route", path: "/wallet", want: "/wallet"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ThemeAwarePath(tt.path))
		})
	}
}
