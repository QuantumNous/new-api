package model

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

const (
	subscriptionWindowCounterBackendDB          = "db"
	subscriptionWindowCounterBackendRedisBucket = "redis_bucket"

	subscriptionWindowRedisFallbackDB   = "db"
	subscriptionWindowRedisFallbackDeny = "deny"

	subscriptionWindowDefaultBucketSeconds = int64(300)
	subscriptionWindowRedisTTLSeconds      = int64(31 * 86400)
	subscriptionWindowRedisTimeout         = 2 * time.Second
)

type subscriptionWindowRedisBucketDelta struct {
	userSubscriptionId int
	bucketStart        int64
	delta              int64
}

const subscriptionWindowRedisReserveScript = `
local idx_key = KEYS[1]
local amt_key = KEYS[2]
local now = tonumber(ARGV[1])
local bucket_seconds = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local ttl_seconds = tonumber(ARGV[4])
local window_count = tonumber(ARGV[5])

if requested <= 0 or window_count <= 0 then
  return {0, 0, '', 0, 0}
end

local current_bucket = now - (now % bucket_seconds)
local windows = {}
local min_since_bucket = current_bucket
local arg = 6
for i = 1, window_count do
  local since_bucket = tonumber(ARGV[arg])
  local limit = tonumber(ARGV[arg + 1])
  local name = ARGV[arg + 2]
  arg = arg + 3
  windows[i] = {since_bucket = since_bucket, limit = limit, used = 0, name = name}
  if since_bucket < min_since_bucket then
    min_since_bucket = since_bucket
  end
end

local old_buckets = redis.call('ZRANGEBYSCORE', idx_key, '-inf', min_since_bucket - 1)
if #old_buckets > 0 then
  for start = 1, #old_buckets, 500 do
    local stop = math.min(start + 499, #old_buckets)
    redis.call('HDEL', amt_key, unpack(old_buckets, start, stop))
  end
  redis.call('ZREMRANGEBYSCORE', idx_key, '-inf', min_since_bucket - 1)
end

local buckets = redis.call('ZRANGEBYSCORE', idx_key, min_since_bucket, '+inf')
if #buckets > 0 then
  for start = 1, #buckets, 500 do
    local stop = math.min(start + 499, #buckets)
    local amounts = redis.call('HMGET', amt_key, unpack(buckets, start, stop))
    for offset, amount_value in ipairs(amounts) do
      local bucket = buckets[start + offset - 1]
      local bucket_start = tonumber(bucket)
      local amount = tonumber(amount_value) or 0
      if amount ~= 0 then
        for j, window in ipairs(windows) do
          if bucket_start >= window.since_bucket then
            window.used = window.used + amount
          end
        end
      end
    end
  end
end

local allowed_amount = requested
local constrained_window = ''
for i, window in ipairs(windows) do
  local remaining = window.limit - window.used
  if remaining <= 0 then
    return {0, 0, window.name, current_bucket, remaining}
  end
  if remaining < allowed_amount then
    allowed_amount = remaining
    constrained_window = window.name
  end
end

if allowed_amount <= 0 then
  return {0, 0, constrained_window, current_bucket, allowed_amount}
end

redis.call('ZADD', idx_key, current_bucket, tostring(current_bucket))
redis.call('HINCRBY', amt_key, tostring(current_bucket), allowed_amount)
redis.call('EXPIRE', idx_key, ttl_seconds)
redis.call('EXPIRE', amt_key, ttl_seconds)
return {1, allowed_amount, constrained_window, current_bucket, allowed_amount}
`

const subscriptionWindowRedisApplyDeltaScript = `
local idx_key = KEYS[1]
local amt_key = KEYS[2]
local bucket_start = tonumber(ARGV[1])
local delta = tonumber(ARGV[2])
local ttl_seconds = tonumber(ARGV[3])

if delta == 0 then
  return 0
end

local field = tostring(bucket_start)
local current_amount = tonumber(redis.call('HGET', amt_key, field)) or 0
local applied_delta = delta
if delta < 0 and current_amount + delta < 0 then
  applied_delta = -current_amount
end
if applied_delta == 0 then
  return 0
end
local next_amount = redis.call('HINCRBY', amt_key, field, applied_delta)
if next_amount <= 0 then
  redis.call('HDEL', amt_key, field)
  redis.call('ZREM', idx_key, field)
else
  redis.call('ZADD', idx_key, bucket_start, field)
  redis.call('EXPIRE', idx_key, ttl_seconds)
  redis.call('EXPIRE', amt_key, ttl_seconds)
end
return applied_delta
`

