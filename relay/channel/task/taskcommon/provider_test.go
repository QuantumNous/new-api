package taskcommon

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsAgnesAPIBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
		want    bool
	}{
		{name: "official host", baseURL: "https://apihub.agnes-ai.com", want: true},
		{name: "official host with path", baseURL: "https://apihub.agnes-ai.com/v1", want: true},
		{name: "case insensitive", baseURL: "https://APIHUB.AGNES-AI.COM", want: true},
		{name: "different provider", baseURL: "https://api.openai.com", want: false},
		{name: "lookalike suffix", baseURL: "https://apihub.agnes-ai.com.evil.example", want: false},
		{name: "lookalike subdomain", baseURL: "https://cdn.apihub.agnes-ai.com", want: false},
		{name: "invalid URL", baseURL: "://invalid", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, IsAgnesAPIBaseURL(tt.baseURL))
		})
	}
}
