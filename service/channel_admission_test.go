package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func newMemoryChannelAdmissionManager(now func() time.Time) *channelAdmissionManager {
	return &channelAdmissionManager{
		redisClient:  func() *redis.Client { return nil },
		redisEnabled: func() bool { return false },
		now:          now,
		leaseTTL:     channelAdmissionLeaseTTL,
		rpmWindow:    channelAdmissionRPMWindow,
		renewLeases:  false,
	}
}

func newRedisChannelAdmissionManager(client *redis.Client, leaseTTL time.Duration) *channelAdmissionManager {
	return &channelAdmissionManager{
		redisClient:  func() *redis.Client { return client },
		redisEnabled: func() bool { return true },
		now:          time.Now,
		leaseTTL:     leaseTTL,
		rpmWindow:    channelAdmissionRPMWindow,
		renewLeases:  false,
	}
}

func TestChannelAdmissionMemoryConcurrencyUsesCurrentLimit(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })

	unlimited, decision, err := manager.acquire(context.Background(), 101, 0, 0)
	require.NoError(t, err)
	assert.True(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionModeDisabled, decision.Mode)
	assert.Nil(t, unlimited)

	first, decision, err := manager.acquire(context.Background(), 101, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionModeMemory, decision.Mode)

	_, decision, err = manager.acquire(context.Background(), 101, 1, 0)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonConcurrency, decision.Reason)

	second, decision, err := manager.acquire(context.Background(), 101, 2, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	assert.Equal(t, 2, decision.CurrentConcurrency)

	_, decision, err = manager.acquire(context.Background(), 101, 1, 0)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)

	require.NoError(t, first.Release())
	require.NoError(t, first.Release())
	_, decision, err = manager.acquire(context.Background(), 101, 1, 0)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)

	require.NoError(t, second.Release())
	third, decision, err := manager.acquire(context.Background(), 101, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	require.NoError(t, third.Release())
}

func TestChannelAdmissionMemoryRPMUsesCurrentLimit(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })

	for range 2 {
		lease, decision, err := manager.acquire(context.Background(), 106, 0, 2)
		require.NoError(t, err)
		require.True(t, decision.Allowed)
		lease.Commit()
		require.NoError(t, lease.Release())
	}

	_, decision, err := manager.acquire(context.Background(), 106, 0, 1)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonRPM, decision.Reason)

	third, decision, err := manager.acquire(context.Background(), 106, 0, 3)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	third.Commit()
	require.NoError(t, third.Release())

	unlimited, decision, err := manager.acquire(context.Background(), 106, 0, 0)
	require.NoError(t, err)
	assert.True(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionModeDisabled, decision.Mode)
	assert.Nil(t, unlimited)
}

func TestChannelAdmissionMemoryConcurrentAcquireIsAtomic(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })
	start := make(chan struct{})
	leases := make(chan *ChannelAdmissionLease, 2)
	decisions := make(chan ChannelAdmissionDecision, 2)
	errorsCh := make(chan error, 2)
	var waitGroup sync.WaitGroup

	for range 2 {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-start
			lease, decision, err := manager.acquire(context.Background(), 105, 1, 0)
			errorsCh <- err
			leases <- lease
			decisions <- decision
		}()
	}
	close(start)
	waitGroup.Wait()
	close(leases)
	close(decisions)
	close(errorsCh)

	for err := range errorsCh {
		require.NoError(t, err)
	}
	allowed := 0
	for decision := range decisions {
		if decision.Allowed {
			allowed++
		}
	}
	assert.Equal(t, 1, allowed)
	for lease := range leases {
		if lease != nil {
			require.NoError(t, lease.Release())
		}
	}
}

