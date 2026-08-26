package middleware

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestChannelSupportsRequestPathVolcNativeOnlyAllowsNativeRoutes(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeVolcNative}

	require.True(t, channelSupportsRequestPath(channel, "/api/v3/images/generations", "doubao-seedream-4-0"))
	require.True(t, channelSupportsRequestPath(channel, "/api/v3/contents/generations/tasks", "doubao-seedance-2-0-260128"))
	require.False(t, channelSupportsRequestPath(channel, "/v1/chat/completions", "doubao-seed-1-6"))
	require.False(t, channelSupportsRequestPath(channel, "/v1/images/generations", "doubao-seedream-4-0"))
}
