package model

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// setupChannelCache installs a synthetic in-memory channel cache for the given
// group/model and returns a cleanup function. Each entry is (id, priority,
// weight). All channels are created enabled.
func setupChannelCache(t *testing.T, group, modelName string, entries [][3]int) func() {
	t.Helper()

	oldMemoryCache := common.MemoryCacheEnabled
	oldGroup2model := group2model2channels
	oldChannelsIDM := channelsIDM
	oldAdvanced := channel2advancedCustomConfig
	oldCooldownEntries := make(map[any]any)
	channelKeyCooldown.Range(func(key, value any) bool {
		oldCooldownEntries[key] = value
		channelKeyCooldown.Delete(key)
		return true
	})

	common.MemoryCacheEnabled = true

	channelsIDM = make(map[int]*Channel)
	ids := make([]int, 0, len(entries))
	for _, e := range entries {
		id, priority, weight := e[0], e[1], e[2]
		p := int64(priority)
		w := uint(weight)
		channelsIDM[id] = &Channel{
			Id:       id,
			Status:   common.ChannelStatusEnabled,
			Priority: &p,
			Weight:   &w,
		}
		ids = append(ids, id)
	}
	group2model2channels = map[string]map[string][]int{
		group: {modelName: ids},
	}
	channel2advancedCustomConfig = make(map[int]*dto.AdvancedCustomConfig)

	return func() {
		common.MemoryCacheEnabled = oldMemoryCache
		group2model2channels = oldGroup2model
		channelsIDM = oldChannelsIDM
		channel2advancedCustomConfig = oldAdvanced
		channelKeyCooldown.Range(func(key, _ any) bool {
			channelKeyCooldown.Delete(key)
			return true
		})
		for key, value := range oldCooldownEntries {
			channelKeyCooldown.Store(key, value)
		}
	}
}

func TestGetRandomSatisfiedChannel_ExcludesFailedChannels(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 0, 0},
		{2, 0, 0},
		{3, 0, 0},
	})
	defer cleanup()

	// exclude ch1 -> must return ch2 or ch3, never ch1
	for i := 0; i < 20; i++ {
		ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true})
		require.NoError(t, err)
		require.NotNil(t, ch)
		require.NotEqual(t, 1, ch.Id, "excluded channel #1 was returned")
	}

	// exclude ch1+ch2 -> must return ch3
	ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true, 2: true})
	require.NoError(t, err)
	require.NotNil(t, ch)
	require.Equal(t, 3, ch.Id)

	// exclude all -> no more channels to try
	ch, err = GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true, 2: true, 3: true})
	require.NoError(t, err)
	require.Nil(t, ch)
}

// TestGetRandomSatisfiedChannel_PriorityDescentAfterExhaustion verifies bug #6:
// same-priority channels must all be tried before descending to a lower
// priority. ch1/ch2 share priority 10, ch3 has priority 5.
func TestGetRandomSatisfiedChannel_PriorityDescentAfterExhaustion(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 10, 0},
		{3, 5, 0},
	})
	defer cleanup()

	// exclude ch1 -> must still return ch2 (same top priority), not descend to ch3
	for i := 0; i < 20; i++ {
		ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true})
		require.NoError(t, err)
		require.NotNil(t, ch)
		require.Equal(t, 2, ch.Id)
	}

	// exclude ch1+ch2 -> descend to ch3
	ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", map[int]bool{1: true, 2: true})
	require.NoError(t, err)
	require.NotNil(t, ch)
	require.Equal(t, 3, ch.Id)
}

// TestGetRandomSatisfiedChannel_NilExcludeBackwardCompat verifies that with no
// exclusion (first attempt), the top priority channel pool is used.
func TestGetRandomSatisfiedChannel_NilExcludeBackwardCompat(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 5, 0},
	})
	defer cleanup()

	for i := 0; i < 20; i++ {
		ch, err := GetRandomSatisfiedChannel("default", "gpt-x", "", nil)
		require.NoError(t, err)
		require.NotNil(t, ch)
		require.Equal(t, 1, ch.Id)
	}
}

// TestCountAvailableChannels verifies the adaptive retry budget helper counts
// every distinct channel that can serve the group/model, across priority tiers.
// With single-key channels the count equals the number of channels.
func TestCountAvailableChannels(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 10, 0},
		{3, 5, 0},
	})
	defer cleanup()

	assert.Equal(t, 3, CountAvailableChannels("default", "gpt-x", ""))
	assert.Equal(t, 0, CountAvailableChannels("default", "nonexistent", ""))
	assert.Equal(t, 0, CountAvailableChannels("nonexistent", "gpt-x", ""))
}

