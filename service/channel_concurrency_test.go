package service

import (
	"context"
	"errors"
	"math/rand"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestTryAcquireChannelConcurrencyMemoryLimit(t *testing.T) {
	resetChannelConcurrencyForTest()
	restore := useMemoryChannelConcurrencyForTest(t)
	defer restore()

	channel := &model.Channel{Id: 101, MaxConcurrency: 1}
	ctx := context.Background()

	lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, lease)

	secondLease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.False(t, ok)
	require.Nil(t, secondLease)

	require.NoError(t, ReleaseChannelConcurrency(ctx, lease))

	lease, ok, err = TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, lease)
	require.NoError(t, ReleaseChannelConcurrency(ctx, lease))
}

func TestTryAcquireChannelConcurrencyUnlimitedDoesNotAllocateLease(t *testing.T) {
	resetChannelConcurrencyForTest()
	restore := useMemoryChannelConcurrencyForTest(t)
	defer restore()

	channel := &model.Channel{Id: 102, MaxConcurrency: 0}
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
		require.NoError(t, err)
		require.True(t, ok)
		require.Nil(t, lease)
	}
}

func TestTryAcquireChannelConcurrencyRedisLimit(t *testing.T) {
	resetChannelConcurrencyForTest()
	restore := useRedisChannelConcurrencyForTest(t)
	defer restore()

	channel := &model.Channel{Id: 103, MaxConcurrency: 1}
	ctx := context.Background()

	lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, lease)

	secondLease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.False(t, ok)
	require.Nil(t, secondLease)

	require.NoError(t, ReleaseChannelConcurrency(ctx, lease))

	lease, ok, err = TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, lease)
	require.NoError(t, ReleaseChannelConcurrency(ctx, lease))
}

func TestTryAcquireChannelConcurrencyRedisRefreshesSameRequest(t *testing.T) {
	resetChannelConcurrencyForTest()
	restore := useRedisChannelConcurrencyForTest(t)
	defer restore()

	channel := &model.Channel{Id: 104, MaxConcurrency: 1}
	ctx := context.Background()
	token := "test-process:test-request"

	lease, ok, err := tryAcquireChannelConcurrencyWithToken(ctx, channel, token)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, lease)

	refreshedLease, ok, err := tryAcquireChannelConcurrencyWithToken(ctx, channel, token)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, refreshedLease)

	blockedLease, ok, err := tryAcquireChannelConcurrencyWithToken(ctx, channel, "test-process:other-request")
	require.NoError(t, err)
	require.False(t, ok)
	require.Nil(t, blockedLease)

	require.NoError(t, ReleaseChannelConcurrency(ctx, refreshedLease))
	leaseAfterRelease, ok, err := tryAcquireChannelConcurrencyWithToken(ctx, channel, "test-process:after-release")
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, leaseAfterRelease)
	require.NoError(t, ReleaseChannelConcurrency(ctx, leaseAfterRelease))
}

func TestChannelConcurrencyLoadsIncludeActiveWaitingAndCooldown(t *testing.T) {
	resetChannelConcurrencyForTest()
	restore := useRedisChannelConcurrencyForTest(t)
	defer restore()

	channel := &model.Channel{Id: 105, MaxConcurrency: 4}
	ctx := context.Background()

	lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, lease)
	defer func() {
		require.NoError(t, ReleaseChannelConcurrency(ctx, lease))
	}()

	waiting, err := incrementChannelConcurrencyWaiting(ctx, channel.Id, channel.GetMaxConcurrency())
	require.NoError(t, err)
	require.Equal(t, 1, waiting)
	t.Cleanup(func() {
		require.NoError(t, decrementChannelConcurrencyWaiting(ctx, channel.Id))
	})

	require.NoError(t, MarkChannelConcurrencyCooldown(ctx, channel.Id, time.Second, "test cooldown"))

	loads, err := GetChannelConcurrencyLoads(ctx, []*model.Channel{channel})
	require.NoError(t, err)

	load := loads[channel.Id]
	require.Equal(t, channel.Id, load.ChannelID)
	require.Equal(t, 4, load.MaxConcurrency)
	require.Equal(t, 1, load.Active)
	require.Equal(t, 1, load.Waiting)
	require.True(t, load.CoolingDown)
	require.InDelta(t, 0.5, load.LoadRate, 0.001)
}

