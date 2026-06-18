package common

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
)

func TestShouldTrustUpstreamUsageDefaultsToFalse(t *testing.T) {
	assert.False(t, ShouldTrustUpstreamUsage(dto.ChannelOtherSettings{}))
}

func TestShouldTrustUpstreamUsageExplicitTrue(t *testing.T) {
	value := true
	assert.True(t, ShouldTrustUpstreamUsage(dto.ChannelOtherSettings{
		TrustUpstreamUsage: &value,
	}))
}

func TestShouldTrustUpstreamUsageExplicitFalse(t *testing.T) {
	value := false
	assert.False(t, ShouldTrustUpstreamUsage(dto.ChannelOtherSettings{
		TrustUpstreamUsage: &value,
	}))
}