func subscriptionWindowCounterBackend() string {
	backend := strings.ToLower(strings.TrimSpace(common.GetEnvOrDefaultString("SUBSCRIPTION_WINDOW_COUNTER_BACKEND", subscriptionWindowCounterBackendDB)))
	if backend == subscriptionWindowCounterBackendRedisBucket {
		return backend
	}
	return subscriptionWindowCounterBackendDB
}

func subscriptionWindowRedisFallback() string {
	fallback := strings.ToLower(strings.TrimSpace(common.GetEnvOrDefaultString("SUBSCRIPTION_WINDOW_REDIS_FALLBACK", subscriptionWindowRedisFallbackDB)))
	if fallback == subscriptionWindowRedisFallbackDeny {
		return fallback
	}
	return subscriptionWindowRedisFallbackDB
}

func subscriptionWindowBucketSeconds() int64 {
	seconds := int64(common.GetEnvOrDefault("SUBSCRIPTION_WINDOW_BUCKET_SECONDS", int(subscriptionWindowDefaultBucketSeconds)))
	if seconds <= 0 {
		return subscriptionWindowDefaultBucketSeconds
	}
	return seconds
}

func subscriptionWindowRedisBucketEnabled() bool {
	return subscriptionWindowCounterBackend() == subscriptionWindowCounterBackendRedisBucket
}

func subscriptionWindowRedisReady() bool {
	return common.RedisEnabled && common.RDB != nil
}

func subscriptionWindowBucketStart(ts int64, bucketSeconds int64) int64 {
	if bucketSeconds <= 0 {
		bucketSeconds = subscriptionWindowDefaultBucketSeconds
	}
	return ts - (ts % bucketSeconds)
}

func subscriptionWindowRedisKeys(userSubscriptionId int) (string, string) {
	return fmt.Sprintf("subwin:{%d}:idx", userSubscriptionId), fmt.Sprintf("subwin:{%d}:amt", userSubscriptionId)
}

func subscriptionWindowRedisMetaKey(userSubscriptionId int) string {
	return fmt.Sprintf("subwin:{%d}:meta", userSubscriptionId)
}

func subscriptionWindowRedisContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), subscriptionWindowRedisTimeout)
}

func reserveSubscriptionWindowRedisBucketTx(tx *gorm.DB, sub *UserSubscription, plan *SubscriptionPlan, requested int64, now int64) (int64, *subscriptionWindowRedisBucketDelta, error) {
	if requested <= 0 {
		return 0, nil, nil
	}
	defs := buildSubscriptionWindowDefs(plan, now, true)
	if len(defs) == 0 || !subscriptionWindowRedisBucketEnabled() {
		return requested, nil, nil
	}
	if sub == nil || sub.Id <= 0 {
		return 0, nil, errors.New("invalid userSubscription")
	}
	if !subscriptionWindowRedisReady() {
		return fallbackSubscriptionWindowRedisReserveTx(tx, sub, plan, requested, errors.New("Redis is not enabled"))
	}

	ctx, cancel := subscriptionWindowRedisContext()
	defer cancel()

	if err := ensureSubscriptionWindowRedisBucketTx(ctx, tx, sub.Id, now); err != nil {
		return fallbackSubscriptionWindowRedisReserveTx(tx, sub, plan, requested, err)
	}

	bucketSeconds := subscriptionWindowBucketSeconds()
	args := make([]interface{}, 0, 5+len(defs)*3)
	args = append(args, now, bucketSeconds, requested, subscriptionWindowRedisTTLSeconds, len(defs))
	for _, def := range defs {
		args = append(args, subscriptionWindowBucketStart(def.since, bucketSeconds), def.limit, def.key)
	}
	idxKey, amtKey := subscriptionWindowRedisKeys(sub.Id)
	raw, err := common.RDB.Eval(ctx, subscriptionWindowRedisReserveScript, []string{idxKey, amtKey}, args...).Result()
	if err != nil {
		return fallbackSubscriptionWindowRedisReserveTx(tx, sub, plan, requested, err)
	}
	values, ok := raw.([]interface{})
	if !ok || len(values) < 5 {
		return fallbackSubscriptionWindowRedisReserveTx(tx, sub, plan, requested, fmt.Errorf("unexpected Redis reserve response: %T", raw))
	}
	allowed, err := redisEvalInt64(values[0])
	if err != nil {
		return fallbackSubscriptionWindowRedisReserveTx(tx, sub, plan, requested, err)
	}
	reserved, err := redisEvalInt64(values[1])
	if err != nil {
		return fallbackSubscriptionWindowRedisReserveTx(tx, sub, plan, requested, err)
	}
	if allowed == 0 || reserved <= 0 {
		return 0, nil, nil
	}
	bucketStart, err := redisEvalInt64(values[3])
	if err != nil {
		return fallbackSubscriptionWindowRedisReserveTx(tx, sub, plan, requested, err)
	}
	return reserved, &subscriptionWindowRedisBucketDelta{userSubscriptionId: sub.Id, bucketStart: bucketStart, delta: reserved}, nil
}

