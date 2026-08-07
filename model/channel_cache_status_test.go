package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelStatusDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))

	previousDB := DB
	previousLogDB := LOG_DB
	DB = db
	LOG_DB = db
	t.Cleanup(func() {
		DB = previousDB
		LOG_DB = previousLogDB
	})
	return db
}

func setupChannelCacheFixture(t *testing.T, channel *Channel) {
	t.Helper()
	prevMemoryCache := common.MemoryCacheEnabled
	prevIDM := channelsIDM
	prevIndex := group2model2channels
	prevSince := channelEnabledSince
	prevAdvancedCustomConfig := channel2advancedCustomConfig
	t.Cleanup(func() {
		channelSyncLock.Lock()
		common.MemoryCacheEnabled = prevMemoryCache
		channelsIDM = prevIDM
		group2model2channels = prevIndex
		channelEnabledSince = prevSince
		channel2advancedCustomConfig = prevAdvancedCustomConfig
		channelSyncLock.Unlock()
	})
	channelSyncLock.Lock()
	common.MemoryCacheEnabled = true
	channelsIDM = map[int]*Channel{channel.Id: channel}
	group2model2channels = map[string]map[string][]int{}
	channelEnabledSince = map[int]time.Time{}
	channel2advancedCustomConfig = map[int]*dto.AdvancedCustomConfig{}
	channelSyncLock.Unlock()
}

// Regression for the multi-key recovery pointer-aliasing bug: UpdateChannelStatus's
// multi-key branch mutates the shared cached *Channel via handlerMultiKeyUpdate
// BEFORE notifying the cache index, so a variant that re-reads oldStatus from the
// cache observes oldStatus==newStatus and never re-arms channelEnabledSince. The
// From variant must arm the stability clock from the caller-supplied prior status.
func TestCacheUpdateChannelStatusFromArmsStabilityClockAfterInPlaceMutation(t *testing.T) {
	channel := &Channel{Id: 7, Group: "default", Models: "gpt-test", Status: common.ChannelStatusAutoDisabled}
	setupChannelCacheFixture(t, channel)

	// Simulate handlerMultiKeyUpdate: the shared pointer already carries the new
	// status by the time the cache-index update runs.
	channel.Status = common.ChannelStatusEnabled
	CacheUpdateChannelStatusFrom(channel.Id, common.ChannelStatusAutoDisabled, common.ChannelStatusEnabled)

	channelSyncLock.RLock()
	since, tracked := channelEnabledSince[channel.Id]
	indexed := group2model2channels["default"]["gpt-test"]
	channelSyncLock.RUnlock()

	require.True(t, tracked, "recovery must re-arm the stability clock even though the cached status was already mutated in place")
	assert.WithinDuration(t, time.Now(), since, 5*time.Second)
	assert.Contains(t, indexed, channel.Id, "recovered channel must be re-inserted into the selection index")
}

// The single-key path (no prior in-place mutation) must keep its semantics: a
// genuine transition arms the clock, a redundant Enabled->Enabled call must not
// reset an already-running clock.
func TestCacheUpdateChannelStatusKeepsExistingClockOnRedundantEnable(t *testing.T) {
	channel := &Channel{Id: 8, Group: "default", Models: "gpt-test", Status: common.ChannelStatusEnabled}
	setupChannelCacheFixture(t, channel)
	armedAt := time.Now().Add(-90 * time.Minute)
	channelSyncLock.Lock()
	channelEnabledSince[channel.Id] = armedAt
	channelSyncLock.Unlock()

	CacheUpdateChannelStatus(channel.Id, common.ChannelStatusEnabled)

	channelSyncLock.RLock()
	since, tracked := channelEnabledSince[channel.Id]
	channelSyncLock.RUnlock()
	require.True(t, tracked)
	assert.Equal(t, armedAt, since, "redundant Enabled->Enabled must not restart the stability clock")
}

