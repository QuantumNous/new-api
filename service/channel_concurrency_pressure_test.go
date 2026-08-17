package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func useCountingRedisChannelConcurrencyForTest(t *testing.T) (*redisCommandCounterHook, *miniredis.Miniredis, func()) {
	t.Helper()
	mr := miniredis.RunT(t)
	hook := &redisCommandCounterHook{}
	prevRDB := common.RDB
	prevRedisEnabled := common.RedisEnabled
	common.RDB = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	common.RDB.AddHook(hook)
	common.RedisEnabled = true
	return hook, mr, func() {
		_ = common.RDB.Close()
		common.RDB = prevRDB
		common.RedisEnabled = prevRedisEnabled
		mr.Close()
		resetChannelConcurrencyForTest()
	}
}

func countRedisCommands(commands []string, name string) int {
	count := 0
	for _, command := range commands {
		if command == name {
			count++
		}
	}
	return count
}

func TestChannelConcurrencyLoadCacheServesRepeatReadsWithoutRedis(t *testing.T) {
	resetChannelConcurrencyForTest()
	hook, _, restore := useCountingRedisChannelConcurrencyForTest(t)
	defer restore()
	restoreSetting := useChannelConcurrencySettingForTest(t, operation_setting.ChannelConcurrencySetting{
		SlotTTLMinutes:   1,
		WaitEnabled:      true,
		WaitTimeoutMS:    5000,
		WaitIntervalMS:   100,
		CooldownEnabled:  true,
		CooldownSeconds:  30,
		LoadCacheEnabled: true,
		LoadCacheTTLMS:   1000,
	})
	defer restoreSetting()

	channels := []*model.Channel{
		{Id: 401, MaxConcurrency: 4},
		{Id: 402, MaxConcurrency: 2},
	}

	_, err := GetChannelConcurrencyLoads(context.Background(), channels)
	require.NoError(t, err)
	commandsAfterFirst := len(hook.Commands())
	require.Greater(t, commandsAfterFirst, 0)

	for i := 0; i < 5; i++ {
		loads, err := GetChannelConcurrencyLoads(context.Background(), channels)
		require.NoError(t, err)
		require.Len(t, loads, 2)
	}
	require.Equal(t, commandsAfterFirst, len(hook.Commands()),
		"cached reads must not touch Redis inside the TTL window")
}

func TestChannelConcurrencyLoadCacheDisabledReadsRedisEveryTime(t *testing.T) {
	resetChannelConcurrencyForTest()
	hook, _, restore := useCountingRedisChannelConcurrencyForTest(t)
	defer restore()
	restoreSetting := useChannelConcurrencySettingForTest(t, operation_setting.ChannelConcurrencySetting{
		SlotTTLMinutes:   1,
		WaitEnabled:      true,
		WaitTimeoutMS:    5000,
		WaitIntervalMS:   100,
		CooldownEnabled:  true,
		CooldownSeconds:  30,
		LoadCacheEnabled: false,
	})
	defer restoreSetting()

	channels := []*model.Channel{{Id: 403, MaxConcurrency: 4}}

	_, err := GetChannelConcurrencyLoads(context.Background(), channels)
	require.NoError(t, err)
	first := len(hook.Commands())

	_, err = GetChannelConcurrencyLoads(context.Background(), channels)
	require.NoError(t, err)
	require.Greater(t, len(hook.Commands()), first)
}

func TestChannelConcurrencyLoadSingleflightCoalescesConcurrentMisses(t *testing.T) {
	resetChannelConcurrencyForTest()
	hook, _, restore := useCountingRedisChannelConcurrencyForTest(t)
	defer restore()
	restoreSetting := useChannelConcurrencySettingForTest(t, operation_setting.ChannelConcurrencySetting{
		SlotTTLMinutes:   1,
		WaitEnabled:      true,
		WaitTimeoutMS:    5000,
		WaitIntervalMS:   100,
		CooldownEnabled:  true,
		CooldownSeconds:  30,
		LoadCacheEnabled: true,
		LoadCacheTTLMS:   1000,
	})
	defer restoreSetting()

	channels := []*model.Channel{{Id: 404, MaxConcurrency: 4}}

	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			loads, err := GetChannelConcurrencyLoads(context.Background(), channels)
			require.NoError(t, err)
			require.Len(t, loads, 1)
		}()
	}
	wg.Wait()

	// 16 concurrent callers over one candidate set must collapse into one
	// TIME call (one fetch), not sixteen.
	require.Equal(t, 1, countRedisCommands(hook.Commands(), "time"))
}

