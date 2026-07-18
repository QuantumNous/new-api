package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestGetSatisfiedChannelsOrdersByPriorityAndExcludesIDs(t *testing.T) {
	clearPreferredOwnerTables(t)
	t.Cleanup(func() {
		clearPreferredOwnerTables(t)
		InitChannelCache()
	})

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = originalMemoryCacheEnabled })

	insertPreferredOwnerCandidate(t, 9401, "glm-4", "default", constant.ChannelTypeOpenAI, 10, 100, common.ChannelStatusEnabled, true)
	insertPreferredOwnerCandidate(t, 9402, "glm-4", "default", constant.ChannelTypeOpenAI, 20, 100, common.ChannelStatusEnabled, true)
	insertPreferredOwnerCandidate(t, 9403, "glm-4", "default", constant.ChannelTypeOpenAI, 10, 100, common.ChannelStatusEnabled, true)

	channels, err := GetSatisfiedChannels("default", "glm-4", "", []int{9401})
	require.NoError(t, err)
	require.Len(t, channels, 2)
	require.Equal(t, 9402, channels[0].Id)
	require.Equal(t, 9403, channels[1].Id)
}