func TestTryAcquireChannelConcurrencySkipsCoolingDownChannel(t *testing.T) {
	resetChannelConcurrencyForTest()
	restore := useMemoryChannelConcurrencyForTest(t)
	defer restore()

	channel := &model.Channel{Id: 110, MaxConcurrency: 1}
	ctx := context.Background()

	require.NoError(t, MarkChannelConcurrencyCooldown(ctx, channel.Id, time.Second, "test cooldown"))

	lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.False(t, ok)
	require.Nil(t, lease)
}

func TestTryAcquireChannelConcurrencyFallsBackToMemoryWhenRedisFails(t *testing.T) {
	resetChannelConcurrencyForTest()
	restore := useFailingRedisChannelConcurrencyForTest(t)
	defer restore()

	channel := &model.Channel{Id: 106, MaxConcurrency: 1}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.Error(t, err)
	require.False(t, ok)
	require.Nil(t, lease)
}

func TestChannelConcurrencyAcquireScriptUsesRedisTime(t *testing.T) {
	require.Contains(t, channelConcurrencyAcquireScriptSrc, "redis.call('TIME')")
}

func TestRedisChannelConcurrencyLeaseRenewsWhileHeld(t *testing.T) {
	resetChannelConcurrencyForTest()
	mr := miniredis.RunT(t)
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
		mr.Close()
		resetChannelConcurrencyForTest()
	})
	restoreSetting := useChannelConcurrencySettingForTest(t, operation_setting.ChannelConcurrencySetting{
		SlotTTLMinutes:       1,
		WaitEnabled:          true,
		WaitTimeoutMS:        5000,
		WaitIntervalMS:       100,
		CooldownEnabled:      true,
		CooldownSeconds:      30,
		MaxWaitingPerChannel: 1,
	})
	defer restoreSetting()
	previousRenewInterval := channelConcurrencyRenewInterval
	channelConcurrencyRenewInterval = func(time.Duration) time.Duration {
		return 5 * time.Millisecond
	}
	t.Cleanup(func() {
		channelConcurrencyRenewInterval = previousRenewInterval
	})

	channel := &model.Channel{Id: 111, MaxConcurrency: 1}
	lease, ok, err := TryAcquireChannelConcurrency(context.Background(), channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, lease)
	t.Cleanup(func() {
		_ = ReleaseChannelConcurrency(context.Background(), lease)
	})

	key := channelConcurrencyRedisKey(channel.Id)
	initialScore, err := common.RDB.ZScore(context.Background(), key, lease.token).Result()
	require.NoError(t, err)

	mr.FastForward(30 * time.Second)
	require.Eventually(t, func() bool {
		renewedScore, scoreErr := common.RDB.ZScore(context.Background(), key, lease.token).Result()
		return scoreErr == nil && renewedScore > initialScore
	}, time.Second, 10*time.Millisecond)
}

func TestAcquireChannelConcurrencyWithWaitAcquiresAfterRelease(t *testing.T) {
	resetChannelConcurrencyForTest()
	restoreRedis := useMemoryChannelConcurrencyForTest(t)
	defer restoreRedis()
	restoreSetting := useChannelConcurrencyWaitSettingForTest(t, 500*time.Millisecond, 10*time.Millisecond, 1)
	defer restoreSetting()

	channel := &model.Channel{Id: 107, MaxConcurrency: 1}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	heldLease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, heldLease)

	go func() {
		time.Sleep(50 * time.Millisecond)
		_ = ReleaseChannelConcurrency(context.Background(), heldLease)
	}()

	lease, ok, err := AcquireChannelConcurrencyWithWait(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, lease)
	require.NoError(t, ReleaseChannelConcurrency(ctx, lease))
}

