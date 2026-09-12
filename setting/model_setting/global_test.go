package model_setting

import (
	"bytes"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShouldPreserveThinkingSuffixExactAndRegex(t *testing.T) {
	settings := GetGlobalSettings()
	original := append([]string(nil), settings.ThinkingModelBlacklist...)
	t.Cleanup(func() { settings.ThinkingModelBlacklist = original })

	assert.True(t, ShouldPreserveThinkingSuffix("kimi-k2-thinking"))
	assert.True(t, ShouldPreserveThinkingSuffix("moonshotai/kimi-k2-thinking"))
	assert.False(t, ShouldPreserveThinkingSuffix("m@sha256:abc"))

	settings.ThinkingModelBlacklist = []string{
		"kimi-k2-thinking",
		"re:[",
		"re:",
		"re:.*@sha256:.*",
	}

	var logged bytes.Buffer
	previous := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logged
	t.Cleanup(func() { gin.DefaultErrorWriter = previous })

	assert.True(t, ShouldPreserveThinkingSuffix("kimi-k2-thinking"))
	assert.True(t, ShouldPreserveThinkingSuffix("m@sha256:abc"))
	assert.False(t, ShouldPreserveThinkingSuffix("m@sha256"))
	assert.False(t, ShouldPreserveThinkingSuffix("qwen3-max@thinking:on"))
	require.Contains(t, logged.String(), `invalid thinking_model_blacklist regex "re:["`)
	require.Contains(t, logged.String(), `invalid thinking_model_blacklist regex "re:"`)

	settings.ThinkingModelBlacklist = []string{"re:^beta@"}
	assert.False(t, ShouldPreserveThinkingSuffix("m@sha256:abc"))
	assert.True(t, ShouldPreserveThinkingSuffix("beta@sha256:abc"))
	assert.False(t, ShouldPreserveThinkingSuffix("alpha@sha256:abc"))
}

func TestShouldPreserveThinkingSuffixGemini3ComputeTier(t *testing.T) {
	// Gemini 3.x official model names end in compute-tier suffixes that
	// collide with legacy thinking aliases. The default blacklist must
	// preserve them so model mapping and upstream routing stay intact.
	assert.True(t, ShouldPreserveThinkingSuffix("gemini-3.8-flash-high"),
		"gemini-3.8-flash-high is an official model name, not a thinking alias")
	assert.True(t, ShouldPreserveThinkingSuffix("gemini-3.8-pro-high"))
	assert.True(t, ShouldPreserveThinkingSuffix("gemini-3.5-flash-medium"))
	assert.True(t, ShouldPreserveThinkingSuffix("gemini-3.8-flash-low"))

	// Gemini 2.x legacy thinking aliases must NOT be preserved.
	assert.False(t, ShouldPreserveThinkingSuffix("gemini-2.5-pro-high"),
		"gemini-2.5-pro-high is a legacy thinking alias, not an official model name")

	// Models without a compute-tier suffix are unaffected.
	assert.False(t, ShouldPreserveThinkingSuffix("gemini-3.8-flash"))
	assert.False(t, ShouldPreserveThinkingSuffix("gemini-3.8-pro"))
}
