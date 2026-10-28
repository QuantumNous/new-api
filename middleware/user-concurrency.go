package middleware

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

const userConcurrencyLeaseTTL = time.Minute
const userConcurrencyOperationTimeout = 2 * time.Second

var userConcurrencySlots = struct {
	sync.Mutex
	counts map[int]int
}{counts: make(map[int]int)}

var acquireUserConcurrencyScript = redis.NewScript(`
redis.replicate_commands()
local now = redis.call('TIME')
local millis = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', millis)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then
  return 0
end
redis.call('ZADD', KEYS[1], millis + tonumber(ARGV[3]), ARGV[2])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1`)

var renewUserConcurrencyScript = redis.NewScript(`
redis.replicate_commands()
local now = redis.call('TIME')
local millis = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
local expires = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not expires or tonumber(expires) <= millis then
  return 0
end
redis.call('ZADD', KEYS[1], millis + tonumber(ARGV[2]), ARGV[1])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
return 1`)

// A lease belongs to one admitted client request, including its internal
// retries. Redis leases expire after a crashed process stops renewing them.
type userConcurrencyLease struct {
	userID    int
	rdb       *redis.Client
	key       string
	id        string
	stop      chan struct{}
	done      chan struct{}
	once      sync.Once
	expiresAt time.Time
}

func acquireUserConcurrency(ctx context.Context, userID, limit int) (*userConcurrencyLease, error) {
	lease := &userConcurrencyLease{userID: userID}
	if !common.RedisEnabled {
		userConcurrencySlots.Lock()
		defer userConcurrencySlots.Unlock()
		if userConcurrencySlots.counts[userID] >= limit {
			return nil, nil
		}
		userConcurrencySlots.counts[userID]++
		return lease, nil
	}
	if common.RDB == nil {
		return nil, fmt.Errorf("user concurrency Redis client is unavailable")
	}
	lease.rdb = common.RDB
	lease.key = fmt.Sprintf("concurrency:user:v1:%d", userID)
	lease.id = common.GetUUID()
	operationCtx, cancel := context.WithTimeout(ctx, userConcurrencyOperationTimeout)
	defer cancel()
	lease.expiresAt = time.Now().Add(userConcurrencyLeaseTTL)
	admitted, err := acquireUserConcurrencyScript.Run(operationCtx, lease.rdb,
		[]string{lease.key}, limit, lease.id, userConcurrencyLeaseTTL.Milliseconds()).Int()
	if err != nil {
		// An ambiguous Redis timeout may have acquired a slot. Remove only our
		// own member; expiry remains the fallback if Redis is still unavailable.
		lease.release()
		return nil, err
	}
	if admitted == 0 {
		return nil, nil
	}
	return lease, nil
}

// renew advances the conservative expiry only after Redis confirms ownership.
// Starting the TTL before the operation accounts for response latency.
func (lease *userConcurrencyLease) renew() (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), userConcurrencyOperationTimeout)
	defer cancel()
	expiresAt := time.Now().Add(userConcurrencyLeaseTTL)
	renewed, err := renewUserConcurrencyScript.Run(ctx, lease.rdb,
		[]string{lease.key}, lease.id, userConcurrencyLeaseTTL.Milliseconds()).Int()
	if err == nil && renewed == 1 {
		lease.expiresAt = expiresAt
	}
	return renewed == 1, err
}

// keepAlive tolerates temporary Redis failures while the confirmed lease is
// valid. A missing lease cancels immediately; persistent errors cancel before
// expiry, leaving one operation timeout of headroom for stopping upstream work.
func (lease *userConcurrencyLease) keepAlive(cancel context.CancelFunc) {
	defer close(lease.done)
	timer := time.NewTimer(min(userConcurrencyLeaseTTL/3, time.Until(lease.expiresAt.Add(-userConcurrencyOperationTimeout))))
	defer timer.Stop()
	for {
		select {
		case <-lease.stop:
			return
		case <-timer.C:
			var renewed bool
			var err error = context.DeadlineExceeded
			if time.Now().Before(lease.expiresAt.Add(-userConcurrencyOperationTimeout)) {
				renewed, err = lease.renew()
			}
			remaining := time.Until(lease.expiresAt.Add(-userConcurrencyOperationTimeout))
			if err == nil && !renewed || remaining <= 0 {
				common.SysError(common.LogText("user concurrency lease lost for user %d: %v", lease.userID, err))
				cancel()
				return
			}
			timer.Reset(min(userConcurrencyLeaseTTL/3, remaining))
		}
	}
}

func (lease *userConcurrencyLease) release() {
	lease.once.Do(func() {
		if lease.rdb == nil {
			userConcurrencySlots.Lock()
			defer userConcurrencySlots.Unlock()
			userConcurrencySlots.counts[lease.userID]--
			if userConcurrencySlots.counts[lease.userID] == 0 {
				delete(userConcurrencySlots.counts, lease.userID)
			}
			return
		}
		if lease.stop != nil {
			close(lease.stop)
			<-lease.done
		}
		ctx, cancel := context.WithTimeout(context.Background(), userConcurrencyOperationTimeout)
		defer cancel()
		if err := lease.rdb.ZRem(ctx, lease.key, lease.id).Err(); err != nil {
			common.SysError(common.LogText("failed to release user concurrency lease for user %d: %v", lease.userID, err))
		}
	})
}

// UserConcurrencyLimit limits active relay requests across every API key and
// group belonging to the authenticated user. Zero leaves existing behavior
// unchanged. A slot is held until the handler finishes, including on cancel
// or panic; cancellation alone must not free capacity while work still runs.
func UserConcurrencyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := c.GetInt(string(constant.ContextKeyUserMaxConcurrency))
		if limit == 0 {
			c.Next()
			return
		}
		userID := c.GetInt("id")
		if userID <= 0 || limit < 0 {
			abortWithOpenAiMessage(c, http.StatusServiceUnavailable, i18n.T(c, i18n.MsgConcurrencyLimitUnavailable), types.ErrorCode("concurrency_limit_unavailable"))
			return
		}
		lease, err := acquireUserConcurrency(c.Request.Context(), userID, limit)
		if err != nil {
			common.SysError(common.LogText("failed to acquire user concurrency lease for user %d: %v", userID, err))
			abortWithOpenAiMessage(c, http.StatusServiceUnavailable, i18n.T(c, i18n.MsgConcurrencyLimitUnavailable), types.ErrorCode("concurrency_limit_unavailable"))
			return
		}
		if lease == nil {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgConcurrencyLimitReached, map[string]any{"Max": limit}), types.ErrorCode("user_concurrency_limit"))
			return
		}
		defer lease.release()
		if lease.rdb != nil {
			ctx, cancel := context.WithCancel(c.Request.Context())
			defer cancel()
			c.Request = c.Request.WithContext(ctx)
			lease.stop, lease.done = make(chan struct{}), make(chan struct{})
			go lease.keepAlive(cancel)
		}
		c.Next()
	}
}
