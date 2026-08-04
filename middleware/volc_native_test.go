package middleware

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestChannelSupportsRequestPathVolcNativeOnlyAllowsNativeRoutes(t *testing.T) {
	channel := &model.Channel{Type: constant.ChannelTypeVolcNative}

	require.True(t, channelSupportsRequestPath(channel, "/api/v3/images/generations"))
	require.True(t, channelSupportsRequestPath(channel, "/api/v3/contents/generations/tasks"))
	require.False(t, channelSupportsRequestPath(channel, "/v1/chat/completions"))
	require.False(t, channelSupportsRequestPath(channel, "/v1/images/generations"))
}