// First-load backdating must satisfy ANY configured stability window, because
// priority_aware_stable_seconds has no upper bound: a fixed -24h backdate left
// channels reported unstable for (configured-86400)s after every restart.
func TestSyncChannelEnabledSinceFirstLoadBackdatesBeyondAnyWindow(t *testing.T) {
	channel := &Channel{Id: 9, Group: "default", Models: "gpt-test", Status: common.ChannelStatusEnabled}
	setupChannelCacheFixture(t, channel)

	channelSyncLock.Lock()
	channelEnabledSince = map[int]time.Time{}
	syncChannelEnabledSinceLocked(map[int]*Channel{channel.Id: channel}, true)
	since, tracked := channelEnabledSince[channel.Id]
	channelSyncLock.Unlock()

	require.True(t, tracked)
	weekInSeconds := 7 * 24 * time.Hour
	assert.GreaterOrEqual(t, time.Since(since), weekInSeconds,
		"first-load backdate must exceed any plausible configured stability window, not just 24h")
}

// The external breaker intentionally updates channels and abilities through SQL.
// This recreates the stale-cache state and verifies a successful recovery brings
// persistent state and the in-memory selection index back into agreement.
func TestUpdateChannelStatusRecoversDatabaseStateWhenCacheIsStale(t *testing.T) {
	db := setupChannelStatusDatabase(t)

	databaseChannel := &Channel{
		Id:     70,
		Key:    "test-key",
		Group:  "default",
		Models: "gpt-test",
		Status: common.ChannelStatusAutoDisabled,
	}
	require.NoError(t, db.Create(databaseChannel).Error)
	require.NoError(t, db.Create(&Ability{
		Group:     "default",
		Model:     "gpt-test",
		ChannelId: databaseChannel.Id,
		Enabled:   false,
	}).Error)

	staleCachedChannel := *databaseChannel
	staleCachedChannel.Status = common.ChannelStatusEnabled
	setupChannelCacheFixture(t, &staleCachedChannel)
	channelSyncLock.Lock()
	group2model2channels["default"] = map[string][]int{"gpt-test": {databaseChannel.Id}}
	channelEnabledSince[databaseChannel.Id] = time.Now().Add(-time.Hour)
	channelSyncLock.Unlock()

	require.True(t, UpdateChannelStatus(databaseChannel.Id, "", common.ChannelStatusEnabled, "recovery probe succeeded"))

	var persistedChannel Channel
	require.NoError(t, db.First(&persistedChannel, databaseChannel.Id).Error)
	assert.Equal(t, common.ChannelStatusEnabled, persistedChannel.Status)

	var persistedAbility Ability
	require.NoError(t, db.First(&persistedAbility, "channel_id = ?", databaseChannel.Id).Error)
	assert.True(t, persistedAbility.Enabled)

	cachedChannel, err := CacheGetChannel(databaseChannel.Id)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusEnabled, cachedChannel.Status)
	assert.NotSame(t, &staleCachedChannel, cachedChannel)

	channelSyncLock.RLock()
	indexed := group2model2channels["default"]["gpt-test"]
	channelSyncLock.RUnlock()
	assert.Contains(t, indexed, databaseChannel.Id)
}

func TestUpdateChannelStatusRepairsDisabledAbilityWhenChannelIsAlreadyEnabled(t *testing.T) {
	db := setupChannelStatusDatabase(t)

	databaseChannel := &Channel{
		Id:     71,
		Key:    "test-key",
		Group:  "default",
		Models: "gpt-test",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, db.Create(databaseChannel).Error)
	require.NoError(t, db.Create(&Ability{
		Group:     "default",
		Model:     "gpt-test",
		ChannelId: databaseChannel.Id,
		Enabled:   false,
	}).Error)

	staleCachedChannel := *databaseChannel
	staleCachedChannel.Status = common.ChannelStatusAutoDisabled
	setupChannelCacheFixture(t, &staleCachedChannel)

	require.True(t, UpdateChannelStatus(databaseChannel.Id, "", common.ChannelStatusEnabled, "recovery probe succeeded"))

	var persistedAbility Ability
	require.NoError(t, db.First(&persistedAbility, "channel_id = ?", databaseChannel.Id).Error)
	assert.True(t, persistedAbility.Enabled)

	cachedChannel, err := CacheGetChannel(databaseChannel.Id)
	require.NoError(t, err)
	assert.Equal(t, common.ChannelStatusEnabled, cachedChannel.Status)

	channelSyncLock.RLock()
	indexed := group2model2channels["default"]["gpt-test"]
	channelSyncLock.RUnlock()
	assert.Contains(t, indexed, databaseChannel.Id)
}
