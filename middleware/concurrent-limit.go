package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/limiter"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

const (
	concurrentLimitMark = "MCCL"
	concurrentLeaseTTL  = 5 * time.Minute
)

func concurrentKey(scope, id string) string {
	return fmt.Sprintf("concurrentLimit:%s:%s", scope, id)
}

func acquireUserConcurrent(c *gin.Context, userID int, maxConcurrent int) bool {
	if maxConcurrent <= 0 {
		return true
	}
	key := concurrentKey(concurrentLimitMark, strconv.Itoa(userID))
	if common.RedisEnabled {
		allowed, err := limiter.NewConcurrent(context.Background(), common.RDB).Acquire(
			c.Request.Context(), key, maxConcurrent, concurrentLeaseTTL,
		)
		if err != nil {
			common.SysError(fmt.Sprintf("concurrent limit acquire failed for user %d: %v", userID, err))
			return true
		}
		if !allowed {
			return false
		}
		c.Set("concurrent_release_key", key)
		return true
	}
	allowed := limiter.GetInMemoryConcurrent().Acquire(key, maxConcurrent)
	if allowed {
		c.Set("concurrent_release_key", key)
	}
	return allowed
}

func releaseUserConcurrent(c *gin.Context) {
	key, exists := c.Get("concurrent_release_key")
	if !exists {
		return
	}
	keyStr, ok := key.(string)
	if !ok || keyStr == "" {
		return
	}
	if common.RedisEnabled {
		limiter.NewConcurrent(context.Background(), common.RDB).Release(context.Background(), keyStr)
	} else {
		limiter.GetInMemoryConcurrent().Release(keyStr)
	}
}

// ModelConcurrentLimit 限制同一用户的在途请求数量（多 token 聚合到 user 级）。
// 与 ModelRequestRateLimit（时间窗口计数）互补：前者控制"同时多少个"，
// 后者控制"一段时间内多少次"。两者可同时启用。
func ModelConcurrentLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		if !setting.ModelConcurrentLimitEnabled {
			c.Next()
			return
		}

		maxConcurrent := setting.ModelConcurrentLimit

		group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}
		if groupLimit, found := setting.GetGroupConcurrentLimit(group); found {
			maxConcurrent = groupLimit
		}

		if maxConcurrent <= 0 {
			c.Next()
			return
		}

		userID := c.GetInt("id")
		if userID == 0 {
			c.Next()
			return
		}

		if !acquireUserConcurrent(c, userID, maxConcurrent) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests,
				fmt.Sprintf("您已达到并发请求限制：最多同时进行 %d 个请求，请等待已有请求完成", maxConcurrent))
			return
		}

		defer releaseUserConcurrent(c)
		c.Next()
	}
}