func fallbackSubscriptionWindowRedisReserveTx(tx *gorm.DB, sub *UserSubscription, plan *SubscriptionPlan, requested int64, cause error) (int64, *subscriptionWindowRedisBucketDelta, error) {
	if subscriptionWindowRedisFallback() == subscriptionWindowRedisFallbackDeny {
		return 0, nil, fmt.Errorf("subscription window Redis bucket unavailable: %w", cause)
	}
	common.SysError(fmt.Sprintf("subscription window Redis bucket fallback to DB: %v", cause))
	available := getSubscriptionAvailableAmountWithPlanTx(tx, sub, plan)
	if available > requested {
		available = requested
	}
	if available < 0 {
		available = 0
	}
	return available, nil, nil
}

func ensureSubscriptionWindowRedisBucketTx(ctx context.Context, tx *gorm.DB, userSubscriptionId int, now int64) error {
	idxKey, amtKey := subscriptionWindowRedisKeys(userSubscriptionId)
	metaKey := subscriptionWindowRedisMetaKey(userSubscriptionId)
	dbWatermark, hasRows, err := subscriptionWindowRedisWatermarkTx(tx, userSubscriptionId, now)
	if err != nil {
		return err
	}
	redisWatermark, err := common.RDB.Get(ctx, metaKey).Result()
	if err == nil && redisWatermark == dbWatermark {
		exists, err := common.RDB.Exists(ctx, idxKey, amtKey).Result()
		if err != nil {
			return err
		}
		if !hasRows && exists == 0 {
			return nil
		}
		if hasRows && exists == 2 {
			return nil
		}
	} else if err != nil && err != redis.Nil {
		return err
	}
	return rebuildSubscriptionWindowRedisBucketTx(ctx, tx, userSubscriptionId, now, dbWatermark)
}

func rebuildSubscriptionWindowRedisBucketTx(ctx context.Context, tx *gorm.DB, userSubscriptionId int, now int64, dbWatermark string) error {
	if userSubscriptionId <= 0 {
		return errors.New("invalid userSubscriptionId")
	}
	query := DB
	if tx != nil {
		query = tx
	}
	bucketSeconds := subscriptionWindowBucketSeconds()
	minSince := subscriptionWindowBucketStart(now-30*86400, bucketSeconds)
	bucketAmounts := make(map[int64]int64)

	scanTable := func(table string, excludeExistingDetails bool) error {
		rows, err := query.Table(table).
			Where("user_subscription_id = ? AND status = ? AND created_at >= ?", userSubscriptionId, "consumed", minSince).
			Scopes(func(db *gorm.DB) *gorm.DB {
				if !excludeExistingDetails {
					return db
				}
				return db.Where("NOT EXISTS (?)", query.Model(&SubscriptionPreConsumeDetail{}).Select("1").Where("subscription_pre_consume_details.request_id = subscription_pre_consume_records.request_id"))
			}).
			Select("created_at, pre_consumed").
			Rows()
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var createdAt int64
			var preConsumed int64
			if err := rows.Scan(&createdAt, &preConsumed); err != nil {
				return err
			}
			if preConsumed <= 0 {
				continue
			}
			bucketStart := subscriptionWindowBucketStart(createdAt, bucketSeconds)
			bucketAmounts[bucketStart] += preConsumed
		}
		return rows.Err()
	}

	if err := scanTable("subscription_pre_consume_details", false); err != nil {
		return err
	}
	if subscriptionLegacyWindowUsageEnabled() {
		if err := scanTable("subscription_pre_consume_records", true); err != nil {
			return err
		}
	}

	idxKey, amtKey := subscriptionWindowRedisKeys(userSubscriptionId)
	metaKey := subscriptionWindowRedisMetaKey(userSubscriptionId)
	pipe := common.RDB.TxPipeline()
	pipe.Del(ctx, idxKey, amtKey, metaKey)
	if len(bucketAmounts) > 0 {
		hashValues := make(map[string]interface{}, len(bucketAmounts))
		zItems := make([]*redis.Z, 0, len(bucketAmounts))
		for bucketStart, amount := range bucketAmounts {
			if amount <= 0 {
				continue
			}
			field := strconv.FormatInt(bucketStart, 10)
			hashValues[field] = amount
			zItems = append(zItems, &redis.Z{Score: float64(bucketStart), Member: field})
		}
		if len(hashValues) > 0 {
			pipe.HSet(ctx, amtKey, hashValues)
			pipe.ZAdd(ctx, idxKey, zItems...)
			pipe.Expire(ctx, idxKey, time.Duration(subscriptionWindowRedisTTLSeconds)*time.Second)
			pipe.Expire(ctx, amtKey, time.Duration(subscriptionWindowRedisTTLSeconds)*time.Second)
		}
	}
	pipe.Set(ctx, metaKey, dbWatermark, time.Duration(subscriptionWindowRedisTTLSeconds)*time.Second)
	_, err := pipe.Exec(ctx)
	return err
}