func TestChannelAdmissionMemoryRPMRollsBackOnlyUnstartedAttempts(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })

	unstarted, decision, err := manager.acquire(context.Background(), 102, 0, 1)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	require.NoError(t, unstarted.Release())

	started, decision, err := manager.acquire(context.Background(), 102, 0, 1)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	started.Commit()
	require.NoError(t, started.Release())

	_, decision, err = manager.acquire(context.Background(), 102, 0, 1)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonRPM, decision.Reason)
	assert.Equal(t, time.Minute, decision.RetryAfter)

	now = now.Add(time.Minute)
	afterWindow, decision, err := manager.acquire(context.Background(), 102, 0, 1)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	require.NoError(t, afterWindow.Release())
}

func TestChannelAdmissionCombinedRejectionDoesNotSpendRPM(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })

	first, decision, err := manager.acquire(context.Background(), 103, 1, 2)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	first.Commit()

	_, decision, err = manager.acquire(context.Background(), 103, 1, 2)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonConcurrency, decision.Reason)
	assert.Equal(t, 1, decision.CurrentRPM)

	require.NoError(t, first.Release())
	second, decision, err := manager.acquire(context.Background(), 103, 1, 2)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	assert.Equal(t, 2, decision.CurrentRPM)
	second.Commit()
	require.NoError(t, second.Release())

	_, decision, err = manager.acquire(context.Background(), 103, 1, 2)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonRPM, decision.Reason)
}

func TestChannelAdmissionRedisFailureUsesMemoryFallback(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := &channelAdmissionManager{
		redisClient:  func() *redis.Client { return nil },
		redisEnabled: func() bool { return true },
		now:          func() time.Time { return now },
		leaseTTL:     channelAdmissionLeaseTTL,
		rpmWindow:    channelAdmissionRPMWindow,
		renewLeases:  false,
	}

	lease, decision, err := manager.acquire(context.Background(), 104, 1, 1)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionModeMemoryFallback, decision.Mode)
	require.NoError(t, lease.Release())
}

func TestChannelAdmissionRedisIsGlobalAcrossClients(t *testing.T) {
	server := miniredis.RunT(t)
	clientA := redis.NewClient(&redis.Options{Addr: server.Addr()})
	clientB := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		_ = clientA.Close()
		_ = clientB.Close()
	})
	managerA := newRedisChannelAdmissionManager(clientA, 10*time.Second)
	managerB := newRedisChannelAdmissionManager(clientB, 10*time.Second)

	first, decision, err := managerA.acquire(context.Background(), 201, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionModeRedis, decision.Mode)

	_, decision, err = managerB.acquire(context.Background(), 201, 1, 0)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonConcurrency, decision.Reason)

	snapshot, err := managerB.snapshot(context.Background(), 201, 1, 0)
	require.NoError(t, err)
	assert.Equal(t, 1, snapshot.CurrentConcurrency)

	first.Commit()
	require.NoError(t, first.Release())
	second, decision, err := managerB.acquire(context.Background(), 201, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	require.NoError(t, second.Release())
}

func TestChannelAdmissionRedisRPMIsGlobalAcrossClients(t *testing.T) {
	server := miniredis.RunT(t)
	baseTime := time.Unix(1_700_000_000, 0)
	server.SetTime(baseTime)
	clientA := redis.NewClient(&redis.Options{Addr: server.Addr()})
	clientB := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		_ = clientA.Close()
		_ = clientB.Close()
	})
	managerA := newRedisChannelAdmissionManager(clientA, 10*time.Second)
	managerB := newRedisChannelAdmissionManager(clientB, 10*time.Second)

	first, decision, err := managerA.acquire(context.Background(), 205, 0, 1)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	first.Commit()
	require.NoError(t, first.Release())

	_, decision, err = managerB.acquire(context.Background(), 205, 0, 1)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonRPM, decision.Reason)
	assert.Equal(t, time.Minute, decision.RetryAfter)

	server.SetTime(baseTime.Add(time.Minute))
	afterWindow, decision, err := managerB.acquire(context.Background(), 205, 0, 1)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	require.NoError(t, afterWindow.Release())
}

