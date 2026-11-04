package channel

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSelectRouteUnitCacheOffResolvesChannelFromDB is the regression guard for
// the routing defect where a bare binary + SQLite deployment with
// MEMORY_CACHE_ENABLED unset (default false) returned 503 model_not_found for
// every request. InitChannelCache early-returns when the memory cache is off,
// so channelsIDM is never built; the request-path filter and the final channel
// resolution must then read the channel from the database instead of the
// missing index. This test pins that: with MemoryCacheEnabled=false and
// channelsIDM left nil, the granted channel is resolved from the DB while a
// group-isolated (non-granted) channel is never handed out.
func TestSelectRouteUnitCacheOffResolvesChannelFromDB(t *testing.T) {
	const alias = "cache-off-model"
	db := withGroupIsolationRouteDB(t)

	// One channel granted to "default", one granted only to "vip".
	seedGroupIsolationChannel(t, db, 9101, []string{"default"}, alias)
	seedGroupIsolationChannel(t, db, 9102, []string{"vip"}, alias)

	prevMemoryCache := common.MemoryCacheEnabled
	prevGroups := group2model2channels
	prevIDM := channelsIDM
	prevAliasRoutes := alias2routes
	common.MemoryCacheEnabled = false
	// Leave the memory index unbuilt: this is the real cache-off state
	// InitChannelCache produces (it early-returns before assigning channelsIDM).
	channelSyncLock.Lock()
	channelsIDM = nil
	group2model2channels = nil
	alias2routes = nil
	channelSyncLock.Unlock()
	t.Cleanup(func() {
		channelSyncLock.Lock()
		group2model2channels = prevGroups
		channelsIDM = prevIDM
		alias2routes = prevAliasRoutes
		channelSyncLock.Unlock()
		common.MemoryCacheEnabled = prevMemoryCache
	})

	ClearUnitHealthCache()
	t.Cleanup(ClearUnitHealthCache)

	// The granted channel must be selectable despite the missing index. With a
	// single eligible route, SelectRouteUnit is deterministic for any rnd value.
	selected, err := SelectRouteUnit("default", alias, "", 0, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, selected, "cache-off path must resolve the granted channel from the DB")
	assert.Equal(t, 9101, selected.ChannelId, "the granted channel must be selected")
	assert.Equal(t, alias, selected.UpstreamModel)

	// A group-isolated (vip-only) channel must never be handed to default, and
	// an unknown group must select nothing (fail-closed isolation boundary).
	vipOnly, vipErr := SelectRouteUnit("default", alias, "", 0,
		map[RouteKey]bool{{ChannelId: 9101, KeyIndex: 0, Model: alias}: true}, nil)
	require.NoError(t, vipErr)
	assert.Nil(t, vipOnly, "excluding the only granted route must leave nothing selectable")
	unknown, err := SelectRouteUnit("no-such-group", alias, "", 0, nil, nil)
	require.NoError(t, err)
	assert.Nil(t, unknown, "an ungranted group must select nothing")

	// Sanity: the vip group still reaches its own granted channel.
	vipSelected, vipErr := SelectRouteUnit("vip", alias, "", 0, nil, nil)
	require.NoError(t, vipErr)
	require.NotNil(t, vipSelected, "vip must reach its granted channel")
	assert.Equal(t, 9102, vipSelected.ChannelId)
}

func TestSelectRouteUnitCacheOffEnforcesChannelRestrictions(t *testing.T) {
	const alias = "restricted-cache-off-model"
	tests := []struct {
		name        string
		channel     *Channel
		keyIndex    int
		requestPath string
	}{
		{
			name:    "disabled channel",
			channel: &Channel{Status: common.ChannelStatusManuallyDisabled},
		},
		{
			name: "disabled key",
			channel: &Channel{
				Status: common.ChannelStatusEnabled,
				Key:    "[\"sk-first\",\"sk-second\"]",
				ChannelInfo: ChannelInfo{
					IsMultiKey:         true,
					MultiKeyStatusList: map[int]int{0: common.ChannelStatusManuallyDisabled},
				},
			},
		},
		{
			name: "missing key",
			channel: &Channel{
				Status:      common.ChannelStatusEnabled,
				Key:         "[\"sk-first\"]",
				ChannelInfo: ChannelInfo{IsMultiKey: true},
			},
			keyIndex: 1,
		},
		{
			name: "unsupported request path",
			channel: &Channel{
				Status:        common.ChannelStatusEnabled,
				Type:          constant.ChannelTypeAdvancedCustom,
				OtherSettings: `{"advanced_custom":{"advanced_routes":[{"incoming_path":"/v1/chat/completions","models":["restricted-cache-off-model"]}]}}`,
			},
			requestPath: "/v1/embeddings",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db := withGroupIsolationRouteDB(t)
			seedGroupIsolationChannel(t, db, 9201, []string{"default"}, alias)
			require.NoError(t, db.Model(&Channel{}).Where("id = ?", 9201).Updates(tt.channel).Error)
			require.NoError(t, db.Model(&ChannelModelRoute{}).Where("channel_id = ?", 9201).Update("key_index", tt.keyIndex).Error)
			prevMemoryCache := common.MemoryCacheEnabled
			prevGroups := group2model2channels
			prevIDM := channelsIDM
			prevAliasRoutes := alias2routes
			common.MemoryCacheEnabled = false
			channelSyncLock.Lock()
			channelsIDM = nil
			group2model2channels = nil
			alias2routes = nil
			channelSyncLock.Unlock()
			t.Cleanup(func() {
				channelSyncLock.Lock()
				group2model2channels = prevGroups
				channelsIDM = prevIDM
				alias2routes = prevAliasRoutes
				channelSyncLock.Unlock()
				common.MemoryCacheEnabled = prevMemoryCache
			})

			selected, err := SelectRouteUnit("default", alias, tt.requestPath, 0, nil, nil)
			require.NoError(t, err)
			assert.Nil(t, selected, "an ineligible database channel must not be selected")
		})
	}
}
