package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// 内存限流处理器回归：一次性初始化（并发首批请求不 panic）与
// successMaxCount=0（不限）守卫。
// 注意：不重置包级 modelRateLimiter —— 其实例带常驻清理 goroutine，
// 运行中换值会与 clearExpiredItems 的无锁读竞争。各测试用不同组/用户隔离状态。

func withMemoryRateLimitSettings(t *testing.T, enabled bool, durationMin, count, success int, group map[string][2]int) {
	prev := struct {
		enabled     bool
		durationMin int
		count       int
		success     int
		group       map[string][2]int
	}{
		setting.ModelRequestRateLimitEnabled,
		setting.ModelRequestRateLimitDurationMinutes,
		setting.ModelRequestRateLimitCount,
		setting.ModelRequestRateLimitSuccessCount,
		setting.ModelRequestRateLimitGroup,
	}
	setting.ModelRequestRateLimitEnabled = enabled
	setting.ModelRequestRateLimitDurationMinutes = durationMin
	setting.ModelRequestRateLimitCount = count
	setting.ModelRequestRateLimitSuccessCount = success
	setting.ModelRequestRateLimitGroup = group
	t.Cleanup(func() {
		setting.ModelRequestRateLimitEnabled = prev.enabled
		setting.ModelRequestRateLimitDurationMinutes = prev.durationMin
		setting.ModelRequestRateLimitCount = prev.count
		setting.ModelRequestRateLimitSuccessCount = prev.success
		setting.ModelRequestRateLimitGroup = prev.group
	})
}

func memoryRateLimitStatus(h func(c *gin.Context), id int, group string) int {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/v1/chat/completions", nil)
	c.Set("id", id)
	common.SetContextKey(c, constant.ContextKeyUserGroup, group)
	h(c)
	return c.Writer.Status()
}

// 1) 并发首批请求：修复前每请求调用 Init，store 尚为 nil 时另一 goroutine 进入
// Request 会在 nil map 上赋值 panic。此处按生产同款模式（Once 包裹 Init +
// Request）在零值限流器上并发压测，-race 下应无数据竞争、无 panic。
func TestMemoryRateLimitOnceInitPatternNoRace(t *testing.T) {
	var l common.InMemoryRateLimiter
	var once sync.Once
	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			once.Do(func() { l.Init(time.Minute) })
			assert.True(t, l.Request("user:1", 1000, 60))
		}()
	}
	wg.Wait()
}

// 2) 处理器层并发：走真实的 modelLimiterOnce/modelRateLimiter 变量路径，
// 200 并发首批请求应无 panic、无误 429
func TestMemoryRateLimitHandlerConcurrentNoPanic(t *testing.T) {
	gin.SetMode(gin.TestMode)
	prevRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = prevRedis })

	withMemoryRateLimitSettings(t, true, 1, 1000, 1000, nil)
	h := ModelRequestRateLimit()

	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			assert.NotPanics(t, func() {
				assert.Equal(t, http.StatusOK, memoryRateLimitStatus(h, 7, "conc-group"))
			})
		}()
	}
	wg.Wait()
}

// 3) successMaxCount=0 表示不限制（与 Redis 路径 maxCount==0 提前返回一致）：
// 修复前 Request(checkKey, 0, duration) 在窗口内只放行首个请求，其余全部 429
func TestMemoryRateLimitZeroSuccessCountUnlimited(t *testing.T) {
	gin.SetMode(gin.TestMode)
	prevRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = prevRedis })

	withMemoryRateLimitSettings(t, true, 1, 0, 0, map[string][2]int{"free": {0, 0}})
	h := ModelRequestRateLimit()

	for i := 0; i < 10; i++ {
		assert.Equal(t, http.StatusOK, memoryRateLimitStatus(h, 8, "free"),
			"successMaxCount=0 时应不限制，第 %d 个请求不应 429", i+1)
	}
}

// 4) 正常限额不受守卫影响：strict [2,2] 第 3 个请求仍应 429
func TestMemoryRateLimitNormalLimitUnchanged(t *testing.T) {
	gin.SetMode(gin.TestMode)
	prevRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = prevRedis })

	withMemoryRateLimitSettings(t, true, 1, 0, 1000, map[string][2]int{"strict": {2, 2}})
	h := ModelRequestRateLimit()

	assert.Equal(t, http.StatusOK, memoryRateLimitStatus(h, 9, "strict"))
	assert.Equal(t, http.StatusOK, memoryRateLimitStatus(h, 9, "strict"))
	assert.Equal(t, http.StatusTooManyRequests, memoryRateLimitStatus(h, 9, "strict"))
}
