package model

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/samber/hot"
)

const (
	codingPlanCacheNamespace cachex.Namespace = "volcengine_coding_plan:v1"
	codingPlanProbeLease                      = 30 * time.Second
)

// CodingPlanPool identifies channels sharing a Volcengine subscription.
// Set the same coding-plan:<pool> channel tag on channels sharing a subscription.
func (channel *Channel) CodingPlanPool() string {
	baseURL := channel.GetBaseURL()
	if channel.Type != constant.ChannelTypeVolcEngine || !constant.IsVolcenginePlanBaseURL(baseURL) {
		return ""
	}
	prefix := ""
	if baseURL == constant.VolcengineTokenPlanBaseURL {
		prefix = "token-plan:"
	}
	if pool, ok := strings.CutPrefix(channel.GetTag(), "coding-plan:"); ok {
		if pool = strings.TrimSpace(pool); pool != "" {
			return prefix + "subscription:" + pool
		}
	}
	return prefix + "channel:" + strconv.Itoa(channel.Id)
}

type CodingPlanStatus struct {
	State   string `json:"state"`
	RetryAt int64  `json:"retry_at,omitempty"`
}

func (channel *Channel) GetCodingPlanStatus() *CodingPlanStatus {
	pool := channel.CodingPlanPool()
	if pool == "" {
		return nil
	}
	status := GetCodingPlanStatus(pool)
	if blocked, until := channel.CodingPlanChannelBlocked(); status.State != "exhausted" && blocked {
		return &CodingPlanStatus{State: "cooldown", RetryAt: until.Unix()}
	}
	return status
}

func GetCodingPlanStatus(pool string) *CodingPlanStatus {
	state := codingPlanState(pool)
	status := &CodingPlanStatus{State: "available"}
	if state == "" {
		return status
	}
	blocked, retryAt := codingPlanBlockedAt(state, time.Now())
	if !blocked {
		status.State = "recovering"
		return status
	}
	status.State = "exhausted"
	if !retryAt.IsZero() {
		status.RetryAt = retryAt.Unix()
	}
	return status
}

var (
	codingPlanMemory   = hot.NewHotCache[string, string](hot.LRU, 4096).Build()
	codingPlanMemoryMu sync.Mutex
)

func codingPlanState(pool string) string {
	key := codingPlanCacheNamespace.FullKey(pool)
	if common.RedisEnabled && common.RDB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()
		if value, err := common.RDB.Get(ctx, key).Result(); err == nil {
			return value
		}
	}
	value, _, _ := codingPlanMemory.Get(key)
	return value
}

// CodingPlanBlocked reports whether a subscription is cooling down. A zero
// retry time means the upstream did not supply a usable Retry-After.
func CodingPlanBlocked(pool string) (bool, time.Time) {
	return codingPlanBlockedAt(codingPlanState(pool), time.Now())
}

func codingPlanBlockedAt(value string, now time.Time) (bool, time.Time) {
	timestamp, _ := strconv.ParseInt(value, 10, 64)
	if timestamp < 0 {
		return now.Before(time.Unix(0, -timestamp)), time.Time{}
	}
	if at := time.Unix(0, timestamp); now.Before(at) {
		return true, at
	}
	return false, time.Time{}
}

func (channel *Channel) codingPlanRouteKey() string {
	return "route:" + strconv.Itoa(channel.Id) + ":" + channel.CodingPlanPool()
}

func (channel *Channel) CodingPlanChannelBlocked() (bool, time.Time) {
	return CodingPlanBlocked(channel.codingPlanRouteKey())
}

func (channel *Channel) CoolDownCodingPlanChannel(delay time.Duration) {
	if delay <= 0 {
		delay = 3 * time.Second
	}
	CoolDownCodingPlan(channel.codingPlanRouteKey(), min(delay, 5*time.Minute))
}

func CoolDownCodingPlan(pool string, cooldown time.Duration) {
	known := cooldown > 0
	if !known {
		cooldown = time.Minute
	}
	timestamp := time.Now().Add(cooldown).UnixNano()
	if !known {
		timestamp = -timestamp
	}
	key := codingPlanCacheNamespace.FullKey(pool)
	value := strconv.FormatInt(timestamp, 10)
	ttl := cooldown + 5*time.Minute
	if common.RedisEnabled && common.RDB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()
		// Compare seconds using decimal strings. Redis Lua numbers cannot represent
		// nanosecond Unix timestamps exactly.
		const extend = `
   local current = redis.call('GET', KEYS[1])
   local function absolute(s) return string.gsub(s, '^%-', '') end
   if not current or absolute(current) < absolute(ARGV[1]) then
    redis.call('PSETEX', KEYS[1], ARGV[2], ARGV[1])
   end
   return 1
  `
		if err := common.RDB.Eval(ctx, extend, []string{key}, value, ttl.Milliseconds()).Err(); err == nil {
			return
		} else {
			common.SysError("Failed to share Coding Plan cooldown: " + err.Error())
		}
	}
	codingPlanMemoryMu.Lock()
	defer codingPlanMemoryMu.Unlock()
	previous, _, _ := codingPlanMemory.Get(key)
	if strings.TrimPrefix(previous, "-") < strings.TrimPrefix(value, "-") {
		codingPlanMemory.SetWithTTL(key, value, ttl)
	}
}

// AcquireCodingPlanProbe gates recovery traffic across instances when Redis is
// configured. An empty state means the healthy path does not need a lease.
func AcquireCodingPlanProbe(ctx context.Context, pool string) (state string, allowed bool) {
	state = codingPlanState(pool)
	timestamp, _ := strconv.ParseInt(strings.TrimPrefix(state, "-"), 10, 64)
	if timestamp == 0 {
		return "", true
	}
	if time.Now().Before(time.Unix(0, timestamp)) {
		return "", false
	}
	key := codingPlanCacheNamespace.FullKey("probe:" + pool)
	if common.RedisEnabled && common.RDB != nil {
		ctx, cancel := context.WithTimeout(ctx, 200*time.Millisecond)
		defer cancel()
		acquired, err := common.RDB.SetNX(ctx, key, state, codingPlanProbeLease).Result()
		return state, err == nil && acquired
	}
	codingPlanMemoryMu.Lock()
	defer codingPlanMemoryMu.Unlock()
	if _, found, _ := codingPlanMemory.Get(key); found {
		return "", false
	}
	codingPlanMemory.SetWithTTL(key, state, codingPlanProbeLease)
	return state, true
}

func CompleteCodingPlanProbe(ctx context.Context, pool, state string) {
	if state == "" {
		return
	}
	key := codingPlanCacheNamespace.FullKey(pool)
	if common.RedisEnabled && common.RDB != nil {
		ctx, cancel := context.WithTimeout(ctx, 200*time.Millisecond)
		defer cancel()
		const clear = `
   if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
   end
   return 0
  `
		_ = common.RDB.Eval(ctx, clear, []string{key}, state).Err()
		return
	}
	codingPlanMemoryMu.Lock()
	defer codingPlanMemoryMu.Unlock()
	if current, _, _ := codingPlanMemory.Get(key); current == state {
		codingPlanMemory.Delete(key)
	}
}