func refreshSubscriptionWindowRedisWatermarkTx(tx *gorm.DB, userSubscriptionId int, now int64) error {
	if !subscriptionWindowRedisBucketEnabled() || !subscriptionWindowRedisReady() || userSubscriptionId <= 0 {
		return nil
	}
	watermark, _, err := subscriptionWindowRedisWatermarkTx(tx, userSubscriptionId, now)
	if err != nil {
		return err
	}
	ctx, cancel := subscriptionWindowRedisContext()
	defer cancel()
	if err := common.RDB.Set(ctx, subscriptionWindowRedisMetaKey(userSubscriptionId), watermark, time.Duration(subscriptionWindowRedisTTLSeconds)*time.Second).Err(); err != nil {
		if subscriptionWindowRedisFallback() == subscriptionWindowRedisFallbackDeny {
			return err
		}
		common.SysError(fmt.Sprintf("subscription window Redis watermark refresh skipped: %v", err))
	}
	return nil
}

func subscriptionWindowRedisWatermarkTx(tx *gorm.DB, userSubscriptionId int, now int64) (string, bool, error) {
	if userSubscriptionId <= 0 {
		return "", false, errors.New("invalid userSubscriptionId")
	}
	query := DB
	if tx != nil {
		query = tx
	}
	bucketSeconds := subscriptionWindowBucketSeconds()
	minSince := subscriptionWindowBucketStart(now-30*86400, bucketSeconds)
	includeLegacy := subscriptionLegacyWindowUsageEnabled()

	type aggregate struct {
		count      int64
		sum        int64
		maxID      int64
		maxUpdated int64
	}
	scanTable := func(table string, excludeExistingDetails bool) (aggregate, error) {
		var item aggregate
		row := query.Table(table).
			Where("user_subscription_id = ? AND status = ? AND created_at >= ?", userSubscriptionId, "consumed", minSince).
			Scopes(func(db *gorm.DB) *gorm.DB {
				if !excludeExistingDetails {
					return db
				}
				return db.Where("NOT EXISTS (?)", query.Model(&SubscriptionPreConsumeDetail{}).Select("1").Where("subscription_pre_consume_details.request_id = subscription_pre_consume_records.request_id"))
			}).
			Select("COUNT(*), COALESCE(SUM(pre_consumed), 0), COALESCE(MAX(id), 0), COALESCE(MAX(updated_at), 0)").Row()
		if err := row.Scan(&item.count, &item.sum, &item.maxID, &item.maxUpdated); err != nil {
			return aggregate{}, err
		}
		return item, nil
	}

	detail, err := scanTable("subscription_pre_consume_details", false)
	if err != nil {
		return "", false, err
	}
	legacy := aggregate{}
	if includeLegacy {
		legacy, err = scanTable("subscription_pre_consume_records", true)
		if err != nil {
			return "", false, err
		}
	}
	watermark := fmt.Sprintf("%d:%d:%t:%d:%d:%d:%d:%d:%d:%d:%d",
		bucketSeconds, minSince, includeLegacy,
		detail.count, detail.sum, detail.maxID, detail.maxUpdated,
		legacy.count, legacy.sum, legacy.maxID, legacy.maxUpdated,
	)
	return watermark, detail.count+legacy.count > 0, nil
}

