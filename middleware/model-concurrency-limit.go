package middleware

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

const modelRequestConcurrencyLimitMark = "MRCL"

var modelRequestConcurrencyStore = struct {
	sync.Mutex
	counts map[string]int
}{
	counts: map[string]int{},
}

func modelRequestConcurrencyKey(userId int) string {
	return fmt.Sprintf("%s:user:%d", modelRequestConcurrencyLimitMark, userId)
}

func acquireMemoryModelRequestConcurrency(key string, limit int) bool {
	if limit <= 0 {
		return true
	}
	modelRequestConcurrencyStore.Lock()
	defer modelRequestConcurrencyStore.Unlock()

	current := modelRequestConcurrencyStore.counts[key]
	if current >= limit {
		return false
	}
	modelRequestConcurrencyStore.counts[key] = current + 1
	return true
}

func releaseMemoryModelRequestConcurrency(key string, limit int) {
	if limit <= 0 {
		return
	}
	modelRequestConcurrencyStore.Lock()
	defer modelRequestConcurrencyStore.Unlock()

	current := modelRequestConcurrencyStore.counts[key]
	if current <= 1 {
		delete(modelRequestConcurrencyStore.counts, key)
		return
	}
	modelRequestConcurrencyStore.counts[key] = current - 1
}

func acquireRedisModelRequestConcurrency(ctx context.Context, key string, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}
	current, err := common.RDB.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}
	_ = common.RDB.Expire(ctx, key, common.RateLimitKeyExpirationDuration).Err()
	if current > int64(limit) {
		_ = common.RDB.Decr(ctx, key).Err()
		return false, nil
	}
	return true, nil
}

func releaseRedisModelRequestConcurrency(ctx context.Context, key string, limit int) {
	if limit <= 0 {
		return
	}
	current, err := common.RDB.Decr(ctx, key).Result()
	if err != nil {
		return
	}
	if current <= 0 {
		_ = common.RDB.Del(ctx, key).Err()
		return
	}
	_ = common.RDB.Expire(ctx, key, common.RateLimitKeyExpirationDuration).Err()
}

func ModelRequestConcurrencyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !setting.ModelRequestConcurrencyLimitEnabled {
			c.Next()
			return
		}

		userId := c.GetInt("id")
		if userId == 0 {
			abortWithOpenAiMessage(c, http.StatusUnauthorized, "unauthorized")
			return
		}

		limit := setting.ModelRequestConcurrencyLimitCount
		group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}
		if groupLimit, found := setting.GetGroupConcurrencyLimit(group); found {
			limit = groupLimit
		}
		if limit <= 0 {
			c.Next()
			return
		}

		key := modelRequestConcurrencyKey(userId)
		if common.RedisEnabled {
			ctx := context.Background()
			allowed, err := acquireRedisModelRequestConcurrency(ctx, key, limit)
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "concurrency_limit_check_failed")
				return
			}
			if !allowed {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("You have reached the concurrent request limit: at most %d in-flight requests", limit))
				return
			}
			defer releaseRedisModelRequestConcurrency(ctx, key, limit)
		} else {
			if !acquireMemoryModelRequestConcurrency(key, limit) {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("You have reached the concurrent request limit: at most %d in-flight requests", limit))
				return
			}
			defer releaseMemoryModelRequestConcurrency(key, limit)
		}

		c.Next()
	}
}
