package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestVideoResultChannelLabel(t *testing.T) {
	require.Equal(t, "techmobi", VideoResultChannelLabel(constant.ChannelTypeTechMobiVideo))
	require.Equal(t, "modelapi", VideoResultChannelLabel(constant.ChannelTypeModelAPISeedance))

	for _, channelType := range []int{0, 1, 104, 106, 110, 112, 999} {
		require.Empty(t, VideoResultChannelLabel(channelType))
	}
}