func TestChannelConcurrencyLoadFetchSplitsLargeCandidateSetsIntoBatches(t *testing.T) {
	resetChannelConcurrencyForTest()
	hook, _, restore := useCountingRedisChannelConcurrencyForTest(t)
	defer restore()
	restoreSetting := useChannelConcurrencySettingForTest(t, operation_setting.ChannelConcurrencySetting{
		SlotTTLMinutes:   1,
		WaitEnabled:      true,
		WaitTimeoutMS:    5000,
		WaitIntervalMS:   100,
		CooldownEnabled:  true,
		CooldownSeconds:  30,
		LoadCacheEnabled: false,
	})
	defer restoreSetting()

	channels := make([]*model.Channel, 0, 125)
	for i := 0; i < 125; i++ {
		channels = append(channels, &model.Channel{Id: 1000 + i, MaxConcurrency: 2})
	}

	loads, err := GetChannelConcurrencyLoads(context.Background(), channels)
	require.NoError(t, err)
	require.Len(t, loads, 125, "batching must not drop channels from selection")

	commands := hook.Commands()
	// One TIME, then per channel: ZREMRANGEBYSCORE + ZCARD + GET + EXISTS.
	require.Equal(t, 1, countRedisCommands(commands, "time"))
	require.Equal(t, 125, countRedisCommands(commands, "zcard"))
}

func TestTryAcquireChannelConcurrencyCooldownRejectedInSingleRoundTrip(t *testing.T) {
	resetChannelConcurrencyForTest()
	hook, _, restore := useCountingRedisChannelConcurrencyForTest(t)
	defer restore()

	channel := &model.Channel{Id: 405, MaxConcurrency: 2}
	ctx := context.Background()

	// Warm the script cache so the count below reflects steady state, not the
	// one-time EVALSHA→NOSCRIPT→EVAL script upload.
	warmupLease, ok, err := TryAcquireChannelConcurrency(ctx, &model.Channel{Id: 999, MaxConcurrency: 2})
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, ReleaseChannelConcurrency(ctx, warmupLease))

	require.NoError(t, MarkChannelConcurrencyCooldown(ctx, channel.Id, time.Minute, "test cooldown"))

	before := len(hook.Commands())
	lease, ok, err := TryAcquireChannelConcurrency(ctx, channel)
	require.NoError(t, err)
	require.False(t, ok)
	require.Nil(t, lease)

	// Cooldown check runs inside the acquire script: exactly one EVAL(SHA),
	// no separate EXISTS round trip.
	commands := hook.Commands()[before:]
	evalCount := countRedisCommands(commands, "eval") + countRedisCommands(commands, "evalsha")
	require.Equal(t, 1, evalCount)
	require.Equal(t, 0, countRedisCommands(commands, "exists"))
}

func TestAcquireChannelConcurrencyWaitRegistrationAtomicUnderBurst(t *testing.T) {
	resetChannelConcurrencyForTest()
	_, mr, restore := useCountingRedisChannelConcurrencyForTest(t)
	defer restore()

	const maxWaiting = 3
	var registeredCount int
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, registered, err := acquireChannelConcurrencyWaiting(context.Background(), 406, maxWaiting)
			require.NoError(t, err)
			if registered {
				mu.Lock()
				registeredCount++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()

	require.Equal(t, maxWaiting, registeredCount,
		"a waiter burst must never overshoot the queue bound")
	value, err := common.RDB.Get(context.Background(), channelConcurrencyWaitingRedisKey(406)).Int()
	require.NoError(t, err)
	require.Equal(t, maxWaiting, value)
	require.True(t, mr.Exists(channelConcurrencyWaitingRedisKey(406)))
}

func TestChannelSelectionAcquireBudgetFallsBackToWaitCandidate(t *testing.T) {
	resetChannelConcurrencyForTest()
	restoreRedis := useMemoryChannelConcurrencyForTest(t)
	defer restoreRedis()
	restoreDB := useChannelSelectionDBForTest(t)
	defer restoreDB()
	restoreSetting := useChannelConcurrencySettingForTest(t, operation_setting.ChannelConcurrencySetting{
		SlotTTLMinutes:       1,
		WaitEnabled:          true,
		WaitTimeoutMS:        500,
		WaitIntervalMS:       10,
		MaxWaitingPerChannel: 5,
		CooldownEnabled:      true,
		CooldownSeconds:      30,
		MaxAcquireAttempts:   2,
	})
	defer restoreSetting()

	priority := int64(0)
	weight := uint(100)
	leases := make([]*ChannelConcurrencyLease, 0, 4)
	for i := 0; i < 4; i++ {
		channel := &model.Channel{
			Id:             501 + i,
			Type:           1,
			Key:            "sk-budget",
			Status:         common.ChannelStatusEnabled,
			Name:           "budget-channel",
			Group:          "default",
			Models:         "gpt-budget",
			Priority:       &priority,
			Weight:         &weight,
			MaxConcurrency: 1,
		}
		require.NoError(t, model.DB.Create(channel).Error)
		require.NoError(t, channel.AddAbilities(nil))
		lease, ok, err := TryAcquireChannelConcurrency(context.Background(), channel)
		require.NoError(t, err)
		require.True(t, ok)
		leases = append(leases, lease)
	}
	model.InitChannelCache()

	// Free every slot shortly after selection enters the wait path (the wait
	// candidate is weight-random among equally loaded channels); with the
	// acquire budget at 2, selection must still recover via waiting instead
	// of erroring out.
	go func() {
		time.Sleep(50 * time.Millisecond)
		for _, lease := range leases {
			_ = ReleaseChannelConcurrency(context.Background(), lease)
		}
	}()

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(nil)
	retry := 0
	selected, _, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        c,
		TokenGroup: "default",
		ModelName:  "gpt-budget",
		Retry:      &retry,
	})
	defer ReleaseChannelConcurrencyForContext(c)

	require.NoError(t, err)
	require.NotNil(t, selected)
}

