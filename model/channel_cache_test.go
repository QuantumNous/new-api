package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// An enabled channel whose group has no row in the abilities table (direct DB
// edits, ability rows that failed to be written) used to make InitChannelCache
// panic with "assignment to entry in nil map" on every sync tick.
func TestInitChannelCacheToleratesEnabledChannelWithoutAbilities(t *testing.T) {
	prevEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true

	channelSyncLock.RLock()
	prevGroup2model2channels := group2model2channels
	prevChannelsIDM := channelsIDM
	prevAdvancedCustomConfig := channel2advancedCustomConfig
	channelSyncLock.RUnlock()

	// The package-level in-memory DB is shared by every model test, so give the
	// fixture route keys that cannot collide with rows left by other tests.
	suffix := common.GetUUID()
	orphan := &Channel{
		Type:   1,
		Key:    "k",
		Status: common.ChannelStatusEnabled,
		Name:   "orphan-channel-without-abilities-" + suffix,
		Group:  "orphan-group-without-abilities-" + suffix,
		Models: "orphan-model-without-abilities-" + suffix,
	}
	require.NoError(t, DB.Create(orphan).Error)
	t.Cleanup(func() {
		require.NoError(t, DB.Delete(&Channel{}, orphan.Id).Error)
		channelSyncLock.Lock()
		group2model2channels = prevGroup2model2channels
		channelsIDM = prevChannelsIDM
		channel2advancedCustomConfig = prevAdvancedCustomConfig
		channelSyncLock.Unlock()
		common.MemoryCacheEnabled = prevEnabled
	})

	require.NotPanics(t, InitChannelCache)

	channelSyncLock.RLock()
	defer channelSyncLock.RUnlock()
	assert.Equal(t, []int{orphan.Id}, group2model2channels[orphan.Group][orphan.Models],
		"the channels table drives the in-memory routing table, so the orphan group must stay routable")
}