// TestCountEnabledKeys verifies the per-channel enabled-key count used to size
// how many times a multi-key channel may be re-selected within one request.
func TestCountEnabledKeys(t *testing.T) {
	single := &Channel{Id: 1, Key: "k1"}
	assert.Equal(t, 1, single.CountEnabledKeys())

	multi := &Channel{Id: 2, Key: "k1\nk2\nk3"}
	multi.ChannelInfo.IsMultiKey = true
	assert.Equal(t, 3, multi.CountEnabledKeys())

	// Disable one key via status list -> count drops to 2.
	multi.ChannelInfo.MultiKeyStatusList = map[int]int{1: common.ChannelStatusAutoDisabled}
	assert.Equal(t, 2, multi.CountEnabledKeys())

	empty := &Channel{Id: 3}
	empty.ChannelInfo.IsMultiKey = true
	assert.Equal(t, 0, empty.CountEnabledKeys())
}

// TestCountAvailableChannels_MultiKeyWeighted verifies the retry budget counts a
// multi-key channel once per enabled key, so every key can be tried before the
// channel is excluded from retry.
func TestCountAvailableChannels_MultiKeyWeighted(t *testing.T) {
	cleanup := setupChannelCache(t, "default", "gpt-x", [][3]int{
		{1, 10, 0},
		{2, 10, 0},
	})
	defer cleanup()

	// Make ch1 a 3-key channel; ch2 stays single-key. Expected budget: 3 + 1 = 4.
	ch1 := channelsIDM[1]
	ch1.Key = "k1\nk2\nk3"
	ch1.ChannelInfo.IsMultiKey = true

	assert.Equal(t, 4, CountAvailableChannels("default", "gpt-x", ""))
}

func setupChannelDB(t *testing.T, log logger.Interface) *gorm.DB {
	t.Helper()
	oldDB := DB
	oldMemoryCache := common.MemoryCacheEnabled
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: log})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))
	DB = db
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		DB = oldDB
		common.MemoryCacheEnabled = oldMemoryCache
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	return db
}

func createChannelDBFixture(t *testing.T, db *gorm.DB, id int, group, modelName string, key string) {
	t.Helper()
	priority := int64(10)
	weight := uint(100)
	require.NoError(t, db.Create(&Channel{
		Id: id, Key: key, Status: common.ChannelStatusEnabled,
		Priority: &priority, Weight: &weight, Models: modelName, Group: group,
	}).Error)
	require.NoError(t, db.Create(&Ability{
		Group: group, Model: modelName, ChannelId: id, Enabled: true,
		Priority: &priority, Weight: weight,
	}).Error)
}

func TestGetChannelDBFallsBackToNormalizedModel(t *testing.T) {
	db := setupChannelDB(t, logger.Default.LogMode(logger.Silent))
	const requested = "gpt-4o-gizmo-demo"
	normalized := ratio_setting.FormatMatchingModelName(requested)
	require.NotEmpty(t, normalized)
	require.NotEqual(t, requested, normalized)
	createChannelDBFixture(t, db, 4101, "default", normalized, "k1")

	ch, err := GetChannel("default", requested, "", nil)
	require.NoError(t, err)
	require.NotNil(t, ch)
	assert.Equal(t, 4101, ch.Id)
}

func TestGetChannelDBPrefersReadyKeyWithinPriority(t *testing.T) {
	db := setupChannelDB(t, logger.Default.LogMode(logger.Silent))
	createChannelDBFixture(t, db, 4201, "default", "gpt-x", "k1")
	createChannelDBFixture(t, db, 4202, "default", "gpt-x", "k2")
	MarkChannelKeyCooldown(4201, 0, 30)

	for range 20 {
		ch, err := GetChannel("default", "gpt-x", "", nil)
		require.NoError(t, err)
		require.NotNil(t, ch)
		assert.Equal(t, 4202, ch.Id)
	}

	MarkChannelKeyCooldown(4202, 0, 30)
	ch, err := GetChannel("default", "gpt-x", "", nil)
	require.NoError(t, err)
	require.NotNil(t, ch, "all-cooling must fall back instead of denying service")
}

type countingLogger struct {
	logger.Interface
	queries int
}

func (l *countingLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	l.queries++
	l.Interface.Trace(ctx, begin, fc, err)
}

func TestCountAvailableChannelsDBBatchesChannelLookup(t *testing.T) {
	counter := &countingLogger{Interface: logger.Default.LogMode(logger.Silent)}
	db := setupChannelDB(t, counter)
	createChannelDBFixture(t, db, 4301, "default", "gpt-x", "k1\nk2")
	createChannelDBFixture(t, db, 4302, "default", "gpt-x", "k3")
	var first Channel
	require.NoError(t, db.First(&first, 4301).Error)
	first.ChannelInfo.IsMultiKey = true
	require.NoError(t, db.Model(&first).Update("channel_info", first.ChannelInfo).Error)

	counter.queries = 0
	assert.Equal(t, 3, CountAvailableChannels("default", "gpt-x", ""))
	assert.LessOrEqual(t, counter.queries, 3, "ability/filter/channel count must stay batched")
}
