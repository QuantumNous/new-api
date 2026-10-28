package service

import (
	"context"
	"fmt"
	"hash/fnv"
	"math/rand/v2"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	distLockTTL        = 30 * time.Second
	distLockRenewEvery = 10 * time.Second
	pollShardCount     = 16
	taskLockKeyPrefix  = "dp:lock:job:"
	pollLockKeyPrefix  = "dp:lock:poll:"
)

var (
	taskLockJitterMax  = 500 * time.Millisecond
	taskLockStealDelay = 300 * time.Millisecond
)

const renewLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0
`

const releaseLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`

// DistLock is a single-key Redis lock. The token is checked on renew and
// release so a late owner cannot delete a lock another node has taken over.
type DistLock struct {
	Key   string
	Token string
	TTL   time.Duration
}

// BackgroundJobsEnabled reports whether this process should run scheduled
// jobs. Redis turns every node into a candidate; the lock decides the winner.
// Without Redis, only the master runs jobs, matching single-node installs.
func BackgroundJobsEnabled() bool {
	if DistributedPollActive() {
		return true
	}
	return common.IsMasterNode
}

// DistributedPollActive is true when Redis can coordinate task ownership.
func DistributedPollActive() bool {
	return common.RedisEnabled && common.RDB != nil
}

func lockOwnerName() string {
	name := common.NodeName
	if name == "" {
		name = "node"
	}
	return name
}

func newLockToken() string {
	return lockOwnerName() + ":" + common.GetRandomString(16)
}

// jitterDuration maps n into [0, max). A non-positive max yields zero.
func jitterDuration(max time.Duration, n int64) time.Duration {
	if max <= 0 {
		return 0
	}
	if n < 0 {
		n = -n
		if n < 0 {
			n = 0
		}
	}
	return time.Duration(n % int64(max))
}

// WaitTaskLockJitter spreads lock attempts so nodes do not hit Redis together.
func WaitTaskLockJitter() {
	delay := jitterDuration(taskLockJitterMax, rand.Int64())
	if delay > 0 {
		time.Sleep(delay)
	}
}

func pollShardOrder(node string, count int) []int {
	if count <= 0 {
		return nil
	}
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(node))
	start := int(hasher.Sum32() % uint32(count))
	order := make([]int, count)
	for i := 0; i < count; i++ {
		order[i] = (start + i) % count
	}
	return order
}

func splitPreferred(order []int) (first []int, rest []int) {
	if len(order) == 0 {
		return nil, nil
	}
	mid := (len(order) + 1) / 2
	return order[:mid], order[mid:]
}

// AcquireDistLock tries SET NX once. ok is false when another owner holds the key.
func AcquireDistLock(ctx context.Context, key string) (*DistLock, bool, error) {
	if !DistributedPollActive() {
		return nil, false, fmt.Errorf("redis lock is unavailable")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	lock := &DistLock{Key: key, Token: newLockToken(), TTL: distLockTTL}
	ok, err := common.RDB.SetNX(ctx, key, lock.Token, lock.TTL).Result()
	if err != nil {
		return nil, false, err
	}
	if !ok {
		return nil, false, nil
	}
	return lock, true, nil
}

func (lock *DistLock) Renew(ctx context.Context) error {
	if lock == nil {
		return fmt.Errorf("redis lock is nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	updated, err := common.RDB.Eval(ctx, renewLockScript, []string{lock.Key}, lock.Token, lock.TTL.Milliseconds()).Int()
	if err != nil {
		return err
	}
	if updated == 0 {
		return fmt.Errorf("redis lock lost: %s", lock.Key)
	}
	return nil
}

func (lock *DistLock) Release(ctx context.Context) error {
	if lock == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	_, err := common.RDB.Eval(ctx, releaseLockScript, []string{lock.Key}, lock.Token).Result()
	return err
}

func jobLockKey(name string) string {
	return taskLockKeyPrefix + name
}

func pollLockKey(kind string, shard int) string {
	return fmt.Sprintf("%s%s:%d", pollLockKeyPrefix, kind, shard)
}

// RunExclusiveJob runs fn on one node. Redis errors and a lost race skip fn.
// The context is canceled when the lock can no longer be renewed. Without
// Redis, fn runs locally so a single master keeps today's behavior.
func RunExclusiveJob(name string, fn func(ctx context.Context)) {
	if fn == nil {
		return
	}
	if !DistributedPollActive() {
		fn(context.Background())
		return
	}
	WaitTaskLockJitter()
	lock, ok, err := AcquireDistLock(context.Background(), jobLockKey(name))
	if err != nil {
		common.SysError(common.LogText("task lock acquire failed: job=%s err=%v", name, err))
		return
	}
	if !ok {
		return
	}
	defer func() { _ = lock.Release(context.Background()) }()
	runRenewed(lock, fn)
}

func runRenewed(lock *DistLock, fn func(ctx context.Context)) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	defer close(done)
	go func() {
		ticker := time.NewTicker(distLockRenewEvery)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				if err := lock.Renew(context.Background()); err != nil {
					cancel()
					return
				}
			}
		}
	}()
	fn(ctx)
}