func TestChannelAdmissionRedisRPMRollbackAndCommit(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	manager := newRedisChannelAdmissionManager(client, 10*time.Second)

	unstarted, decision, err := manager.acquire(context.Background(), 202, 0, 1)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	require.NoError(t, unstarted.Release())

	started, decision, err := manager.acquire(context.Background(), 202, 0, 1)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	started.Commit()
	require.NoError(t, started.Release())

	_, decision, err = manager.acquire(context.Background(), 202, 0, 1)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonRPM, decision.Reason)
}

func TestChannelAdmissionRedisLeaseExpiresAndRenews(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	manager := newRedisChannelAdmissionManager(client, 2*time.Second)
	baseTime := time.Unix(1_700_000_000, 0)
	server.SetTime(baseTime)

	expiring, decision, err := manager.acquire(context.Background(), 203, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	server.SetTime(baseTime.Add(3 * time.Second))
	replacement, decision, err := manager.acquire(context.Background(), 203, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	require.NoError(t, replacement.Release())

	renewed, decision, err := manager.acquire(context.Background(), 204, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	server.SetTime(baseTime.Add(4500 * time.Millisecond))
	ok, err := renewed.renewRedis()
	require.NoError(t, err)
	require.True(t, ok)
	server.SetTime(baseTime.Add(6 * time.Second))
	_, decision, err = manager.acquire(context.Background(), 204, 1, 0)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	require.NoError(t, renewed.Release())
	require.NoError(t, expiring.Release())
}

func TestAcquireChannelAdmissionReadsUpdatedChannelSettings(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })
	previousManager := defaultChannelAdmissionManager
	defaultChannelAdmissionManager = manager
	t.Cleanup(func() { defaultChannelAdmissionManager = previousManager })

	channel := &model.Channel{Id: 209}
	unlimited, decision, err := AcquireChannelAdmission(context.Background(), channel)
	require.NoError(t, err)
	assert.True(t, decision.Allowed)
	assert.Nil(t, unlimited)

	channel.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
	first, decision, err := AcquireChannelAdmission(context.Background(), channel)
	require.NoError(t, err)
	require.True(t, decision.Allowed)

	channel.SetSetting(dto.ChannelSettings{MaxConcurrency: 2})
	second, decision, err := AcquireChannelAdmission(context.Background(), channel)
	require.NoError(t, err)
	require.True(t, decision.Allowed)

	channel.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
	_, decision, err = AcquireChannelAdmission(context.Background(), channel)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)

	channel.SetSetting(dto.ChannelSettings{})
	unlimited, decision, err = AcquireChannelAdmission(context.Background(), channel)
	require.NoError(t, err)
	assert.True(t, decision.Allowed)
	assert.Nil(t, unlimited)

	require.NoError(t, first.Release())
	require.NoError(t, second.Release())
}

func TestChannelAdmissionMultiKeyChannelSharesOneLimit(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })
	previousManager := defaultChannelAdmissionManager
	defaultChannelAdmissionManager = manager
	t.Cleanup(func() { defaultChannelAdmissionManager = previousManager })

	channel := &model.Channel{
		Id:   206,
		Keys: []string{"first-key", "second-key"},
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 2,
		},
	}
	channel.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})

	first, decision, err := AcquireChannelAdmission(context.Background(), channel)
	require.NoError(t, err)
	require.True(t, decision.Allowed)

	_, decision, err = AcquireChannelAdmission(context.Background(), channel)
	require.NoError(t, err)
	assert.False(t, decision.Allowed)
	assert.Equal(t, ChannelAdmissionReasonConcurrency, decision.Reason)
	require.NoError(t, first.Release())
}