func TestAcquireChannelConcurrencyWithWaitReturnsFullWhenQueueFull(t *testing.T) {
	resetChannelConcurrencyForTest()
	restoreRedis := useMemoryChannelConcurrencyForTest(t)
	defer restoreRedis()
	restoreSetting := useChannelConcurrencyWaitSettingForTest(t, 200*time.Millisecond, 10*time.Millisecond, 1)
	defer restoreSetting()

	channel := &model.Channel{Id: 108, MaxConcurrency: 1}
	ctx := context.Background()

	heldLease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, heldLease)
	defer func() {
		require.NoError(t, ReleaseChannelConcurrency(ctx, heldLease))
	}()

	waiting, err := incrementChannelConcurrencyWaiting(ctx, channel.Id, channel.GetMaxConcurrency())
	require.NoError(t, err)
	require.Equal(t, 1, waiting)
	defer func() {
		require.NoError(t, decrementChannelConcurrencyWaiting(ctx, channel.Id))
	}()

	lease, ok, err := AcquireChannelConcurrencyWithWait(ctx, channel)
	require.ErrorIs(t, err, ErrChannelConcurrencyLimit)
	require.False(t, ok)
	require.Nil(t, lease)
}

func TestAcquireChannelConcurrencyWithWaitTimeoutDecrementsWaiting(t *testing.T) {
	resetChannelConcurrencyForTest()
	restoreRedis := useMemoryChannelConcurrencyForTest(t)
	defer restoreRedis()
	restoreSetting := useChannelConcurrencyWaitSettingForTest(t, 30*time.Millisecond, 5*time.Millisecond, 2)
	defer restoreSetting()

	channel := &model.Channel{Id: 109, MaxConcurrency: 1}
	ctx := context.Background()

	heldLease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, heldLease)
	defer func() {
		require.NoError(t, ReleaseChannelConcurrency(ctx, heldLease))
	}()

	lease, ok, err := AcquireChannelConcurrencyWithWait(ctx, channel)
	require.True(t, errors.Is(err, ErrChannelConcurrencyLimit))
	require.False(t, ok)
	require.Nil(t, lease)

	loads, err := GetChannelConcurrencyLoads(ctx, []*model.Channel{channel})
	require.NoError(t, err)
	require.Equal(t, 1, loads[channel.Id].Active)
	require.Equal(t, 0, loads[channel.Id].Waiting)
}

func TestCacheGetRandomSatisfiedChannelPrefersLowerLoadChannel(t *testing.T) {
	resetChannelConcurrencyForTest()
	restoreRedis := useMemoryChannelConcurrencyForTest(t)
	defer restoreRedis()
	restoreDB := useChannelSelectionDBForTest(t)
	defer restoreDB()
	restoreSetting := useChannelConcurrencyWaitSettingForTest(t, 50*time.Millisecond, 5*time.Millisecond, 1)
	defer restoreSetting()

	rand.Seed(1)

	priority := int64(0)
	loadedWeight := uint(1_000_000)
	lowWeight := uint(1)

	loadedChannel := &model.Channel{
		Id:             301,
		Type:           1,
		Key:            "sk-loaded",
		Status:         common.ChannelStatusEnabled,
		Name:           "loaded-channel",
		Group:          "default",
		Models:         "gpt-load",
		Priority:       &priority,
		Weight:         &loadedWeight,
		MaxConcurrency: 2,
	}
	lowLoadChannel := &model.Channel{
		Id:             302,
		Type:           1,
		Key:            "sk-low",
		Status:         common.ChannelStatusEnabled,
		Name:           "low-load-channel",
		Group:          "default",
		Models:         "gpt-load",
		Priority:       &priority,
		Weight:         &lowWeight,
		MaxConcurrency: 2,
	}
	require.NoError(t, model.DB.Create(loadedChannel).Error)
	require.NoError(t, loadedChannel.AddAbilities(nil))
	require.NoError(t, model.DB.Create(lowLoadChannel).Error)
	require.NoError(t, lowLoadChannel.AddAbilities(nil))
	model.InitChannelCache()

	heldLease, ok, err := TryAcquireChannelConcurrency(context.Background(), loadedChannel)
	require.NoError(t, err)
	require.True(t, ok)
	defer func() {
		require.NoError(t, ReleaseChannelConcurrency(context.Background(), heldLease))
	}()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	selected, selectedGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "gpt-load",
		Retry:      &retry,
	})
	defer ReleaseChannelConcurrencyForContext(c)

	require.NoError(t, err)
	require.Equal(t, "default", selectedGroup)
	require.NotNil(t, selected)
	require.Equal(t, lowLoadChannel.Id, selected.Id)
}

