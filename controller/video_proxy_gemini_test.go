package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnsureGeminiVideoAccessPreservesInlineVideo(t *testing.T) {
	inline := "data:video/mp4;base64,dmlkZW8="

	assert.Equal(t, inline, ensureGeminiVideoAccess(inline, "secret-key"))
	assert.Equal(t, "https://example.com/video.mp4?key=secret-key", ensureGeminiVideoAccess("https://example.com/video.mp4", "secret-key"))
}

func TestStoredGeminiInlineVideoUsesUnifiedAccessHandler(t *testing.T) {
	inline := "data:video/mp4;base64,dmlkZW8="
	task := &model.Task{}
	task.SetData(map[string]any{"response": map[string]any{"video": inline}})

	extracted := extractGeminiVideoURLFromTaskData(task)
	require.Equal(t, inline, extracted)
	assert.Equal(t, inline, ensureGeminiVideoAccess(extracted, "secret-key"))
}