func syncSubscriptionWindowRedisBucketDeltaForTimeTx(tx *gorm.DB, userSubscriptionId int, at int64, delta int64) (*subscriptionWindowRedisBucketDelta, error) {
	if delta == 0 || !subscriptionWindowRedisBucketEnabled() {
		return nil, nil
	}
	if userSubscriptionId <= 0 {
		return nil, errors.New("invalid userSubscriptionId")
	}
	query := DB
	if tx != nil {
		query = tx
	}
	var sub UserSubscription
	if err := query.Where("id = ?", userSubscriptionId).First(&sub).Error; err != nil {
		return nil, err
	}
	plan, err := getSubscriptionPlanByIdTx(tx, sub.PlanId)
	if err != nil {
		return nil, err
	}
	now := getDBTimestampTx(tx)
	if len(buildSubscriptionWindowDefs(plan, now, true)) == 0 {
		return nil, nil
	}
	if !subscriptionWindowRedisReady() {
		if subscriptionWindowRedisFallback() == subscriptionWindowRedisFallbackDeny {
			return nil, errors.New("subscription window Redis bucket unavailable: Redis is not enabled")
		}
		common.SysError("subscription window Redis bucket delta skipped: Redis is not enabled")
		return nil, nil
	}
	if at <= 0 {
		at = now
	}

	ctx, cancel := subscriptionWindowRedisContext()
	defer cancel()
	if err := ensureSubscriptionWindowRedisBucketTx(ctx, tx, userSubscriptionId, now); err != nil {
		if subscriptionWindowRedisFallback() == subscriptionWindowRedisFallbackDeny {
			return nil, fmt.Errorf("subscription window Redis bucket unavailable: %w", err)
		}
		common.SysError(fmt.Sprintf("subscription window Redis bucket delta skipped: %v", err))
		return nil, nil
	}
	bucketStart := subscriptionWindowBucketStart(at, subscriptionWindowBucketSeconds())
	appliedDelta, err := applySubscriptionWindowRedisBucketDelta(ctx, userSubscriptionId, bucketStart, delta)
	if err != nil {
		if subscriptionWindowRedisFallback() == subscriptionWindowRedisFallbackDeny {
			return nil, fmt.Errorf("subscription window Redis bucket unavailable: %w", err)
		}
		common.SysError(fmt.Sprintf("subscription window Redis bucket delta skipped: %v", err))
		return nil, nil
	}
	if appliedDelta == 0 {
		return nil, nil
	}
	return &subscriptionWindowRedisBucketDelta{userSubscriptionId: userSubscriptionId, bucketStart: bucketStart, delta: appliedDelta}, nil
}

func applySubscriptionWindowRedisBucketDelta(ctx context.Context, userSubscriptionId int, bucketStart int64, delta int64) (int64, error) {
	if delta == 0 {
		return 0, nil
	}
	if !subscriptionWindowRedisReady() {
		return 0, errors.New("Redis is not enabled")
	}
	idxKey, amtKey := subscriptionWindowRedisKeys(userSubscriptionId)
	raw, err := common.RDB.Eval(ctx, subscriptionWindowRedisApplyDeltaScript, []string{idxKey, amtKey}, bucketStart, delta, subscriptionWindowRedisTTLSeconds).Result()
	if err != nil {
		return 0, err
	}
	appliedDelta, err := redisEvalInt64(raw)
	if err != nil {
		return 0, err
	}
	return appliedDelta, nil
}

func rollbackSubscriptionWindowRedisDeltas(deltas []subscriptionWindowRedisBucketDelta) error {
	if len(deltas) == 0 || !subscriptionWindowRedisBucketEnabled() {
		return nil
	}
	if !subscriptionWindowRedisReady() {
		return errors.New("Redis is not enabled")
	}
	ctx, cancel := subscriptionWindowRedisContext()
	defer cancel()
	var rollbackErr error
	for i := len(deltas) - 1; i >= 0; i-- {
		delta := deltas[i]
		if delta.userSubscriptionId <= 0 || delta.bucketStart <= 0 || delta.delta == 0 {
			continue
		}
		if _, err := applySubscriptionWindowRedisBucketDelta(ctx, delta.userSubscriptionId, delta.bucketStart, -delta.delta); err != nil {
			rollbackErr = errors.Join(rollbackErr, err)
		}
	}
	return rollbackErr
}

func appendRedisRollbackError(err error, deltas []subscriptionWindowRedisBucketDelta) error {
	if err == nil {
		return nil
	}
	if rollbackErr := rollbackSubscriptionWindowRedisDeltas(deltas); rollbackErr != nil {
		return fmt.Errorf("%w; subscription window Redis rollback failed: %v", err, rollbackErr)
	}
	return err
}

func redisEvalInt64(value interface{}) (int64, error) {
	switch v := value.(type) {
	case int64:
		return v, nil
	case int:
		return int64(v), nil
	case string:
		return strconv.ParseInt(v, 10, 64)
	case []byte:
		return strconv.ParseInt(string(v), 10, 64)
	default:
		return 0, fmt.Errorf("unexpected Redis integer value: %T", value)
	}
}
