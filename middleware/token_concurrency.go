package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

const (
	tokenConcurrencyKeyPrefix    = "aibuff:token-concurrency:v1"
	tokenConcurrencyRedisTimeout = 2 * time.Second
)

var (
	errTokenConcurrencyLimit       = errors.New("token concurrency limit reached")
	errTokenConcurrencyUnavailable = errors.New("token concurrency unavailable")
)

var tokenConcurrencyAcquireScript = redis.NewScript(`
local current = redis.call('HLEN', KEYS[1])
local limit = tonumber(ARGV[1])
if not limit or limit <= 0 then
  return -1
end
if current >= limit then
  return 0
end
redis.call('HSET', KEYS[1], ARGV[2], '1')
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1
`)

var tokenConcurrencyReleaseScript = redis.NewScript(`
local removed = redis.call('HDEL', KEYS[1], ARGV[1])
if redis.call('HLEN', KEYS[1]) == 0 then
  redis.call('DEL', KEYS[1])
end
return removed
`)

var tokenConcurrencyRefreshScript = redis.NewScript(`
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0
`)

func tokenConcurrencyKey(tokenID int, group string) string {
	return fmt.Sprintf("%s:token:%d:group:%s", tokenConcurrencyKeyPrefix, tokenID, group)
}

func acquireTokenConcurrency(ctx context.Context, rdb *redis.Client, key, leaseID string, limit int, ttl time.Duration) error {
	if rdb == nil || limit <= 0 || ttl <= 0 {
		return errTokenConcurrencyUnavailable
	}
	result, err := tokenConcurrencyAcquireScript.Run(ctx, rdb, []string{key}, limit, leaseID, ttl.Milliseconds()).Int64()
	if err != nil {
		return fmt.Errorf("acquire token concurrency: %w", err)
	}
	switch result {
	case 1:
		return nil
	case 0:
		return errTokenConcurrencyLimit
	default:
		return errTokenConcurrencyUnavailable
	}
}

func releaseTokenConcurrency(ctx context.Context, rdb *redis.Client, key, leaseID string) error {
	if rdb == nil {
		return errTokenConcurrencyUnavailable
	}
	if _, err := tokenConcurrencyReleaseScript.Run(ctx, rdb, []string{key}, leaseID).Int64(); err != nil {
		return fmt.Errorf("release token concurrency: %w", err)
	}
	return nil
}

func refreshTokenConcurrency(ctx context.Context, rdb *redis.Client, key, leaseID string, ttl time.Duration) error {
	if rdb == nil || ttl <= 0 {
		return errTokenConcurrencyUnavailable
	}
	if _, err := tokenConcurrencyRefreshScript.Run(ctx, rdb, []string{key}, leaseID, ttl.Milliseconds()).Int64(); err != nil {
		return fmt.Errorf("refresh token concurrency: %w", err)
	}
	return nil
}

func startTokenConcurrencyHeartbeat(rdb *redis.Client, key, leaseID string, ttl time.Duration) (stop, done chan struct{}) {
	stop = make(chan struct{})
	done = make(chan struct{})
	interval := ttl / 3
	if interval < 100*time.Millisecond {
		interval = 100 * time.Millisecond
	}
	go func() {
		defer close(done)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				refreshCtx, cancel := context.WithTimeout(context.Background(), tokenConcurrencyRedisTimeout)
				_ = refreshTokenConcurrency(refreshCtx, rdb, key, leaseID, ttl)
				cancel()
			}
		}
	}()
	return stop, done
}

func tokenConcurrencyGroup(c *gin.Context) string {
	if group := common.GetContextKeyString(c, constant.ContextKeyAutoGroup); group != "" {
		return group
	}
	if group := common.GetContextKeyString(c, constant.ContextKeyUsingGroup); group != "" {
		return group
	}
	return common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
}

func TokenConcurrencyGate() gin.HandlerFunc {
	return tokenConcurrencyGate(func() *redis.Client {
		if !common.RedisEnabled {
			return nil
		}
		return common.RDB
	})
}

// TokenConcurrencyGateWithRedis is used by isolated multi-node tests. The
// production router uses TokenConcurrencyGate and the process-wide client.
func TokenConcurrencyGateWithRedis(rdb *redis.Client) gin.HandlerFunc {
	return tokenConcurrencyGate(func() *redis.Client { return rdb })
}

func tokenConcurrencyGate(redisClient func() *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		group := tokenConcurrencyGroup(c)
		policy := setting.TokenConcurrencyPolicyForGroup(group)
		if !policy.Configured {
			c.Next()
			return
		}
		if policy.Err != nil || policy.Limit <= 0 || policy.LeaseTTL <= 0 {
			abortWithOpenAiMessage(c, http.StatusServiceUnavailable, "token_concurrency_unavailable", types.ErrorCodeTokenConcurrencyUnavailable)
			return
		}

		tokenID := c.GetInt("token_id")
		if tokenID <= 0 || group == "" {
			abortWithOpenAiMessage(c, http.StatusServiceUnavailable, "token_concurrency_unavailable", types.ErrorCodeTokenConcurrencyUnavailable)
			return
		}
		key := tokenConcurrencyKey(tokenID, group)
		leaseID := uuid.NewString()
		acquireCtx, cancel := context.WithTimeout(c.Request.Context(), tokenConcurrencyRedisTimeout)
		err := acquireTokenConcurrency(acquireCtx, redisClient(), key, leaseID, policy.Limit, policy.LeaseTTL)
		cancel()
		if errors.Is(err, errTokenConcurrencyLimit) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, "token_concurrency_limit_reached", types.ErrorCodeTokenConcurrencyLimit)
			return
		}
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusServiceUnavailable, "token_concurrency_unavailable", types.ErrorCodeTokenConcurrencyUnavailable)
			return
		}

		heartbeatRedis := redisClient()
		heartbeatStop, heartbeatDone := startTokenConcurrencyHeartbeat(heartbeatRedis, key, leaseID, policy.LeaseTTL)
		defer func() {
			close(heartbeatStop)
			<-heartbeatDone
			releaseCtx, releaseCancel := context.WithTimeout(context.Background(), tokenConcurrencyRedisTimeout)
			if releaseErr := releaseTokenConcurrency(releaseCtx, heartbeatRedis, key, leaseID); releaseErr != nil {
				logger.LogError(context.Background(), fmt.Sprintf("token concurrency release failed: group=%s limit=%d", group, policy.Limit))
			}
			releaseCancel()
		}()
		c.Next()
	}
}
