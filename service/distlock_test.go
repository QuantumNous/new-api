package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useTaskLockRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	previousRedis, previousRDB := common.RedisEnabled, common.RDB
	previousJitter, previousSteal := taskLockJitterMax, taskLockStealDelay
	previousNode := common.NodeName
	common.RedisEnabled = true
	common.RDB = client
	taskLockJitterMax = 0
	taskLockStealDelay = 0
	common.NodeName = "node-a"
	t.Cleanup(func() {
		common.RedisEnabled = previousRedis
		common.RDB = previousRDB
		taskLockJitterMax = previousJitter
		taskLockStealDelay = previousSteal
		common.NodeName = previousNode
		_ = client.Close()
	})
	return server
}

func TestJitterDurationStaysInsideWindow(t *testing.T) {
	assert.Equal(t, time.Duration(0), jitterDuration(0, 99))
	assert.Equal(t, 100*time.Millisecond, jitterDuration(500*time.Millisecond, int64(100*time.Millisecond)))
	assert.GreaterOrEqual(t, jitterDuration(500*time.Millisecond, -1), time.Duration(0))
	assert.Less(t, jitterDuration(500*time.Millisecond, -1), 500*time.Millisecond)
}

func TestPollShardOrderIsStablePermutation(t *testing.T) {
	first := pollShardOrder("router-a", pollShardCount)
	second := pollShardOrder("router-a", pollShardCount)
	assert.Equal(t, first, second)
	seen := map[int]bool{}
	for _, shard := range first {
		seen[shard] = true
	}
	assert.Len(t, seen, pollShardCount)
	preferred, rest := splitPreferred(first)
	assert.NotEmpty(t, preferred)
	assert.NotEmpty(t, rest)
	assert.Len(t, append(append([]int{}, preferred...), rest...), pollShardCount)
}

func TestBackgroundJobsEnabledUsesRedisBeforeMasterFlag(t *testing.T) {
	previousMaster, previousRedis, previousRDB := common.IsMasterNode, common.RedisEnabled, common.RDB
	t.Cleanup(func() {
		common.IsMasterNode = previousMaster
		common.RedisEnabled = previousRedis
		common.RDB = previousRDB
	})

	common.RDB = nil
	common.RedisEnabled = false
	common.IsMasterNode = false
	assert.False(t, BackgroundJobsEnabled())

	common.IsMasterNode = true
	assert.True(t, BackgroundJobsEnabled())

	common.IsMasterNode = false
	common.RedisEnabled = true
	common.RDB = redis.NewClient(&redis.Options{Addr: "127.0.0.1:0"})
	assert.True(t, BackgroundJobsEnabled())
	_ = common.RDB.Close()
}

func TestDistLockSingleOwnerRenewAndRelease(t *testing.T) {
	server := useTaskLockRedis(t)
	lock, ok, err := AcquireDistLock(context.Background(), "dp:lock:job:demo")
	require.NoError(t, err)
	require.True(t, ok)

	_, secondOK, err := AcquireDistLock(context.Background(), "dp:lock:job:demo")
	require.NoError(t, err)
	assert.False(t, secondOK)

	require.NoError(t, lock.Renew(context.Background()))
	impostor := &DistLock{Key: lock.Key, Token: "other", TTL: distLockTTL}
	require.Error(t, impostor.Renew(context.Background()))
	require.NoError(t, impostor.Release(context.Background()))
	stored, err := server.Get("dp:lock:job:demo")
	require.NoError(t, err)
	assert.Equal(t, lock.Token, stored)

	require.NoError(t, lock.Release(context.Background()))
	_, err = server.Get("dp:lock:job:demo")
	assert.Error(t, err)

	server.Set("dp:lock:job:expired", "stale")
	server.SetTTL("dp:lock:job:expired", time.Second)
	server.FastForward(2 * time.Second)
	reclaimed, ok, err := AcquireDistLock(context.Background(), "dp:lock:job:expired")
	require.NoError(t, err)
	require.True(t, ok)
	require.NoError(t, reclaimed.Release(context.Background()))
}

func TestRunExclusiveJobSkipsWhilePeerHoldsLock(t *testing.T) {
	useTaskLockRedis(t)
	started := make(chan struct{})
	release := make(chan struct{})
	var once sync.Once
	go RunExclusiveJob("codex_refresh", func(context.Context) {
		once.Do(func() { close(started) })
		<-release
	})
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("holder did not acquire the lock")
	}

	called := false
	RunExclusiveJob("codex_refresh", func(context.Context) { called = true })
	assert.False(t, called, "a second node must not run the job while the lock is held")

	close(release)
	require.Eventually(t, func() bool {
		ran := false
		RunExclusiveJob("codex_refresh", func(context.Context) { ran = true })
		return ran
	}, 2*time.Second, 20*time.Millisecond)
}

func TestSystemTaskClaimSkipsWhenRedisLockHeld(t *testing.T) {
	truncate(t)
	useTaskLockRedis(t)

	lock, ok, err := AcquireDistLock(context.Background(), jobLockKey("test_locked_dispatch"))
	require.NoError(t, err)
	require.True(t, ok)
	defer func() { _ = lock.Release(context.Background()) }()

	ran := make(chan struct{}, 1)
	handler := &stubScheduledHandler{
		taskType: "test_locked_dispatch",
		enabled:  true,
		interval: time.Minute,
		onRun: func(context.Context, *model.SystemTask, string) {
			ran <- struct{}{}
		},
	}
	withSystemTaskRegistry(t, handler)
	_, err = model.CreateSystemTask(handler.taskType, nil, nil)
	require.NoError(t, err)

	runSystemTaskClaimPass("runner-locked")

	select {
	case <-ran:
		t.Fatal("handler ran while another node held the redis lock")
	case <-time.After(200 * time.Millisecond):
	}
}

func TestUnfinishedTaskQueriesHonorShard(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.Create(&model.Task{ID: 1, TaskID: "shard-1", Status: model.TaskStatusInProgress, Progress: "10%"}).Error)
	require.NoError(t, model.DB.Create(&model.Task{ID: 2, TaskID: "shard-2", Status: model.TaskStatusInProgress, Progress: "10%"}).Error)
	require.NoError(t, model.DB.Create(&model.Task{ID: 3, TaskID: "shard-3", Status: model.TaskStatusSuccess, Progress: "100%"}).Error)

	odd := model.GetUnfinishedSyncTasks(10, 1, 2)
	require.Len(t, odd, 1)
	assert.Equal(t, int64(1), odd[0].ID)

	require.NoError(t, model.DB.Create(&model.Midjourney{Id: 1, MjId: "mj-1", Progress: "10%"}).Error)
	require.NoError(t, model.DB.Create(&model.Midjourney{Id: 2, MjId: "mj-2", Progress: "10%"}).Error)
	require.NoError(t, model.DB.Create(&model.Midjourney{Id: 3, MjId: "mj-3", Progress: "100%"}).Error)
	even := model.GetUnfinishedMidjourneyTasks(0, 2)
	require.Len(t, even, 1)
	assert.Equal(t, 2, even[0].Id)
}
