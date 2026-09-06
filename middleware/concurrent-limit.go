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
	concurrentLimitMark      = "MCCL"
	concurrentLeaseTTL       = 5 * time.Minute
	concurrentReleaseTimeout = 2 * time.Second
	concurrentSlotKey        = "concurrent_slot"
	concurrentBackendRedis   = "redis"
	concurrentBackendMemory  = "memory"
)

func concurrentKey(scope, id string) string {
	return fmt.Sprintf("concurrentLimit:%s:%s", scope, id)
}

// concurrentSlot 记录一次成功占用的并发槽位。release 时据此释放
// 同一 backend（Redis 或内存），即使 acquire 与 release 之间
// Redis 状态发生变化也不会释放错对象。
type concurrentSlot struct {
	backend string // "redis" | "memory"
	key     string
	leaseID string             // Redis lease ID，内存 backend 为空
	cancel  context.CancelFunc // 停止 Redis lease 续租协程，可为 nil
}

// acquireUserConcurrent 为请求占用一个用户并发槽位。
// Redis 正常时使用 Redis lease 并启动续租；Redis 异常时回退到
// 本实例的内存计数器（单实例语义），不再直接放行。
func acquireUserConcurrent(c *gin.Context, userID int, maxConcurrent int) bool {
	if maxConcurrent <= 0 {
		return true
	}
	key := concurrentKey(concurrentLimitMark, strconv.Itoa(userID))
	if common.RedisEnabled {
		leaseID, allowed, err := limiter.NewConcurrent(common.RDB).Acquire(
			c.Request.Context(), key, maxConcurrent, concurrentLeaseTTL,
		)
		if err == nil {
			if !allowed {
				return false
			}
			renewCtx, cancel := context.WithCancel(context.Background())
			go limiter.NewConcurrent(common.RDB).KeepAlive(renewCtx, key, leaseID, concurrentLeaseTTL)
			c.Set(concurrentSlotKey, &concurrentSlot{
				backend: concurrentBackendRedis,
				key:     key,
				leaseID: leaseID,
				cancel:  cancel,
			})
			return true
		}
		common.SysError(fmt.Sprintf("concurrent limit redis acquire failed for user %d, falling back to in-memory limiter: %v", userID, err))
	}
	allowed := limiter.GetInMemoryConcurrent().Acquire(key, maxConcurrent)
	if !allowed {
		return false
	}
	c.Set(concurrentSlotKey, &concurrentSlot{backend: concurrentBackendMemory, key: key})
	return true
}

func releaseUserConcurrent(c *gin.Context) {
	v, exists := c.Get(concurrentSlotKey)
	if !exists {
		return
	}
	slot, ok := v.(*concurrentSlot)
	if !ok || slot == nil {
		return
	}
	if slot.cancel != nil {
		slot.cancel()
	}
	if slot.backend == concurrentBackendRedis {
		// 释放是同步 I/O：给一个短 deadline，防止 Redis 卡顿时
		// 已完成的请求 handler 被拖住；超时未释放的槽位由 lease TTL 兜底回收。
		releaseCtx, cancel := context.WithTimeout(context.Background(), concurrentReleaseTimeout)
		defer cancel()
		limiter.NewConcurrent(common.RDB).Release(releaseCtx, slot.key, slot.leaseID)
		return
	}
	limiter.GetInMemoryConcurrent().Release(slot.key)
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