func TestSelectAdmittedChannelTriesSameTierThenLowerPriority(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })
	previousManager := defaultChannelAdmissionManager
	defaultChannelAdmissionManager = manager
	t.Cleanup(func() { defaultChannelAdmissionManager = previousManager })

	highA := &model.Channel{Id: 301}
	highA.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
	highB := &model.Channel{Id: 302}
	highB.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
	low := &model.Channel{Id: 303}
	low.SetSetting(dto.ChannelSettings{})

	highALease, decision, err := manager.acquire(context.Background(), highA.Id, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)

	tiers := []model.ChannelCandidateTier{
		{Priority: 10, Candidates: []model.ChannelCandidate{{Channel: highA, Weight: 1}, {Channel: highB, Weight: 1}}},
		{Priority: 0, Candidates: []model.ChannelCandidate{{Channel: low, Weight: 1}}},
	}
	selection, err := selectAdmittedChannel(context.Background(), "default", tiers, 0)
	require.NoError(t, err)
	require.NotNil(t, selection)
	assert.Equal(t, highB.Id, selection.Channel.Id)
	require.NoError(t, selection.Lease.Release())

	highBLease, decision, err := manager.acquire(context.Background(), highB.Id, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	selection, err = selectAdmittedChannel(context.Background(), "default", tiers, 0)
	require.NoError(t, err)
	require.NotNil(t, selection)
	assert.Equal(t, low.Id, selection.Channel.Id)
	require.NoError(t, selection.Lease.Release())

	require.NoError(t, highALease.Release())
	require.NoError(t, highBLease.Release())
}

func TestSelectAdmittedChannelReturnsCapacityErrorWhenAllCandidatesAreFull(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })
	previousManager := defaultChannelAdmissionManager
	defaultChannelAdmissionManager = manager
	t.Cleanup(func() { defaultChannelAdmissionManager = previousManager })

	channels := []*model.Channel{{Id: 304}, {Id: 305}}
	leases := make([]*ChannelAdmissionLease, 0, len(channels))
	for _, channel := range channels {
		channel.SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
		lease, decision, err := manager.acquire(context.Background(), channel.Id, 1, 0)
		require.NoError(t, err)
		require.True(t, decision.Allowed)
		leases = append(leases, lease)
	}
	defer func() {
		for _, lease := range leases {
			require.NoError(t, lease.Release())
		}
	}()

	selection, err := selectAdmittedChannel(context.Background(), "default", []model.ChannelCandidateTier{{
		Priority: 10,
		Candidates: []model.ChannelCandidate{
			{Channel: channels[0], Weight: 1},
			{Channel: channels[1], Weight: 1},
		},
	}}, 0)
	assert.Nil(t, selection)
	var capacityErr *ChannelCapacityError
	require.True(t, errors.As(err, &capacityErr))
	assert.Equal(t, 2, capacityErr.ConcurrencyRejects)
	assert.Equal(t, int64(1), capacityErr.RetryAfterSeconds())
}

func TestSelectChannelWithAdmissionFallsThroughAutoGroupsOnCapacity(t *testing.T) {
	dsn := fmt.Sprintf("file:channel-admission-auto-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	previousDB := model.DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	previousManager := defaultChannelAdmissionManager
	previousAutoGroups := setting.AutoGroups2JsonString()
	previousUsableGroups := setting.UserUsableGroups2JSONString()
	model.DB = db
	common.MemoryCacheEnabled = true
	common.RedisEnabled = false
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })
	defaultChannelAdmissionManager = manager
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["default","vip"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	t.Cleanup(func() {
		model.DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
		defaultChannelAdmissionManager = previousManager
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(previousAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousUsableGroups))
		if previousMemoryCache && previousDB != nil {
			model.InitChannelCache()
		}
	})

	priority := int64(10)
	weight := uint(1)
	channels := []model.Channel{
		{Id: 404, Name: "default-full", Key: "key-default", Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Priority: &priority, Weight: &weight},
		{Id: 405, Name: "vip-available", Key: "key-vip", Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "vip", Priority: &priority, Weight: &weight},
	}
	for index := range channels {
		channels[index].SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
		require.NoError(t, db.Create(&channels[index]).Error)
		require.NoError(t, db.Create(&model.Ability{
			Group:     channels[index].Group,
			Model:     "gpt-test",
			ChannelId: channels[index].Id,
			Enabled:   true,
			Priority:  &priority,
			Weight:    weight,
		}).Error)
	}
	model.InitChannelCache()

	fullLease, decision, err := manager.acquire(context.Background(), channels[0].Id, 1, 0)
	require.NoError(t, err)
	require.True(t, decision.Allowed)
	defer func() { require.NoError(t, fullLease.Release()) }()

	gin.SetMode(gin.TestMode)
	ctx := &gin.Context{}
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	retry := 0
	selection, err := SelectChannelWithAdmission(&RetryParam{
		Ctx:         ctx,
		TokenGroup:  "auto",
		ModelName:   "gpt-test",
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	})
	require.NoError(t, err)
	require.NotNil(t, selection)
	assert.Equal(t, channels[1].Id, selection.Channel.Id)
	assert.Equal(t, "vip", selection.Group)
	assert.Equal(t, 0, retry)
	require.NoError(t, selection.Lease.Release())
}

