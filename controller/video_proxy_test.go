package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestResolveOpenAIVideoContentURLIsScopedToAgnes(t *testing.T) {
	tests := []struct {
		name            string
		baseURL         string
		resultURL       string
		wantURL         string
		wantChannelAuth bool
	}{
		{
			name:            "Agnes uses completed metadata URL",
			baseURL:         "https://apihub.agnes-ai.com",
			resultURL:       "https://cdn.agnes-ai.com/video.mp4",
			wantURL:         "https://cdn.agnes-ai.com/video.mp4",
			wantChannelAuth: false,
		},
		{
			name:            "Agnes without absolute metadata URL falls back",
			baseURL:         "https://apihub.agnes-ai.com",
			resultURL:       "/video.mp4",
			wantURL:         "https://apihub.agnes-ai.com/v1/videos/task-123/content",
			wantChannelAuth: true,
		},
		{
			name:            "other provider keeps existing content endpoint",
			baseURL:         "https://video.example.com",
			resultURL:       "https://cdn.example.com/video.mp4",
			wantURL:         "https://video.example.com/v1/videos/task-123/content",
			wantChannelAuth: true,
		},
		{
			name:            "Agnes lookalike keeps existing content endpoint",
			baseURL:         "https://apihub.agnes-ai.com.evil.example",
			resultURL:       "https://cdn.example.com/video.mp4",
			wantURL:         "https://apihub.agnes-ai.com.evil.example/v1/videos/task-123/content",
			wantChannelAuth: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotURL, gotChannelAuth := resolveOpenAIVideoContentURL(
				tt.baseURL,
				"task-123",
				tt.resultURL,
			)
			assert.Equal(t, tt.wantURL, gotURL)
			assert.Equal(t, tt.wantChannelAuth, gotChannelAuth)
		})
	}
}
