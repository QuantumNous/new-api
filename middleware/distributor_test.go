package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAutoGroupForRequestPath(t *testing.T) {
	tests := []struct {
		name            string
		usingGroup      string
		requestPath     string
		expectedGroup   string
		expectedChanged bool
	}{
		{
			name:            "routes chat completions",
			usingGroup:      "auto",
			requestPath:     "/v1/chat/completions",
			expectedGroup:   "codex-completions",
			expectedChanged: true,
		},
		{
			name:          "keeps responses auto",
			usingGroup:    "auto",
			requestPath:   "/v1/responses",
			expectedGroup: "auto",
		},
		{
			name:          "keeps explicit group",
			usingGroup:    "codex",
			requestPath:   "/v1/chat/completions",
			expectedGroup: "codex",
		},
		{
			name:          "ignores embedded chat completions fragment",
			usingGroup:    "auto",
			requestPath:   "/proxy/v1/chat/completions",
			expectedGroup: "auto",
		},
		{
			name:          "ignores similar chat completions prefix",
			usingGroup:    "auto",
			requestPath:   "/v1/chat/completions-extra",
			expectedGroup: "auto",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := autoGroupForRequestPath(tt.usingGroup, tt.requestPath)

			assert.Equal(t, tt.expectedGroup, got)
			assert.Equal(t, tt.expectedChanged, changed)
		})
	}
}
