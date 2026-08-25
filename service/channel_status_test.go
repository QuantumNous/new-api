package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestShouldEnableChannelOnlyRecoversAutoDisabled(t *testing.T) {
	previous := common.AutomaticEnableChannelEnabled
	common.AutomaticEnableChannelEnabled = true
	t.Cleanup(func() { common.AutomaticEnableChannelEnabled = previous })

	require.True(t, ShouldEnableChannel(nil, common.ChannelStatusAutoDisabled))
	require.False(t, ShouldEnableChannel(nil, common.ChannelStatusBanned))
}
