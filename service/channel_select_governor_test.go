package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func ensureGovernorSelectionSchema(t *testing.T) {
	t.Helper()
	// Some existing service package tests migrate only a subset of tables.
	// These governor selection tests require the abilities table.
	require.NoError(t, model.DB.AutoMigrate(&model.Ability{}))
}

func truncateGovernorSelectionTables(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM abilities")
		model.DB.Exec("DELETE FROM channels")
	})
}

func seedGovernorSelectionChannels(t *testing.T) (int, int) {
	t.Helper()
	ensureGovernorSelectionSchema(t)
	truncateGovernorSelectionTables(t)

	// Make selection heavily prefer the first channel when filtering is missing,
	// while still keeping both channels eligible for the same model/group/priority.
	highWeight := common.GetPointer(uint(1000000))
	zeroWeight := common.GetPointer(uint(0))

	ch1 := &model.Channel{
		Name:   "first",
		Key:    "k1",
		Models: "gpt-4o",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
		Weight: highWeight,
	}
	ch2 := &model.Channel{
		Name:   "second",
		Key:    "k2",
		Models: "gpt-4o",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
		Weight: zeroWeight,
	}
	require.NoError(t, model.DB.Create(ch1).Error)
	require.NoError(t, ch1.AddAbilities(nil))
	require.NoError(t, model.DB.Create(ch2).Error)
	require.NoError(t, ch2.AddAbilities(nil))
	return ch1.Id, ch2.Id
}

func TestCacheGetRandomSatisfiedChannel_SkipsExcludedChannels(t *testing.T) {
	firstID, secondID := seedGovernorSelectionChannels(t)
	old := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() { common.MemoryCacheEnabled = old })

	model.InitChannelCache()

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)

	param := &RetryParam{
		Ctx:        ctx,
		TokenGroup: "default",
		ModelName:  "gpt-4o",
		Retry:      common.GetPointer(0),
		ExcludedChannelIDs: map[int]struct{}{
			firstID: {},
		},
	}

	// Run multiple times to avoid any chance of an unfiltered selector passing by luck.
	for i := 0; i < 10; i++ {
		channel, _, err := CacheGetRandomSatisfiedChannel(param)
		require.NoError(t, err)
		require.NotNil(t, channel)
		require.Equal(t, secondID, channel.Id)
	}
}

func TestCacheGetRandomSatisfiedChannel_SkipsExcludedChannelsWithoutMemoryCache(t *testing.T) {
	firstID, secondID := seedGovernorSelectionChannels(t)
	old := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = old })

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)

	param := &RetryParam{
		Ctx:        ctx,
		TokenGroup: "default",
		ModelName:  "gpt-4o",
		Retry:      common.GetPointer(0),
		ExcludedChannelIDs: map[int]struct{}{
			firstID: {},
		},
	}

	for i := 0; i < 10; i++ {
		channel, _, err := CacheGetRandomSatisfiedChannel(param)
		require.NoError(t, err)
		require.NotNil(t, channel)
		require.Equal(t, secondID, channel.Id)
	}
}

