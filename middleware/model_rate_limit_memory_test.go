package middleware

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// newMemoryRateLimitEngine 直接挂载内存限流处理器，绕开 Redis 分支，
// 用独立 userID 隔离全局 inMemoryRateLimiter 的跨用例状态。
func newMemoryRateLimitEngine(userID, total, success int, duration int64) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("id", userID) })
	r.Use(memoryRateLimitHandler(duration, total, success))
	r.GET("/test", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	return r
}

func fireOnce(r *gin.Engine) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	r.ServeHTTP(w, req)
	return w
}

// 冷启动连发：内存路径必须把总请求数硬卡在 total，多余的一律 429。
// 对照老令牌桶冷启动满桶会瞬时放行远超 total 的缺陷。
func TestMemoryRateLimit_HardCapAtCount_ColdStart(t *testing.T) {
	const total = 5
	r := newMemoryRateLimitEngine(90001, total, 1000, 60)

	allowed, limited := 0, 0
	for i := 0; i < 15; i++ {
		switch code := fireOnce(r).Code; code {
		case http.StatusOK:
			allowed++
		case http.StatusTooManyRequests:
			limited++
		default:
			t.Fatalf("第 %d 个请求返回意外状态码 %d", i, code)
		}
	}
	if allowed != total {
		t.Fatalf("放行数=%d，期望 %d", allowed, total)
	}
	if limited != 15-total {
		t.Fatalf("限流数=%d，期望 %d", limited, 15-total)
	}
}

// 100 并发同一用户：mutex 原子性保证放行数恰好等于 total，既不超也不少（-race 验证无数据竞争）。
func TestMemoryRateLimit_ConcurrentBurstHardCap(t *testing.T) {
	const total = 10
	const n = 100
	r := newMemoryRateLimitEngine(90002, total, 1000, 60)

	var allowed int64
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			if fireOnce(r).Code == http.StatusOK {
				atomic.AddInt64(&allowed, 1)
			}
		}()
	}
	wg.Wait()

	if allowed != total {
		t.Fatalf("并发放行数=%d，期望恰好 %d", allowed, total)
	}
}

// 429 响应必须带 Retry-After 头与结构化错误体，与 Redis 路径对齐，便于客户端退避。
func TestMemoryRateLimit_429HasRetryAfterAndStructuredBody(t *testing.T) {
	r := newMemoryRateLimitEngine(90003, 1, 1000, 60)

	if code := fireOnce(r).Code; code != http.StatusOK {
		t.Fatalf("首个请求应放行，得 %d", code)
	}

	w := fireOnce(r)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("第二个请求应被限流，得 %d", w.Code)
	}

	ra := w.Header().Get("Retry-After")
	if n, err := strconv.Atoi(ra); err != nil || n < 1 {
		t.Fatalf("Retry-After 头非法: %q", ra)
	}

	var body struct {
		Error struct {
			Type    string `json:"type"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := common.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("解析响应体失败: %v, body=%s", err, w.Body.String())
	}
	if body.Error.Type != "new_api_error" {
		t.Fatalf("错误类型=%q，期望 new_api_error", body.Error.Type)
	}
	if body.Error.Message == "" {
		t.Fatal("错误消息为空")
	}
}

// 空闲超过窗口后计数滑出，重新放行——根治老令牌桶空闲涨满后再现突发的缺陷。
func TestMemoryRateLimit_WindowResetAfterIdle(t *testing.T) {
	const window int64 = 1 // 1 秒窗口，便于快速验证
	r := newMemoryRateLimitEngine(90004, 2, 1000, window)

	if fireOnce(r).Code != http.StatusOK || fireOnce(r).Code != http.StatusOK {
		t.Fatal("前两个请求应放行")
	}
	if code := fireOnce(r).Code; code != http.StatusTooManyRequests {
		t.Fatalf("第三个请求应被限流，得 %d", code)
	}

	time.Sleep(time.Duration(window)*time.Second + 200*time.Millisecond)

	if code := fireOnce(r).Code; code != http.StatusOK {
		t.Fatalf("窗口滑过后应恢复放行，得 %d", code)
	}
}

// newMemoryRateLimitEngineStatus 允许指定下游返回的状态码，
// 用于验证失败请求（>=400）对成功计数的影响。
func newMemoryRateLimitEngineStatus(userID, total, success int, duration int64, downstreamStatus int) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("id", userID) })
	r.Use(memoryRateLimitHandler(duration, total, success))
	r.GET("/test", func(c *gin.Context) { c.String(downstreamStatus, "x") })
	return r
}

// totalMaxCount=0 表示不限制总请求数：连发应全部放行。
func TestMemoryRateLimit_ZeroTotalUnlimited(t *testing.T) {
	r := newMemoryRateLimitEngine(90005, 0, 1000, 60)
	for i := 0; i < 50; i++ {
		if code := fireOnce(r).Code; code != http.StatusOK {
			t.Fatalf("total=0 应不限制，第 %d 个请求却返回 %d", i, code)
		}
	}
}

// 失败请求不应消耗成功配额——验证 _check 影子 key 双计数缺陷已修。
// 旧实现对每个到达请求（含失败）都 Request(checkKey)，失败会提前打满配额误拒；
// 新实现 c.Next 前只读 Check(successKey)，仅在成功(<400)时才记录。
func TestMemoryRateLimit_FailedRequestsDoNotConsumeSuccessQuota(t *testing.T) {
	const success = 3
	const uid = 90006

	// 阶段一：total 不限、下游全部 500。失败请求应全部进入下游，不被成功数限制拦截。
	rFail := newMemoryRateLimitEngineStatus(uid, 0, success, 60, http.StatusInternalServerError)
	for i := 0; i < 10; i++ {
		if code := fireOnce(rFail).Code; code != http.StatusInternalServerError {
			t.Fatalf("失败请求应进入下游返回 500，第 %d 个却返回 %d（成功配额被失败请求误占用）", i, code)
		}
	}

	// 阶段二：同一用户改走成功下游。前 success 个放行，第 success+1 个才因成功数满被拒。
	rOK := newMemoryRateLimitEngineStatus(uid, 0, success, 60, http.StatusOK)
	allowed := 0
	for i := 0; i < success+3; i++ {
		if fireOnce(rOK).Code == http.StatusOK {
			allowed++
		}
	}
	if allowed != success {
		t.Fatalf("成功放行数=%d，期望恰好 %d（证明此前的失败请求未占用成功配额）", allowed, success)
	}
}
