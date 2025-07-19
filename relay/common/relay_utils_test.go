package common

import (
	"one-api/constant"
	"testing"
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
			name:        "OpenAI",
			baseURL:     "https://api.openai.com",
			requestURL:  "/v1/chat/completions",
			channelType: constant.APITypeOpenAI,
			want:        "https://api.openai.com/v1/chat/completions",
		},
		{
			name:        "OpenAI Compatible",
			baseURL:     "https://foo.bar/",
			requestURL:  "/v1/chat/completions",
			channelType: constant.APITypeOpenAI,
			want:        "https://foo.bar/chat/completions",
		},
		{
			name:        "OpenAI Compatible 2",
			baseURL:     "https://foo.bar/api",
			requestURL:  "/v1/chat/completions",
			channelType: constant.APITypeOpenAI,
			want:        "https://foo.bar/api/chat/completions",
		},
		{
			name:        "OpenAI Compatible with trailing slash",
			baseURL:     "https://foo.bar/v1/",
			requestURL:  "/v1/chat/completions",
			channelType: constant.APITypeOpenAI,
			want:        "https://foo.bar/v1/chat/completions",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := GetFullRequestURL(tt.baseURL, tt.requestURL, tt.channelType); got != tt.want {
				t.Errorf("GetFullRequestURL() = %v, want %v", got, tt.want)
			}
		})
	}
}
