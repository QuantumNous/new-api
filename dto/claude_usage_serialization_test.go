package dto

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tidwall/gjson"
)

// TestClaudeUsageOmitsInternalCacheFieldsWhenZero verifies the new-api-internal
// claude_cache_creation_* accounting fields (not part of the official
// Anthropic usage schema) do NOT appear in the client-facing JSON when zero
// (R2.3).
func TestClaudeUsageOmitsInternalCacheFieldsWhenZero(t *testing.T) {
	usage := ClaudeUsage{
		InputTokens:  862,
		OutputTokens: 10,
	}
	b, err := json.Marshal(usage)
	assert.NoError(t, err)
	s := string(b)

	assert.False(t, gjson.Get(s, "claude_cache_creation_5_m_tokens").Exists(),
		"claude_cache_creation_5_m_tokens must be omitted when zero")
	assert.False(t, gjson.Get(s, "claude_cache_creation_1_h_tokens").Exists(),
		"claude_cache_creation_1_h_tokens must be omitted when zero")
	// cache_creation pointer is nil -> omitted; official schema uses it when present.
	assert.False(t, gjson.Get(s, "cache_creation").Exists())
	assert.EqualValues(t, 862, gjson.Get(s, "input_tokens").Int())
}

// TestClaudeUsageEmitsInternalCacheFieldsWhenNonZero verifies the fields are
// still serialized when populated (so any non-Anthropic-shaped internal
// consumer that may rely on the JSON still sees them).
func TestClaudeUsageEmitsInternalCacheFieldsWhenNonZero(t *testing.T) {
	usage := ClaudeUsage{
		InputTokens:                 862,
		ClaudeCacheCreation5mTokens: 100,
		ClaudeCacheCreation1hTokens: 200,
	}
	b, err := json.Marshal(usage)
	assert.NoError(t, err)
	s := string(b)

	assert.EqualValues(t, 100, gjson.Get(s, "claude_cache_creation_5_m_tokens").Int())
	assert.EqualValues(t, 200, gjson.Get(s, "claude_cache_creation_1_h_tokens").Int())
}

// TestClaudeUsageCacheCreationOfficialShape verifies prompt-cache usage is
// expressed via the official cache_creation{ephemeral_5m/1h_input_tokens}
// structure (R2.3).
func TestClaudeUsageCacheCreationOfficialShape(t *testing.T) {
	usage := ClaudeUsage{
		InputTokens: 862,
		CacheCreation: &ClaudeCacheCreationUsage{
			Ephemeral5mInputTokens: 100,
			Ephemeral1hInputTokens: 200,
		},
	}
	b, err := json.Marshal(usage)
	assert.NoError(t, err)
	s := string(b)

	assert.EqualValues(t, 100, gjson.Get(s, "cache_creation.ephemeral_5m_input_tokens").Int())
	assert.EqualValues(t, 200, gjson.Get(s, "cache_creation.ephemeral_1h_input_tokens").Int())
	// The internal fields stay omitted when zero even with cache_creation present.
	assert.False(t, gjson.Get(s, "claude_cache_creation_5_m_tokens").Exists())
}
