package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetPenaltyState(t *testing.T) {
	t.Helper()
	penaltyMemory.mu.Lock()
	penaltyMemory.entries = make(map[string]*penaltyEntry)
	penaltyMemory.mu.Unlock()

	penaltyEnabled := setting.ModelRequestRateLimitPenaltyEnabled
	cooldownEnabled := setting.ModelRequestRateLimitCooldownEnabled
	// 用例覆盖内存后端；Redis 后端由部署环境的连通性保证
	redisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = redisEnabled
		setting.ModelRequestRateLimitPenaltyEnabled = penaltyEnabled
		setting.ModelRequestRateLimitCooldownEnabled = cooldownEnabled
		penaltyMemory.mu.Lock()
		penaltyMemory.entries = make(map[string]*penaltyEntry)
		penaltyMemory.mu.Unlock()
	})
}

// 拒绝延迟的档位是对外承诺的行为：前 2 次不延迟以容忍偶发突发，
// 之后逐级加重，使不遵守 Retry-After 的客户端无法维持高频重试。
func TestPenaltyDelayTiers(t *testing.T) {
	cases := []struct {
		name    string
		strikes int64
		want    time.Duration
	}{
		{"第1次超限不延迟", 1, 0},
		{"第2次超限不延迟", 2, 0},
		{"第3次进入中档", 3, 500 * time.Millisecond},
		{"第10次仍为中档", 10, 500 * time.Millisecond},
		{"第11次进入重档", 11, 5 * time.Second},
		{"持续超限保持重档", 100, 5 * time.Second},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, penaltyDelayFor(tc.strikes))
		})
	}
}

// 连续超限计数必须累加，否则延迟档位永远停留在第一档。
func TestPenaltyRecordStrikeAccumulates(t *testing.T) {
	resetPenaltyState(t)
	setting.ModelRequestRateLimitCooldownEnabled = false
	ctx := context.Background()

	for expected := int64(1); expected <= 5; expected++ {
		strikes, cooldown := penaltyRecordStrike(ctx, "42")
		require.Equal(t, expected, strikes)
		assert.Zero(t, cooldown, "未达阈值不应触发冷却")
	}
}

// 达到阈值后进入冷却，且冷却时长按触发次数指数退避并封顶，
// 防止单个用户持续占用限流计数器的存储往返。
func TestPenaltyCooldownBackoffAndCap(t *testing.T) {
	resetPenaltyState(t)
	setting.ModelRequestRateLimitCooldownEnabled = true
	ctx := context.Background()

	cases := []struct {
		strikes int64
		want    int64
	}{
		{penaltyCooldownStrikes, 10},
		{penaltyCooldownStrikes * 2, 20},
		{penaltyCooldownStrikes * 3, 40},
		{penaltyCooldownStrikes * 4, penaltyCooldownMax},
		{penaltyCooldownStrikes * 8, penaltyCooldownMax},
	}

	for _, tc := range cases {
		penaltyMemory.mu.Lock()
		penaltyMemory.entries["7"] = &penaltyEntry{
			strikes:   tc.strikes - 1,
			expiresAt: time.Now().Add(penaltyStrikeTTL),
		}
		penaltyMemory.mu.Unlock()

		strikes, cooldown := penaltyRecordStrike(ctx, "7")
		require.Equal(t, tc.strikes, strikes)
		assert.Equal(t, tc.want, cooldown, "strikes=%d 的冷却时长不符", tc.strikes)
	}
}

// 冷却开关关闭时不得产生冷却，保证功能可回退。
func TestPenaltyCooldownDisabled(t *testing.T) {
	resetPenaltyState(t)
	setting.ModelRequestRateLimitCooldownEnabled = false
	ctx := context.Background()

	penaltyMemory.mu.Lock()
	penaltyMemory.entries["9"] = &penaltyEntry{
		strikes:   penaltyCooldownStrikes * 4,
		expiresAt: time.Now().Add(penaltyStrikeTTL),
	}
	penaltyMemory.mu.Unlock()

	_, cooldown := penaltyRecordStrike(ctx, "9")
	assert.Zero(t, cooldown)
	assert.Zero(t, penaltyCooldownRemaining(ctx, "9"))
}

// 冷却期内必须报告剩余秒数，中间件据此跳过限流计数器并回传 Retry-After。
func TestPenaltyCooldownRemaining(t *testing.T) {
	resetPenaltyState(t)
	ctx := context.Background()

	assert.Zero(t, penaltyCooldownRemaining(ctx, "13"), "无记录时不应处于冷却")

	penaltyMemory.mu.Lock()
	penaltyMemory.entries["13"] = &penaltyEntry{
		strikes:     penaltyCooldownStrikes,
		cooldownEnd: time.Now().Add(8 * time.Second),
		expiresAt:   time.Now().Add(penaltyStrikeTTL),
	}
	penaltyMemory.mu.Unlock()

	remaining := penaltyCooldownRemaining(ctx, "13")
	assert.Positive(t, remaining)
	assert.LessOrEqual(t, remaining, int64(9))
}

