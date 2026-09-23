package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelModelRouteQuarantineIsScoped(t *testing.T) {
	const channelID = 190019
	const group = "default"
	const modelName = "gpt-5.6-luna"
	const requestPath = "/v1/chat/completions"

	QuarantineChannelModelRoute(channelID, group, modelName, requestPath, "upstream route unavailable")
	t.Cleanup(func() {
		key := channelModelRouteKeyFor(channelID, group, modelName, requestPath)
		channelModelRouteHealth.Lock()
		delete(channelModelRouteHealth.entries, key)
		channelModelRouteHealth.Unlock()
	})

	require.True(t, IsChannelModelRouteQuarantined(channelID, group, modelName, requestPath))
	require.False(t, IsChannelModelRouteQuarantined(channelID, group, modelName, "/v1/responses"))
	require.False(t, IsChannelModelRouteQuarantined(channelID, group, "gpt-4o", requestPath))
	require.False(t, IsChannelModelRouteQuarantined(channelID, "vip", modelName, requestPath))
	require.False(t, IsChannelModelRouteQuarantined(channelID+1, group, modelName, requestPath))
}
