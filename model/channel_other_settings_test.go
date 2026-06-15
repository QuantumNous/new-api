package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ptrString(value string) *string {
	return &value
}

func TestChannelGetOtherSettingsFallsBackToLegacySettingTrustUpstreamUsage(t *testing.T) {
	channel := &Channel{
		Setting: ptrString(`{"trust_upstream_usage":true}`),
	}

	settings := channel.GetOtherSettings()

	require.NotNil(t, settings.TrustUpstreamUsage)
	assert.True(t, *settings.TrustUpstreamUsage)
}

func TestChannelGetOtherSettingsPrefersSettingsOverLegacySettingTrustUpstreamUsage(t *testing.T) {
	channel := &Channel{
		Setting:       ptrString(`{"trust_upstream_usage":true}`),
		OtherSettings: `{"trust_upstream_usage":false}`,
	}

	settings := channel.GetOtherSettings()

	require.NotNil(t, settings.TrustUpstreamUsage)
	assert.False(t, *settings.TrustUpstreamUsage)
}
