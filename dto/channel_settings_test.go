package dto

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func boolPtr(v bool) *bool {
	return &v
}

func intPtr(v int) *int {
	return &v
}

func TestChannelSettingsValidate(t *testing.T) {
	err := ChannelSettings{
		RequestTimeoutEnabled: boolPtr(true),
	}.Validate()
	require.NoError(t, err)

	err = ChannelSettings{
		RequestTimeoutSeconds: intPtr(0),
	}.Validate()
	require.Error(t, err)

	err = ChannelSettings{
		StreamIdleTimeoutSeconds: intPtr(-1),
	}.Validate()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "流式空闲超时")
}

func TestChannelSettingsResolveDefaults(t *testing.T) {
	s := ChannelSettings{}

	requestTimeout, ok := s.ResolveRequestTimeoutOverride(false)
	require.True(t, ok)
	assert.Equal(t, DefaultRequestTimeoutSeconds, int(requestTimeout.Seconds()))

	responseHeaderTimeout, ok := s.ResolveResponseHeaderTimeoutOverride(false)
	require.True(t, ok)
	assert.Equal(t, DefaultResponseHeaderTimeoutSeconds, int(responseHeaderTimeout.Seconds()))

	streamResponseHeaderTimeout, ok := s.ResolveResponseHeaderTimeoutOverride(true)
	require.True(t, ok)
	assert.Equal(t, DefaultStreamResponseHeaderTimeoutSeconds, int(streamResponseHeaderTimeout.Seconds()))

	streamIdleTimeout, ok := s.ResolveStreamIdleTimeoutOverride()
	require.True(t, ok)
	assert.Equal(t, DefaultStreamIdleTimeoutSeconds, int(streamIdleTimeout.Seconds()))
}

func TestGetChannelTimeoutDefaults(t *testing.T) {
	defaults := GetChannelTimeoutDefaults()

	assert.True(t, defaults.RequestTimeoutEnabled)
	assert.Equal(t, DefaultRequestTimeoutSeconds, defaults.RequestTimeoutSeconds)
	assert.True(t, defaults.ResponseHeaderTimeoutEnabled)
	assert.Equal(t, DefaultResponseHeaderTimeoutSeconds, defaults.ResponseHeaderTimeoutSeconds)
	assert.True(t, defaults.StreamIdleTimeoutEnabled)
	assert.Equal(t, DefaultStreamIdleTimeoutSeconds, defaults.StreamIdleTimeoutSeconds)
	assert.True(t, defaults.StreamResponseHeaderTimeoutEnabled)
	assert.Equal(t, DefaultStreamResponseHeaderTimeoutSeconds, defaults.StreamResponseHeaderTimeoutSeconds)
}
