package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEnsureGeminiVideoAccessPreservesInlineVideo(t *testing.T) {
	inline := "data:video/mp4;base64,dmlkZW8="

	assert.Equal(t, inline, ensureGeminiVideoAccess(inline, "secret-key"))
	assert.Equal(t, "https://example.com/video.mp4?key=secret-key", ensureGeminiVideoAccess("https://example.com/video.mp4", "secret-key"))
}
