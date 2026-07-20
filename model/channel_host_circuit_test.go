package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelHostCircuitBoundsSingleChannelFailureEvidence(t *testing.T) {
	now := time.Date(2026, 7, 20, 12, 0, 0, 0, time.UTC)
	registry := newChannelHostCircuitRegistry(func() time.Time { return now })
	key, ok := newChannelHostCircuitKey("https://shared.example/v1", "gpt-5.6-sol", "/v1/responses")
	require.True(t, ok)

	for i := 0; i < 1_000; i++ {
		assert.False(t, registry.recordFailure(key, 41, "timeout"))
	}

	require.Contains(t, registry.items, key)
	assert.LessOrEqual(t, len(registry.items[key].failures), channelHostFailureThreshold)
	assert.False(t, registry.isOpen(key))
	assert.True(t, registry.recordFailure(key, 42, "timeout"))
	assert.True(t, registry.isOpen(key))
}
