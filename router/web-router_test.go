package router

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// The legacy-console whitelist decides which GET paths keep serving the
// embedded React SPA instead of redirecting to the Vue frontend. Exact
// prefixes and their subpaths must match; sibling paths that merely share
// the prefix characters must not.
func TestIsLegacyConsoleRequest(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{path: "/system-settings", want: true},
		{path: "/system-settings/operations/general", want: true},
		{path: "/channels", want: true},
		{path: "/channels/", want: true},
		{path: "/usage-logs/drawing", want: true},
		{path: "/channelsfoo", want: false},
		{path: "/usage-logsx", want: false},
		{path: "/console/channels", want: false},
		{path: "/", want: false},
		{path: "/next/console", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			assert.Equal(t, tt.want, isLegacyConsoleRequest(tt.path))
		})
	}
}