func TestCacheGetRandomSatisfiedChannelSkipsCoolingDownChannel(t *testing.T) {
	resetChannelConcurrencyForTest()
	restoreRedis := useMemoryChannelConcurrencyForTest(t)
	defer restoreRedis()
	restoreDB := useChannelSelectionDBForTest(t)
	defer restoreDB()

	rand.Seed(1)

	priority := int64(0)
	coolingWeight := uint(1_000_000)
	fallbackWeight := uint(1)

	coolingChannel := &model.Channel{
		Id:             303,
		Type:           1,
		Key:            "sk-cooling",
		Status:         common.ChannelStatusEnabled,
		Name:           "cooling-channel",
		Group:          "default",
		Models:         "gpt-cooldown",
		Priority:       &priority,
		Weight:         &coolingWeight,
		MaxConcurrency: 2,
	}
	fallbackChannel := &model.Channel{
		Id:             304,
		Type:           1,
		Key:            "sk-fallback",
		Status:         common.ChannelStatusEnabled,
		Name:           "fallback-channel",
		Group:          "default",
		Models:         "gpt-cooldown",
		Priority:       &priority,
		Weight:         &fallbackWeight,
		MaxConcurrency: 2,
	}
	require.NoError(t, model.DB.Create(coolingChannel).Error)
	require.NoError(t, coolingChannel.AddAbilities(nil))
	require.NoError(t, model.DB.Create(fallbackChannel).Error)
	require.NoError(t, fallbackChannel.AddAbilities(nil))
	model.InitChannelCache()
	require.NoError(t, MarkChannelConcurrencyCooldown(context.Background(), coolingChannel.Id, time.Second, "test cooldown"))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	selected, selectedGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "gpt-cooldown",
		Retry:      &retry,
	})
	defer ReleaseChannelConcurrencyForContext(c)

	require.NoError(t, err)
	require.Equal(t, "default", selectedGroup)
	require.NotNil(t, selected)
	require.Equal(t, fallbackChannel.Id, selected.Id)
}