// 请求恢复正常后必须清除计数，否则偶发超限的客户端会被永久判为重档。
func TestPenaltyClearStrikesResetsTier(t *testing.T) {
	resetPenaltyState(t)
	setting.ModelRequestRateLimitCooldownEnabled = false
	ctx := context.Background()

	for i := 0; i < 5; i++ {
		penaltyRecordStrike(ctx, "21")
	}
	penaltyClearStrikes(ctx, "21")

	strikes, _ := penaltyRecordStrike(ctx, "21")
	assert.Equal(t, int64(1), strikes, "清除后应从第一档重新开始")
}

// 冷却中的用户不能被 penaltyClearStrikes 提前解除冷却。
func TestPenaltyClearStrikesKeepsActiveCooldown(t *testing.T) {
	resetPenaltyState(t)
	ctx := context.Background()

	penaltyMemory.mu.Lock()
	penaltyMemory.entries["33"] = &penaltyEntry{
		strikes:     penaltyCooldownStrikes,
		cooldownEnd: time.Now().Add(30 * time.Second),
		expiresAt:   time.Now().Add(penaltyStrikeTTL),
	}
	penaltyMemory.mu.Unlock()

	penaltyClearStrikes(ctx, "33")
	assert.Positive(t, penaltyCooldownRemaining(ctx, "33"), "冷却期未到不应被清除")
}

// 内存后端必须对条目数设上限，避免伪造大量 userId 撑爆内存。
func TestPenaltyMemoryEntriesBounded(t *testing.T) {
	resetPenaltyState(t)
	setting.ModelRequestRateLimitCooldownEnabled = false
	ctx := context.Background()

	penaltyMemory.mu.Lock()
	for i := 0; i < penaltyMemoryMaxEntries; i++ {
		penaltyMemory.entries[strconv.Itoa(i)] = &penaltyEntry{
			strikes:   1,
			expiresAt: time.Now().Add(penaltyStrikeTTL),
		}
	}
	penaltyMemory.mu.Unlock()

	strikes, _ := penaltyRecordStrike(ctx, "overflow-user")
	assert.Zero(t, strikes, "超过条目上限时应放弃记录新用户")

	penaltyMemory.mu.Lock()
	size := len(penaltyMemory.entries)
	penaltyMemory.mu.Unlock()
	assert.LessOrEqual(t, size, penaltyMemoryMaxEntries)
}

// newPenaltyTestContext 构造一个客户端已断开的请求上下文，使 penaltyWait 立即返回，
// 用例因而不必真实等待惩罚延迟。
func newPenaltyTestContext(t *testing.T) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(ctx)
	return c, recorder
}

// 冷却期内的拒绝不能累加计数，否则冷却时长会被反复重置到上限，
// 持续重试的客户端将永远拿不到冷却结束后的那次重新尝试。
func TestAbortInCooldownDoesNotAccumulateStrikes(t *testing.T) {
	resetPenaltyState(t)
	setting.ModelRequestRateLimitPenaltyEnabled = true
	setting.ModelRequestRateLimitCooldownEnabled = true

	penaltyMemory.mu.Lock()
	penaltyMemory.entries["55"] = &penaltyEntry{
		strikes:     penaltyCooldownStrikes,
		cooldownEnd: time.Now().Add(30 * time.Second),
		expiresAt:   time.Now().Add(penaltyStrikeTTL),
	}
	penaltyMemory.mu.Unlock()

	c, recorder := newPenaltyTestContext(t)
	abortInCooldown(c, 30, "冷却中")

	penaltyMemory.mu.Lock()
	strikes := penaltyMemory.entries["55"].strikes
	penaltyMemory.mu.Unlock()

	assert.Equal(t, int64(penaltyCooldownStrikes), strikes, "冷却期内拒绝不应累加计数")
	assert.Equal(t, http.StatusTooManyRequests, recorder.Code)
	assert.Equal(t, "30", recorder.Header().Get("Retry-After"), "应回传剩余冷却秒数供客户端退避")
}

// 与冷却期相对：限流器判定的超限必须累加计数，否则惩罚档位无法升级。
func TestAbortRateLimitedAccumulatesStrikes(t *testing.T) {
	resetPenaltyState(t)
	setting.ModelRequestRateLimitPenaltyEnabled = true
	setting.ModelRequestRateLimitCooldownEnabled = false

	c, recorder := newPenaltyTestContext(t)
	abortRateLimited(c, "56", 60, "超限")

	penaltyMemory.mu.Lock()
	strikes := penaltyMemory.entries["56"].strikes
	penaltyMemory.mu.Unlock()

	assert.Equal(t, int64(1), strikes)
	assert.Equal(t, http.StatusTooManyRequests, recorder.Code)
	assert.Equal(t, "60", recorder.Header().Get("Retry-After"))
}
