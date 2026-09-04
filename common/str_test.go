package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCanonicalRelayRequestPath(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "chat completions mapped to v1",
			in:   "/pg/chat/completions",
			want: "/v1/chat/completions",
		},
		{
			name: "images generations mapped to v1",
			in:   "/pg/images/generations",
			want: "/v1/images/generations",
		},
		{
			name: "subpath preserved",
			in:   "/pg/audio/speech",
			want: "/v1/audio/speech",
		},
		{
			name: "standard v1 path untouched",
			in:   "/v1/chat/completions",
			want: "/v1/chat/completions",
		},
		{
			name: "exact prefix match only",
			in:   "/pg",
			want: "/pg",
		},
		{
			name: "non pg path untouched",
			in:   "/api/user/models",
			want: "/api/user/models",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, CanonicalRelayRequestPath(tt.in))
		})
	}
}