func TestSelectChannelWithAdmissionDoesNotAdvanceRetryOnCapacitySkip(t *testing.T) {
	dsn := fmt.Sprintf("file:channel-admission-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))

	previousDB := model.DB
	previousMemoryCache := common.MemoryCacheEnabled
	previousRedisEnabled := common.RedisEnabled
	previousManager := defaultChannelAdmissionManager
	model.DB = db
	common.MemoryCacheEnabled = false
	common.RedisEnabled = false
	now := time.Unix(1_700_000_000, 0)
	manager := newMemoryChannelAdmissionManager(func() time.Time { return now })
	defaultChannelAdmissionManager = manager
	t.Cleanup(func() {
		model.DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCache
		common.RedisEnabled = previousRedisEnabled
		defaultChannelAdmissionManager = previousManager
		if previousMemoryCache && previousDB != nil {
			model.InitChannelCache()
		}
	})

	highPriority := int64(10)
	lowPriority := int64(0)
	weight := uint(1)
	channels := []model.Channel{
		{Id: 401, Name: "high-a", Key: "key-a", Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Priority: &highPriority, Weight: &weight},
		{Id: 402, Name: "high-b", Key: "key-b", Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Priority: &highPriority, Weight: &weight},
		{Id: 403, Name: "low", Key: "key-c", Status: common.ChannelStatusEnabled, Models: "gpt-test", Group: "default", Priority: &lowPriority, Weight: &weight},
	}
	for index := range channels {
		if channels[index].Id != 403 {
			channels[index].SetSetting(dto.ChannelSettings{MaxConcurrency: 1})
		}
		require.NoError(t, db.Create(&channels[index]).Error)
		priority := channels[index].GetPriority()
		require.NoError(t, db.Create(&model.Ability{
			Group:     "default",
			Model:     "gpt-test",
			ChannelId: channels[index].Id,
			Enabled:   true,
			Priority:  &priority,
			Weight:    weight,
		}).Error)
	}
	model.InitChannelCache()

	leases := make([]*ChannelAdmissionLease, 0, 2)
	for _, channelID := range []int{401, 402} {
		lease, decision, acquireErr := manager.acquire(context.Background(), channelID, 1, 0)
		require.NoError(t, acquireErr)
		require.True(t, decision.Allowed)
		leases = append(leases, lease)
	}
	defer func() {
		for _, lease := range leases {
			require.NoError(t, lease.Release())
		}
	}()

	gin.SetMode(gin.TestMode)
	ctx := &gin.Context{}
	retry := 0
	selection, err := SelectChannelWithAdmission(&RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		ModelName:   "gpt-test",
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	})
	require.NoError(t, err)
	require.NotNil(t, selection)
	assert.Equal(t, 403, selection.Channel.Id)
	assert.Equal(t, 0, retry)
	require.NoError(t, selection.Lease.Release())
}
