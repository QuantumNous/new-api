package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/go-redis/redis/v8"
)

// ---------------------------------------------------------------------------
// 订阅用量窗口（5h 滚动分桶 + 周锚定周期）
//
// 计数单位 = 加权额度（quota units × 模型权重）。Redis 原子 Lua 完成
// "读和 + 判限 + 累加"，多节点安全（Rule 11）。Redis 不可用或计数丢失时
// fail-open（放行）——月池仍是硬闸，窗口只偏松不偏紧。
// ---------------------------------------------------------------------------

const (
	subscriptionWindowBucketSeconds = 1800          // 5h 窗分桶粒度 30min
	subscriptionWindow5hSeconds     = 5 * 3600      // 滚动窗长度
	subscriptionWindowBucketCount   = 11            // 当前桶 + 前 10 桶
	subscriptionWindowWeekSeconds   = 7 * 24 * 3600 // 周窗周期（按订阅起始锚定）
	subscriptionWindowBucketTTL     = subscriptionWindow5hSeconds + 2*subscriptionWindowBucketSeconds
)

// ErrSubscriptionWindowExceeded is the sentinel for window-limit rejections;
// billing_session maps it to an insufficient-quota error so subscription_first
// falls back to wallet automatically.
var ErrSubscriptionWindowExceeded = errors.New("subscription window exceeded")

// SubscriptionWindowUsage is the read-only usage snapshot shown in the wallet.
// Counters use the same weighted quota units as enforcement.
type SubscriptionWindowUsage struct {
	Window5hUsed      int64 `json:"window_5h_used"`
	Window5hResetAt   int64 `json:"window_5h_reset_at"`
	WindowWeekUsed    int64 `json:"window_week_used"`
	WindowWeekResetAt int64 `json:"window_week_reset_at"`
}

type subscriptionWindowExceededError struct {
	Window  string // "5h" | "week"
	ResetAt int64  // unix seconds; for 5h this is the next bucket rotation
}

func (e *subscriptionWindowExceededError) Error() string {
	return fmt.Sprintf("subscription window exceeded: window=%s reset_at=%d", e.Window, e.ResetAt)
}

func (e *subscriptionWindowExceededError) Unwrap() error { return ErrSubscriptionWindowExceeded }

// subscriptionWindowReserveScript: 原子完成两层窗口的读和+判限+累加。
// KEYS[1]=周窗 key，KEYS[2..12]=5h 分桶 key（KEYS[12]=当前桶）
// ARGV: 1=amount 2=limit5h 3=limitWeek 4=bucketTTL 5=weekExpireAt
// 返回 {1,0} 允许；{0,1} 5h 超限；{0,2} 周超限
var subscriptionWindowReserveScript = redis.NewScript(`
local amount = tonumber(ARGV[1])
local limit5h = tonumber(ARGV[2])
local limitWeek = tonumber(ARGV[3])
local bucketTTL = tonumber(ARGV[4])
local weekExpireAt = tonumber(ARGV[5])

if limit5h > 0 then
  local sum = 0
  for i = 2, 12 do
    local v = redis.call('GET', KEYS[i])
    if v then sum = sum + tonumber(v) end
  end
  if sum + amount > limit5h then return {0, 1} end
end
if limitWeek > 0 then
  local wv = redis.call('GET', KEYS[1])
  local wnum = 0
  if wv then wnum = tonumber(wv) end
  if wnum + amount > limitWeek then return {0, 2} end
end
if limit5h > 0 then
  redis.call('INCRBY', KEYS[12], amount)
  redis.call('EXPIRE', KEYS[12], bucketTTL)
end
if limitWeek > 0 then
  redis.call('INCRBY', KEYS[1], amount)
  redis.call('EXPIREAT', KEYS[1], weekExpireAt)
end
return {1, 0}
`)

