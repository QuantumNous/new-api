package service

import (
	"context"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"

	"github.com/bytedance/gopkg/util/gopool"
)

type distributedPoll struct {
	name string
	run  func(ctx context.Context, shard int, count int)
}

type heldPollShard struct {
	shard int
	lock  *DistLock
}

var (
	distributedPollMu   sync.Mutex
	distributedPolls    []distributedPoll
	distributedPollOnce sync.Once
)

func init() {
	RegisterDistributedPoll("async", func(ctx context.Context, shard int, count int) {
		limit := constant.TaskQueryLimit / count
		if limit < 1 {
			limit = 1
		}
		RunTaskPollingShard(ctx, shard, count, limit, nil)
	})
}

// RegisterDistributedPoll adds a sharded poll loop. Call it before
// StartSystemTaskRunner. Each shard has its own Redis lock.
func RegisterDistributedPoll(name string, run func(ctx context.Context, shard int, count int)) {
	if name == "" || run == nil {
		return
	}
	distributedPollMu.Lock()
	defer distributedPollMu.Unlock()
	distributedPolls = append(distributedPolls, distributedPoll{name: name, run: run})
}

func startDistributedPollers() {
	distributedPollOnce.Do(func() {
		if !DistributedPollActive() {
			return
		}
		distributedPollMu.Lock()
		polls := append([]distributedPoll(nil), distributedPolls...)
		distributedPollMu.Unlock()
		for _, poll := range polls {
			poll := poll
			gopool.Go(func() {
				logger.LogInfo(context.Background(), common.LogText("distributed poll started: kind=%s shards=%d", poll.name, pollShardCount))
				runDistributedPollLoop(poll)
			})
		}
	})
}

func runDistributedPollLoop(poll distributedPoll) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	runDistributedPollTick(poll)
	for range ticker.C {
		runDistributedPollTick(poll)
	}
}

func runDistributedPollTick(poll distributedPoll) {
	if !constant.UpdateTask || !DistributedPollActive() {
		return
	}
	WaitTaskLockJitter()
	order := pollShardOrder(lockOwnerName(), pollShardCount)
	first, rest := splitPreferred(order)
	held := acquirePollShards(poll.name, first)
	if taskLockStealDelay > 0 {
		time.Sleep(taskLockStealDelay)
	}
	held = append(held, acquirePollShards(poll.name, rest)...)
	for _, item := range held {
		item := item
		gopool.Go(func() {
			defer func() { _ = item.lock.Release(context.Background()) }()
			runRenewed(item.lock, func(ctx context.Context) {
				poll.run(ctx, item.shard, pollShardCount)
			})
		})
	}
}

func acquirePollShards(kind string, shards []int) []heldPollShard {
	held := make([]heldPollShard, 0, len(shards))
	for _, shard := range shards {
		lock, ok, err := AcquireDistLock(context.Background(), pollLockKey(kind, shard))
		if err != nil {
			logger.LogWarn(context.Background(), common.LogText("poll lock acquire failed: kind=%s shard=%d err=%v", kind, shard, err))
			continue
		}
		if !ok {
			continue
		}
		held = append(held, heldPollShard{shard: shard, lock: lock})
	}
	return held
}