func TestWithChannelConcurrencyJitterStaysWithinBounds(t *testing.T) {
	interval := 100 * time.Millisecond
	for i := 0; i < 200; i++ {
		jittered := withChannelConcurrencyJitter(interval)
		require.GreaterOrEqual(t, jittered, interval/2)
		require.Less(t, jittered, interval)
	}
}

func TestOrderCandidatesRefreshesWhenCachedCooldownFiltersEveryone(t *testing.T) {
	resetChannelConcurrencyForTest()
	_, mr, restore := useCountingRedisChannelConcurrencyForTest(t)
	defer restore()
	restoreSetting := useChannelConcurrencySettingForTest(t, operation_setting.ChannelConcurrencySetting{
		SlotTTLMinutes:   1,
		WaitEnabled:      true,
		WaitTimeoutMS:    5000,
		WaitIntervalMS:   100,
		CooldownEnabled:  true,
		CooldownSeconds:  30,
		LoadCacheEnabled: true,
		LoadCacheTTLMS:   5000,
	})
	defer restoreSetting()

	channel := &model.Channel{Id: 601, MaxConcurrency: 2}
	candidates := []*model.Channel{channel}
	ctx := context.Background()

	// Populate the snapshot cache while the channel is cooling down.
	require.NoError(t, MarkChannelConcurrencyCooldown(ctx, channel.Id, time.Minute, "test"))
	ordered, err := orderChannelCandidatesByConcurrencyLoad(nil, candidates)
	require.NoError(t, err)
	require.Empty(t, ordered)

	// Cooldown expires inside the cache window; the stale cached CoolingDown
	// flag must trigger one fresh re-read instead of filtering the recovered
	// channel for the rest of the TTL.
	mr.Del(channelConcurrencyCooldownRedisKey(channel.Id))
	ordered, err = orderChannelCandidatesByConcurrencyLoad(nil, candidates)
	require.NoError(t, err)
	require.Len(t, ordered, 1)
	require.Equal(t, channel.Id, ordered[0].Id)
}

func TestFetchLoadsDegradesWhenFetchSlotsSaturated(t *testing.T) {
	resetChannelConcurrencyForTest()
	_, _, restore := useCountingRedisChannelConcurrencyForTest(t)
	defer restore()
	restoreSetting := useChannelConcurrencySettingForTest(t, operation_setting.ChannelConcurrencySetting{
		SlotTTLMinutes:   1,
		WaitEnabled:      true,
		WaitTimeoutMS:    5000,
		WaitIntervalMS:   100,
		CooldownEnabled:  true,
		CooldownSeconds:  30,
		LoadCacheEnabled: false,
	})
	defer restoreSetting()

	prevTimeout := channelConcurrencyLoadFetchTimeout
	channelConcurrencyLoadFetchTimeout = 50 * time.Millisecond
	t.Cleanup(func() { channelConcurrencyLoadFetchTimeout = prevTimeout })

	// Occupy every fetch slot so the next fetch cannot start.
	for i := 0; i < cap(channelConcurrencyLoadFetchSlots); i++ {
		channelConcurrencyLoadFetchSlots <- struct{}{}
	}
	t.Cleanup(func() {
		for i := 0; i < cap(channelConcurrencyLoadFetchSlots); i++ {
			<-channelConcurrencyLoadFetchSlots
		}
	})

	// GetChannelConcurrencyLoads must degrade to the memory fallback (loads
	// with zero counters) rather than block indefinitely or error out.
	loads, err := GetChannelConcurrencyLoads(context.Background(), []*model.Channel{{Id: 602, MaxConcurrency: 3}})
	require.NoError(t, err)
	require.Equal(t, 3, loads[602].MaxConcurrency)
	require.Equal(t, 0, loads[602].Active)
}