func TestCacheGetRandomSatisfiedChannelSkipsFullChannels(t *testing.T) {
	resetChannelConcurrencyForTest()
	restoreRedis := useMemoryChannelConcurrencyForTest(t)
	defer restoreRedis()
	restoreDB := useChannelSelectionDBForTest(t)
	defer restoreDB()

	highPriority := int64(10)
	lowPriority := int64(0)
	weight := uint(100)

	fullChannel := &model.Channel{
		Id:             201,
		Type:           1,
		Key:            "sk-full",
		Status:         common.ChannelStatusEnabled,
		Name:           "full-channel",
		Group:          "default",
		Models:         "gpt-test",
		Priority:       &highPriority,
		Weight:         &weight,
		MaxConcurrency: 1,
	}
	fallbackChannel := &model.Channel{
		Id:             202,
		Type:           1,
		Key:            "sk-fallback",
		Status:         common.ChannelStatusEnabled,
		Name:           "fallback-channel",
		Group:          "default",
		Models:         "gpt-test",
		Priority:       &lowPriority,
		Weight:         &weight,
		MaxConcurrency: 1,
	}

	require.NoError(t, model.DB.Create(fullChannel).Error)
	require.NoError(t, fullChannel.AddAbilities(nil))
	require.NoError(t, model.DB.Create(fallbackChannel).Error)
	require.NoError(t, fallbackChannel.AddAbilities(nil))
	model.InitChannelCache()

	heldLease, ok, err := TryAcquireChannelConcurrency(context.Background(), fullChannel)
	require.NoError(t, err)
	require.True(t, ok)
	defer func() {
		require.NoError(t, ReleaseChannelConcurrency(context.Background(), heldLease))
	}()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	retry := 0
	selected, selectedGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "gpt-test",
		Retry:      &retry,
	})
	defer ReleaseChannelConcurrencyForContext(c)

	require.NoError(t, err)
	require.Equal(t, "default", selectedGroup)
	require.NotNil(t, selected)
	require.Equal(t, fallbackChannel.Id, selected.Id)
}

func useMemoryChannelConcurrencyForTest(t *testing.T) func() {
	t.Helper()
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = nil
	common.RedisEnabled = false
	return func() {
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
		resetChannelConcurrencyForTest()
	}
}

func useRedisChannelConcurrencyForTest(t *testing.T) func() {
	t.Helper()
	mr := miniredis.RunT(t)
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RedisEnabled = true
	return func() {
		_ = common.RDB.Close()
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
		mr.Close()
		resetChannelConcurrencyForTest()
	}
}

func useFailingRedisChannelConcurrencyForTest(t *testing.T) func() {
	t.Helper()
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{
		Addr:        "127.0.0.1:1",
		DialTimeout: 50 * time.Millisecond,
		ReadTimeout: 50 * time.Millisecond,
	})
	common.RedisEnabled = true
	return func() {
		_ = common.RDB.Close()
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
		resetChannelConcurrencyForTest()
	}
}

func useChannelConcurrencyWaitSettingForTest(t *testing.T, timeout time.Duration, interval time.Duration, maxWaiting int) func() {
	t.Helper()
	setting := operation_setting.GetChannelConcurrencySetting()
	original := setting
	setting.WaitEnabled = true
	setting.WaitTimeoutMS = int(timeout / time.Millisecond)
	setting.WaitIntervalMS = int(interval / time.Millisecond)
	setting.MaxWaitingPerChannel = maxWaiting
	setting.CooldownEnabled = true
	operation_setting.SetChannelConcurrencySettingForTest(setting)
	return func() {
		operation_setting.SetChannelConcurrencySettingForTest(original)
	}
}

func useChannelConcurrencySettingForTest(t *testing.T, setting operation_setting.ChannelConcurrencySetting) func() {
	t.Helper()
	original := operation_setting.GetChannelConcurrencySetting()
	operation_setting.SetChannelConcurrencySettingForTest(setting)
	return func() {
		operation_setting.SetChannelConcurrencySettingForTest(original)
	}
}

func useChannelSelectionDBForTest(t *testing.T) func() {
	t.Helper()
	prevDB := model.DB
	prevMemoryCacheEnabled := common.MemoryCacheEnabled
	prevUsingSQLite := common.UsingSQLite
	prevUsingMySQL := common.UsingMySQL
	prevUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	return func() {
		model.DB = prevDB
		common.MemoryCacheEnabled = prevMemoryCacheEnabled
		common.UsingSQLite = prevUsingSQLite
		common.UsingMySQL = prevUsingMySQL
		common.UsingPostgreSQL = prevUsingPostgreSQL
	}
}