var taskSettlementWindowScript = redis.NewScript(`
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
local count = tonumber(ARGV[1])
local arg = 2
for i = 1, count do
  local delta = tonumber(ARGV[arg])
  local expireMode = tonumber(ARGV[arg + 1])
  local expireValue = tonumber(ARGV[arg + 2])
  redis.call('INCRBY', KEYS[i + 1], delta)
  if expireMode == 1 then
    redis.call('EXPIRE', KEYS[i + 1], expireValue)
  elseif expireMode == 2 then
    redis.call('EXPIREAT', KEYS[i + 1], expireValue)
  end
  arg = arg + 3
end
redis.call('SET', KEYS[1], '1', 'EX', 604800)
return 1
`)

// ApplyTaskSettlementSubscriptionWindow applies one task settlement delta and
// its deterministic marker in the same Redis script. Replaying the same
// settlement ID from another node is therefore a no-op.
func ApplyTaskSettlementSubscriptionWindow(settlementID int64, snap *model.TaskSubscriptionWindow, delta int64) error {
	if settlementID <= 0 || snap == nil || delta == 0 || !common.RedisEnabled || common.RDB == nil {
		return nil
	}

	type operation struct {
		key         string
		delta       int64
		expireMode  int
		expireValue int64
	}
	operations := make([]operation, 0, 2)
	if delta > 0 {
		now := common.GetTimestamp()
		if snap.Limit5h > 0 {
			currentBucket := now / subscriptionWindowBucketSeconds * subscriptionWindowBucketSeconds
			operations = append(operations, operation{
				key:         subscriptionWindowBucketKey(snap.SubId, currentBucket),
				delta:       delta,
				expireMode:  1,
				expireValue: subscriptionWindowBucketTTL,
			})
		}
		if snap.LimitWeek > 0 {
			idx := subscriptionWindowWeekIndex(snap.SubStart, now)
			base := snap.SubStart
			if base < 0 {
				base = 0
			}
			operations = append(operations, operation{
				key:         subscriptionWindowWeekKey(snap.SubId, idx),
				delta:       delta,
				expireMode:  2,
				expireValue: base + (idx+1)*subscriptionWindowWeekSeconds + 3600,
			})
		}
	} else {
		for _, held := range []map[string]int64{snap.BucketHeld, snap.WeekHeld} {
			keys := make([]string, 0, len(held))
			for key := range held {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			refund := -delta
			for _, key := range keys {
				if refund == 0 {
					break
				}
				take := held[key]
				if take > refund {
					take = refund
				}
				if take > 0 {
					operations = append(operations, operation{key: key, delta: -take})
					refund -= take
				}
			}
		}
	}

	keys := []string{fmt.Sprintf("task:settlement:window:%d", settlementID)}
	args := []any{len(operations)}
	for _, operation := range operations {
		keys = append(keys, operation.key)
		args = append(args, operation.delta, operation.expireMode, operation.expireValue)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return taskSettlementWindowScript.Run(ctx, common.RDB, keys, args...).Err()
}

// subscriptionWindowGuard tracks a successful window reservation so that
// settle deltas and refunds can be written back to the same counters.
// bucketHeld/weekHeld record exactly which Redis keys this request debited
// (a long-lived request can cross bucket/week boundaries), so refunds credit
// the original keys instead of whatever key the current wall clock maps to.
type subscriptionWindowGuard struct {
	subId     int
	subStart  int64
	limit5h   int64
	limitWeek int64
	// mu serializes all state access: settle adjustments run on the request
	// goroutine while refunds run on a detached goroutine (BillingSession
	// refund is async), so unsynchronized map/flag access would race.
	mu         sync.Mutex
	reserved   int64 // weighted units currently held by this request
	released   bool
	bucketHeld map[string]int64 // 5h bucket key -> weighted units held
	weekHeld   map[string]int64 // week key -> weighted units held
}

func subscriptionWindowBucketKey(subId int, bucketTs int64) string {
	return fmt.Sprintf("sub:win:5h:%d:%d", subId, bucketTs)
}

func subscriptionWindowWeekIndex(subStart, now int64) int64 {
	if subStart <= 0 || now <= subStart {
		return 0
	}
	return (now - subStart) / subscriptionWindowWeekSeconds
}

func subscriptionWindowWeekKey(subId int, idx int64) string {
	return fmt.Sprintf("sub:win:w:%d:%d", subId, idx)
}

func subscriptionWindowKeys(info *model.SubscriptionWindowInfo, now int64) (weekKey string, bucketKeys []string, weekExpireAt int64) {
	idx := subscriptionWindowWeekIndex(info.SubscriptionStart, now)
	identity := info.WindowIdentity()
	weekKey = subscriptionWindowWeekKey(identity, idx)
	base := info.SubscriptionStart
	if base <= 0 {
		base = 0
	}
	weekExpireAt = base + (idx+1)*subscriptionWindowWeekSeconds + 3600

	currentBucket := now / subscriptionWindowBucketSeconds * subscriptionWindowBucketSeconds
	bucketKeys = make([]string, 0, subscriptionWindowBucketCount)
	for i := subscriptionWindowBucketCount - 1; i >= 0; i-- {
		ts := currentBucket - int64(i)*subscriptionWindowBucketSeconds
		bucketKeys = append(bucketKeys, subscriptionWindowBucketKey(identity, ts))
	}
	return weekKey, bucketKeys, weekExpireAt
}

// GetSubscriptionWindowUsage reads the same Redis counters used by the window
// guard. When Redis is disabled or temporarily unavailable, limits remain
// visible and usage safely falls back to zero; the monthly database counter is
// still authoritative and is returned separately by the subscription API.
func GetSubscriptionWindowUsage(info *model.SubscriptionWindowInfo) SubscriptionWindowUsage {
	usage := SubscriptionWindowUsage{}
	if info == nil {
		return usage
	}

	now := common.GetTimestamp()
	weekKey, bucketKeys, _ := subscriptionWindowKeys(info, now)
	usage.Window5hResetAt = (now/subscriptionWindowBucketSeconds + 1) * subscriptionWindowBucketSeconds
	idx := subscriptionWindowWeekIndex(info.SubscriptionStart, now)
	usage.WindowWeekResetAt = info.SubscriptionStart + (idx+1)*subscriptionWindowWeekSeconds

	if !common.RedisEnabled || common.RDB == nil {
		return usage
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pipe := common.RDB.Pipeline()
	fiveHourValues := pipe.MGet(ctx, bucketKeys...)
	weekValue := pipe.Get(ctx, weekKey)
	if _, err := pipe.Exec(ctx); err != nil && !errors.Is(err, redis.Nil) {
		common.SysLog("subscription window usage query failed (showing zero): " + err.Error())
		return usage
	}

	for _, raw := range fiveHourValues.Val() {
		switch value := raw.(type) {
		case string:
			if parsed, err := strconv.ParseInt(value, 10, 64); err == nil {
				usage.Window5hUsed += parsed
			}
		case int64:
			usage.Window5hUsed += value
		}
	}
	if value, err := weekValue.Int64(); err == nil {
		usage.WindowWeekUsed = value
	}
	return usage
}

// reserveSubscriptionWindows checks both usage windows and atomically reserves
// the weighted amount. Returns (nil, nil) when windows are disabled or Redis is
// unavailable (fail-open: monthly pool remains the hard cap).
func reserveSubscriptionWindows(info *model.SubscriptionWindowInfo, weightedAmount int64) (*subscriptionWindowGuard, error) {
	if info == nil || weightedAmount <= 0 {
		return nil, nil
	}
	if info.Window5hAmount <= 0 && info.WindowWeekAmount <= 0 {
		return nil, nil
	}
	if !common.RedisEnabled || common.RDB == nil {
		return nil, nil
	}

	now := common.GetTimestamp()
	weekKey, bucketKeys, weekExpireAt := subscriptionWindowKeys(info, now)
	keys := append([]string{weekKey}, bucketKeys...)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	res, err := subscriptionWindowReserveScript.Run(ctx, common.RDB, keys,
		weightedAmount, info.Window5hAmount, info.WindowWeekAmount,
		subscriptionWindowBucketTTL, weekExpireAt).Result()
	if err != nil {
		// fail-open：Redis 异常时放行，仅记录日志
		common.SysLog("subscription window check failed (fail-open): " + err.Error())
		return nil, nil
	}

	vals, ok := res.([]interface{})
	if !ok || len(vals) < 2 {
		common.SysLog(fmt.Sprintf("subscription window script returned unexpected result (fail-open): %v", res))
		return nil, nil
	}
	allowed, _ := vals[0].(int64)
	which, _ := vals[1].(int64)
	if allowed == 1 {
		guard := &subscriptionWindowGuard{
			subId:      info.WindowIdentity(),
			subStart:   info.SubscriptionStart,
			limit5h:    info.Window5hAmount,
			limitWeek:  info.WindowWeekAmount,
			reserved:   weightedAmount,
			bucketHeld: map[string]int64{},
			weekHeld:   map[string]int64{},
		}
		if info.Window5hAmount > 0 {
			// KEYS[12] in the reserve script — the current bucket.
			guard.bucketHeld[bucketKeys[len(bucketKeys)-1]] = weightedAmount
		}
		if info.WindowWeekAmount > 0 {
			guard.weekHeld[weekKey] = weightedAmount
		}
		return guard, nil
	}
	if which == 2 {
		idx := subscriptionWindowWeekIndex(info.SubscriptionStart, now)
		resetAt := info.SubscriptionStart + (idx+1)*subscriptionWindowWeekSeconds
		return nil, &subscriptionWindowExceededError{Window: "week", ResetAt: resetAt}
	}
	nextRotation := (now/subscriptionWindowBucketSeconds + 1) * subscriptionWindowBucketSeconds
	return nil, &subscriptionWindowExceededError{Window: "5h", ResetAt: nextRotation}
}

// Adjust writes a settle delta (positive or negative) back to the window
// counters. No-op once the guard has been released — Release() already
// returned the full remaining reservation, so any later adjust would corrupt
// the shared counters (e.g. Refund() then RefundExtra() double-crediting).
// Best-effort: errors are logged and tolerated (fail-open drift).
func (g *subscriptionWindowGuard) Adjust(delta int64) {
	if g == nil || delta == 0 {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.released {
		return
	}
	_ = g.apply(delta) // apply logs; window drift is fail-open by design
}

// Release returns the full remaining reservation (refund path). Idempotent.
func (g *subscriptionWindowGuard) Release() {
	if g == nil {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.released {
		return
	}
	g.released = true
	if g.reserved > 0 {
		_ = g.apply(-g.reserved)
	}
}

// Snapshot exports the guard's held-key ledger for persistence (async tasks
// settle minutes later in another goroutine/process moment; the snapshot lets
// them credit the exact keys this request debited). Returns nil when nothing
// is held.
func (g *subscriptionWindowGuard) Snapshot() *model.TaskSubscriptionWindow {
	if g == nil {
		return nil
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.released || g.reserved <= 0 {
		return nil
	}
	snap := &model.TaskSubscriptionWindow{
		SubId:     g.subId,
		SubStart:  g.subStart,
		Limit5h:   g.limit5h,
		LimitWeek: g.limitWeek,
	}
	if len(g.bucketHeld) > 0 {
		snap.BucketHeld = make(map[string]int64, len(g.bucketHeld))
		for k, v := range g.bucketHeld {
			snap.BucketHeld[k] = v
		}
	}
	if len(g.weekHeld) > 0 {
		snap.WeekHeld = make(map[string]int64, len(g.weekHeld))
		for k, v := range g.weekHeld {
			snap.WeekHeld[k] = v
		}
	}
	return snap
}

// AdjustSubscriptionWindowFromSnapshot applies an async settle delta to the
// window counters using a persisted guard snapshot. Positive deltas debit the
// counters the current wall clock maps to; negative deltas credit only the
// snapshot's original keys, capped at the held amounts. On success the
// snapshot's held maps are updated in place (changed=true) so the caller can
// re-persist them alongside its own task-state update; on error the ledger is
// untouched and the caller decides whether to retry within its idempotent
// flow. Window counters remain advisory fail-open by design — the monthly
// pool is the hard cap, and bucket TTL / week rollover bound any drift.
func AdjustSubscriptionWindowFromSnapshot(snap *model.TaskSubscriptionWindow, delta int64) (bool, error) {
	if snap == nil || delta == 0 {
		return false, nil
	}
	if snap.BucketHeld == nil {
		snap.BucketHeld = map[string]int64{}
	}
	if snap.WeekHeld == nil {
		snap.WeekHeld = map[string]int64{}
	}
	reserved := int64(0)
	for _, v := range snap.BucketHeld {
		reserved += v
	}
	if reserved == 0 {
		for _, v := range snap.WeekHeld {
			reserved += v
		}
	}
	guard := &subscriptionWindowGuard{
		subId:      snap.SubId,
		subStart:   snap.SubStart,
		limit5h:    snap.Limit5h,
		limitWeek:  snap.LimitWeek,
		reserved:   reserved,
		bucketHeld: snap.BucketHeld,
		weekHeld:   snap.WeekHeld,
	}
	if err := guard.apply(delta); err != nil {
		return false, err
	}
	return true, nil
}

// apply performs the Redis writes for a delta; callers must hold g.mu (or
// own the guard exclusively). Positive deltas debit the counters the current
// wall clock maps to and are recorded in the held ledgers; negative deltas
// credit only keys this guard actually debited, capped at the held amounts,
// so refunds can neither hit a foreign bucket/week key nor drive a counter
// negative. Ledger/reserved update only after a successful pipeline exec —
// a partially-applied failed pipeline leaves the ledger conservative (may
// re-credit less than debited), which is the fail-open direction; bucket TTL
// and week rollover bound any residual drift.
func (g *subscriptionWindowGuard) apply(delta int64) error {
	if !common.RedisEnabled || common.RDB == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	pipe := common.RDB.Pipeline()

	type heldChange struct {
		held map[string]int64
		key  string
		take int64
	}
	var changes []heldChange

	if delta > 0 {
		now := common.GetTimestamp()
		if g.limit5h > 0 {
			currentBucket := now / subscriptionWindowBucketSeconds * subscriptionWindowBucketSeconds
			bucketKey := subscriptionWindowBucketKey(g.subId, currentBucket)
			pipe.IncrBy(ctx, bucketKey, delta)
			pipe.Expire(ctx, bucketKey, time.Duration(subscriptionWindowBucketTTL)*time.Second)
			changes = append(changes, heldChange{g.bucketHeld, bucketKey, delta})
		}
		if g.limitWeek > 0 {
			idx := subscriptionWindowWeekIndex(g.subStart, now)
			weekKey := subscriptionWindowWeekKey(g.subId, idx)
			base := g.subStart
			if base <= 0 {
				base = 0
			}
			pipe.IncrBy(ctx, weekKey, delta)
			pipe.ExpireAt(ctx, weekKey, time.Unix(base+(idx+1)*subscriptionWindowWeekSeconds+3600, 0))
			changes = append(changes, heldChange{g.weekHeld, weekKey, delta})
		}
	} else {
		for _, held := range []map[string]int64{g.bucketHeld, g.weekHeld} {
			refund := -delta
			for key, amt := range held {
				if refund <= 0 {
					break
				}
				take := amt
				if take > refund {
					take = refund
				}
				pipe.DecrBy(ctx, key, take)
				changes = append(changes, heldChange{held, key, -take})
				refund -= take
			}
		}
	}

	if len(changes) == 0 {
		return nil
	}
	if _, err := pipe.Exec(ctx); err != nil {
		common.SysLog("subscription window adjust failed (tolerated): " + err.Error())
		return err
	}
	for _, ch := range changes {
		ch.held[ch.key] += ch.take
		if ch.held[ch.key] <= 0 {
			delete(ch.held, ch.key)
		}
	}
	g.reserved += delta
	if g.reserved < 0 {
		g.reserved = 0
	}
	return nil
}
