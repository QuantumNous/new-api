package openai

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
)

func TestValidRealtimeUsageRejectsMissingAndZeroUsage(t *testing.T) {
	assert.False(t, validRealtimeUsage(nil))
	assert.False(t, validRealtimeUsage(&dto.RealtimeUsage{}))
}

func TestValidRealtimeUsageAcceptsNonZeroTokenUsage(t *testing.T) {
	assert.True(t, validRealtimeUsage(&dto.RealtimeUsage{TotalTokens: 1}))
	assert.True(t, validRealtimeUsage(&dto.RealtimeUsage{InputTokens: 1}))
	assert.True(t, validRealtimeUsage(&dto.RealtimeUsage{OutputTokens: 1}))
}
