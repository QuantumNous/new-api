package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestGetFullRequestURL(t *testing.T) {
	tests := []struct {
		name        string
		baseURL     string
		requestURL  string
		channelType int
		want        string
	}{
		{
			name:        "base path v1 does not duplicate request v1",
			baseURL:     "https://open.hongniaoai.com/v1",
			requestURL:  "/v1/images/generations",
			channelType: constant.ChannelTypeOpenAI,
			want:        "https://open.hongniaoai.com/v1/images/generations",
		},
		{
			name:        "base path suffix overlaps request prefix",
			baseURL:     "https://example.com/api/v1/",
			requestURL:  "/v1/images/generations?foo=bar",
			channelType: constant.ChannelTypeOpenAI,
			want:        "https://example.com/api/v1/images/generations?foo=bar",
		},
		{
			name:        "non overlapping base path is preserved",
			baseURL:     "https://api.marswave.ai/openapi",
			requestURL:  "/v1/images/generation",
			channelType: constant.ChannelTypeListenHub,
			want:        "https://api.marswave.ai/openapi/v1/images/generation",
		},
		{
			name:        "root base path joins request",
			baseURL:     "https://api.openai.com",
			requestURL:  "/v1/chat/completions",
			channelType: constant.ChannelTypeOpenAI,
			want:        "https://api.openai.com/v1/chat/completions",
		},
		{
			name:        "request without leading slash",
			baseURL:     "https://api.openai.com/v1",
			requestURL:  "chat/completions",
			channelType: constant.ChannelTypeOpenAI,
			want:        "https://api.openai.com/v1/chat/completions",
		},
		{
			name:        "cloudflare openai keeps gateway provider path",
			baseURL:     "https://gateway.ai.cloudflare.com/v1/account/gateway/openai",
			requestURL:  "/v1/chat/completions",
			channelType: constant.ChannelTypeOpenAI,
			want:        "https://gateway.ai.cloudflare.com/v1/account/gateway/openai/chat/completions",
		},
		{
			name:        "absolute request url is returned as-is",
			baseURL:     "https://api.openai.com/v1",
			requestURL:  "https://other.example.com/v1/models",
			channelType: constant.ChannelTypeOpenAI,
			want:        "https://other.example.com/v1/models",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GetFullRequestURL(tt.baseURL, tt.requestURL, tt.channelType)
			if got != tt.want {
				t.Fatalf("GetFullRequestURL() = %q, want %q", got, tt.want)
			}
		})
	}
}
