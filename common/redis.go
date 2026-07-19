package common

import (
	"context"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strconv"
	"time"

	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

var RDB *redis.Client
var RedisEnabled = true

var (
	ErrRedisQuotaUnavailable = errors.New("redis quota cache is unavailable")
	ErrRedisHashInvalidated  = errors.New("redis hash is invalidated")
)

func RedisKeyCacheSeconds() int {
	return SyncFrequency
}

// InitRedisClient This function is called after init()
func InitRedisClient() (err error) {
	if os.Getenv("REDIS_CONN_STRING") == "" {
		RedisEnabled = false
		SysLog("REDIS_CONN_STRING not set, Redis is not enabled")
		return nil
	}
	if os.Getenv("SYNC_FREQUENCY") == "" {
		SysLog("SYNC_FREQUENCY not set, use default value 60")
		SyncFrequency = 60
	}
	SysLog("Redis is enabled")
	opt, err := redis.ParseURL(os.Getenv("REDIS_CONN_STRING"))
	if err != nil {
		FatalLog("failed to parse Redis connection string: " + err.Error())
	}
	opt.PoolSize = GetEnvOrDefault("REDIS_POOL_SIZE", 10)
	RDB = redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = RDB.Ping(ctx).Result()
	if err != nil {
		FatalLog("Redis ping test failed: " + err.Error())
	}
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis connected to %s", opt.Addr))
		SysLog(fmt.Sprintf("Redis database: %d", opt.DB))
	}
	return err
}

func ParseRedisOption() *redis.Options {
	opt, err := redis.ParseURL(os.Getenv("REDIS_CONN_STRING"))
	if err != nil {
		FatalLog("failed to parse Redis connection string: " + err.Error())
	}
	return opt
}

func RedisSet(key string, value string, expiration time.Duration) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis SET: key=%s, value=%s, expiration=%v", key, value, expiration))
	}
	ctx := context.Background()
	return RDB.Set(ctx, key, value, expiration).Err()
}

func RedisGet(key string) (string, error) {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis GET: key=%s", key))
	}
	ctx := context.Background()
	val, err := RDB.Get(ctx, key).Result()
	return val, err
}

//func RedisExpire(key string, expiration time.Duration) error {
//	ctx := context.Background()
//	return RDB.Expire(ctx, key, expiration).Err()
//}
//
//func RedisGetEx(key string, expiration time.Duration) (string, error) {
//	ctx := context.Background()
//	return RDB.GetSet(ctx, key, expiration).Result()
//}

func RedisDel(key string) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis DEL: key=%s", key))
	}
	ctx := context.Background()
	return RDB.Del(ctx, key).Err()
}

func RedisDelKey(key string) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis DEL Key: key=%s", key))
	}
	ctx := context.Background()
	return RDB.Del(ctx, key).Err()
}

func RedisHSetObj(key string, obj interface{}, expiration time.Duration) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis HSET: key=%s, obj=%+v, expiration=%v", key, obj, expiration))
	}
	data, err := redisHashObjectData(obj)
	if err != nil {
		return err
	}

	args := make([]interface{}, 0, 1+len(data)*2)
	args = append(args, expiration.Milliseconds())
	for field, value := range data {
		args = append(args, field, value)
	}
	const script = `
local previous_ttl = redis.call('PTTL', KEYS[1])
for i = 2, #ARGV, 2 do
  redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1])
end
local expiration_ms = tonumber(ARGV[1])
if expiration_ms ~= nil and expiration_ms > 0 then
  if previous_ttl == -2 or (previous_ttl >= 0 and previous_ttl < expiration_ms) then
    redis.call('PEXPIRE', KEYS[1], expiration_ms)
  end
end
return 1
`
	_, err = RDB.Eval(context.Background(), script, []string{key}, args...).Result()
	if err != nil {
		return fmt.Errorf("failed to update Redis hash: %w", err)
	}
	return nil
}

// RedisHSetObjIfAbsent atomically populates a complete hash only when the key
// does not exist. It prevents delayed DB snapshots from overwriting newer
// field-level updates such as quota reservations.
func RedisHSetObjIfAbsent(key string, obj interface{}, expiration time.Duration) (bool, error) {
	if RDB == nil {
		return false, errors.New("redis is unavailable")
	}
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis HSET if absent: key=%s, obj=%+v, expiration=%v", key, obj, expiration))
	}
	data, err := redisHashObjectData(obj)
	if err != nil {
		return false, err
	}

	args := make([]interface{}, 0, 1+len(data)*2)
	args = append(args, int64(expiration/time.Second))
	for field, value := range data {
		args = append(args, field, value)
	}
	const script = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return 0
end
for i = 2, #ARGV, 2 do
  redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1])
end
local expiration = tonumber(ARGV[1])
if expiration ~= nil and expiration > 0 then
  redis.call('EXPIRE', KEYS[1], expiration)
end
return 1
`
	result, err := RDB.Eval(context.Background(), script, []string{key}, args...).Int64()
	if err != nil {
		return false, fmt.Errorf("failed to populate Redis hash: %w", err)
	}
	return result == 1, nil
}

// RedisHSetObjIfGeneration populates a cache snapshot only when no quota
// mutation has committed since the caller captured expectedGeneration. Pinned
// hashes are never replaced because image-task reconciliation owns their quota
// fields until the final pin is released.
func RedisHSetObjIfGeneration(
	key string,
	pinsKey string,
	invalidationKey string,
	generationKey string,
	expectedGeneration int64,
	obj interface{},
	expiration time.Duration,
) (bool, error) {
	if RDB == nil {
		return false, errors.New("redis is unavailable")
	}
	data, err := redisHashObjectData(obj)
	if err != nil {
		return false, err
	}

	args := make([]interface{}, 0, 2+len(data)*2)
	args = append(args, expectedGeneration, int64(expiration/time.Second))
	for field, value := range data {
		args = append(args, field, value)
	}
	const script = `
local current_generation = tonumber(redis.call('GET', KEYS[4])) or 0
if current_generation ~= tonumber(ARGV[1]) then
  return 0
end
if redis.call('SCARD', KEYS[2]) > 0 then
  return 0
end
if redis.call('EXISTS', KEYS[1]) == 1 and redis.call('EXISTS', KEYS[3]) == 0 then
  return 0
end
redis.call('DEL', KEYS[1])
for i = 3, #ARGV, 2 do
  redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1])
end
local expiration = tonumber(ARGV[2])
if expiration ~= nil and expiration > 0 then
  redis.call('EXPIRE', KEYS[1], expiration)
end
redis.call('DEL', KEYS[3])
return 1
`
	result, err := RDB.Eval(
		context.Background(),
		script,
		[]string{key, pinsKey, invalidationKey, generationKey},
		args...,
	).Int64()
	if err != nil {
		return false, fmt.Errorf("failed to populate versioned Redis hash: %w", err)
	}
	return result == 1, nil
}

// RedisHInvalidateWithGeneration atomically advances the cache generation and
// invalidates the ordinary read snapshot. When image-task pins are active, the
// hash is retained for reconciliation and an invalidation marker makes normal
// readers bypass it. invalidStatus is optional and is used by auth mutations
// that must disable a pinned identity immediately.
func RedisHInvalidateWithGeneration(
	key string,
	pinsKey string,
	invalidationKey string,
	generationKey string,
	hold time.Duration,
	invalidStatus *int,
) (int64, error) {
	return redisHInvalidateWithGeneration(
		key,
		pinsKey,
		invalidationKey,
		generationKey,
		hold,
		invalidStatus,
		"",
		0,
		"",
		0,
		false,
	)
}

// RedisHApplyDeltaAndInvalidateWithGeneration updates a pinned reconciliation
// ledger by the already-committed DB delta. Without pins the ordinary snapshot
// is deleted instead. Callers must serialize the DB mutation and this Redis
// phase with the same per-identity lock used when creating image-task pins.
func RedisHApplyDeltaAndInvalidateWithGeneration(
	key string,
	pinsKey string,
	invalidationKey string,
	generationKey string,
	hold time.Duration,
	deltaField string,
	delta int64,
) (int64, error) {
	if deltaField == "" {
		return 0, errors.New("redis quota delta field is required")
	}
	return redisHInvalidateWithGeneration(
		key,
		pinsKey,
		invalidationKey,
		generationKey,
		hold,
		nil,
		deltaField,
		delta,
		"",
		0,
		false,
	)
}

// RedisHApplyDeltaAndInvalidateWithGenerationOncePolicy is the replay-safe
// form with an explicit compatibility mode for bounded legacy oversized
// balances. In that mode a pinned cache must also contain an oversized
// balance; a normal-range stale snapshot is rejected instead of being
// adjusted against a different database value.
func RedisHApplyDeltaAndInvalidateWithGenerationOncePolicy(
	key string,
	pinsKey string,
	invalidationKey string,
	generationKey string,
	hold time.Duration,
	deltaField string,
	delta int64,
	operationKey string,
	operationTTL time.Duration,
	allowLegacyDebit bool,
) (int64, error) {
	if deltaField == "" {
		return 0, errors.New("redis quota delta field is required")
	}
	if operationKey == "" {
		return 0, errors.New("redis quota operation key is required")
	}
	if operationTTL <= 0 {
		return 0, errors.New("redis quota operation ttl is required")
	}
	return redisHInvalidateWithGeneration(
		key,
		pinsKey,
		invalidationKey,
		generationKey,
		hold,
		nil,
		deltaField,
		delta,
		operationKey,
		operationTTL,
		allowLegacyDebit,
	)
}

// RedisHApplyDeltaAndInvalidateWithGenerationOnce is the replay-safe form used
// by durable billing outboxes. operationKey is written by the same Lua script
// only after the cache delta/invalidation succeeds, so retrying after an
// ambiguous network result cannot apply a pinned-ledger delta twice.
func RedisHApplyDeltaAndInvalidateWithGenerationOnce(
	key string,
	pinsKey string,
	invalidationKey string,
	generationKey string,
	hold time.Duration,
	deltaField string,
	delta int64,
	operationKey string,
	operationTTL time.Duration,
) (int64, error) {
	return RedisHApplyDeltaAndInvalidateWithGenerationOncePolicy(
		key,
		pinsKey,
		invalidationKey,
		generationKey,
		hold,
		deltaField,
		delta,
		operationKey,
		operationTTL,
		false,
	)
}

func redisHInvalidateWithGeneration(
	key string,
	pinsKey string,
	invalidationKey string,
	generationKey string,
	hold time.Duration,
	invalidStatus *int,
	deltaField string,
	delta int64,
	operationKey string,
	operationTTL time.Duration,
	allowLegacyDebit bool,
) (int64, error) {
	statusEnabled := 0
	status := 0
	if invalidStatus != nil {
		statusEnabled = 1
		status = *invalidStatus
	}
	holdSeconds := int64(hold / time.Second)
	if holdSeconds <= 0 {
		holdSeconds = 1
	}
	operationEnabled := 0
	operationSeconds := int64(operationTTL / time.Second)
	if operationKey != "" {
		operationEnabled = 1
		if operationSeconds <= 0 {
			operationSeconds = 1
		}
	}
	legacyDebitEnabled := 0
	if allowLegacyDebit {
		legacyDebitEnabled = 1
	}
	const script = `
if ARGV[10] == '1' and redis.call('EXISTS', KEYS[5]) == 1 then
  return tonumber(redis.call('GET', KEYS[4])) or 0
end
local generation = redis.call('INCR', KEYS[4])
redis.call('EXPIRE', KEYS[4], ARGV[1])
if redis.call('SCARD', KEYS[2]) > 0 then
  if ARGV[2] == '1' and redis.call('EXISTS', KEYS[1]) == 1 then
    redis.call('HSET', KEYS[1], 'Status', ARGV[3])
  end
  if ARGV[4] ~= '' and tonumber(ARGV[5]) ~= 0 then
    local id = redis.call('HGET', KEYS[1], 'Id')
    local current = tonumber(redis.call('HGET', KEYS[1], ARGV[4]))
    local delta = tonumber(ARGV[5])
    local next_value = current and delta and current + delta or nil
    local in_current_range = next_value and next_value >= tonumber(ARGV[6]) and next_value <= tonumber(ARGV[7]) and
      ARGV[9] ~= '1'
    local legacy_debit = ARGV[9] == '1' and current and next_value and delta and
      current > tonumber(ARGV[7]) and current <= tonumber(ARGV[8]) and
      next_value >= tonumber(ARGV[6]) and next_value <= tonumber(ARGV[8]) and
      delta < 0 and next_value < current
    if not id or not current or not delta or not next_value or not (in_current_range or legacy_debit) then
      redis.call('SET', KEYS[3], '1', 'EX', ARGV[1])
      return -1
    end
    redis.call('HINCRBY', KEYS[1], ARGV[4], ARGV[5])
  end
  redis.call('SET', KEYS[3], '1', 'EX', ARGV[1])
  if ARGV[10] == '1' then
    redis.call('SET', KEYS[5], '1', 'EX', ARGV[11])
  end
  return generation
end
redis.call('DEL', KEYS[1])
redis.call('DEL', KEYS[3])
if ARGV[10] == '1' then
  redis.call('SET', KEYS[5], '1', 'EX', ARGV[11])
end
return generation
`
	generation, err := RDB.Eval(
		context.Background(),
		script,
		[]string{key, pinsKey, invalidationKey, generationKey, operationKey},
		holdSeconds,
		statusEnabled,
		status,
		deltaField,
		delta,
		MinQuota,
		MaxQuota,
		MaxLegacyQuota,
		legacyDebitEnabled,
		operationEnabled,
		operationSeconds,
	).Int64()
	if err != nil {
		return 0, fmt.Errorf("failed to invalidate versioned Redis hash: %w", err)
	}
	if generation == -1 {
		return 0, ErrRedisQuotaUnavailable
	}
	return generation, nil
}

func RedisGeneration(key string) (int64, error) {
	generation, err := RDB.Get(context.Background(), key).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("failed to load Redis generation: %w", err)
	}
	return generation, nil
}

func redisHashObjectData(obj interface{}) (map[string]interface{}, error) {
	value := reflect.ValueOf(obj)
	if value.Kind() != reflect.Ptr || value.IsNil() {
		return nil, fmt.Errorf("obj must be a non-nil pointer to a struct, got %T", obj)
	}
	v := value.Elem()
	if v.Kind() != reflect.Struct {
		return nil, fmt.Errorf("obj must be a pointer to a struct, got %T", obj)
	}

	data := make(map[string]interface{}, v.NumField())
	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		value := v.Field(i)

		// Skip DeletedAt field
		if field.Type.String() == "gorm.DeletedAt" {
			continue
		}

		// 处理指针类型
		if value.Kind() == reflect.Ptr {
			if value.IsNil() {
				data[field.Name] = ""
				continue
			}
			value = value.Elem()
		}

		// 处理布尔类型
		if value.Kind() == reflect.Bool {
			data[field.Name] = strconv.FormatBool(value.Bool())
			continue
		}

		// 其他类型直接转换为字符串
		data[field.Name] = fmt.Sprintf("%v", value.Interface())
	}
	return data, nil
}

func RedisHGetObj(key string, obj interface{}) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis HGETALL: key=%s", key))
	}
	ctx := context.Background()

	result, err := RDB.HGetAll(ctx, key).Result()
	if err != nil {
		return fmt.Errorf("failed to load hash from Redis: %w", err)
	}

	if len(result) == 0 {
		return fmt.Errorf("key %s not found in Redis", key)
	}

	return redisHashObjectFromMap(result, obj)
}

// RedisHGetObjIfValid atomically refuses hashes carrying an invalidation
// marker, preventing normal authentication/quota reads from observing the
// pinned stale snapshot retained for image-task reconciliation.
func RedisHGetObjIfValid(key string, invalidationKey string, obj interface{}) error {
	const script = `
if redis.call('EXISTS', KEYS[2]) == 1 then
  return {'invalidated'}
end
local values = redis.call('HGETALL', KEYS[1])
if #values == 0 then
  return {}
end
table.insert(values, 1, 'valid')
return values
`
	values, err := RDB.Eval(context.Background(), script, []string{key, invalidationKey}).Slice()
	if err != nil {
		return fmt.Errorf("failed to load valid hash from Redis: %w", err)
	}
	if len(values) == 1 && fmt.Sprint(values[0]) == "invalidated" {
		return ErrRedisHashInvalidated
	}
	if len(values) == 0 {
		return fmt.Errorf("key %s not found in Redis", key)
	}
	if fmt.Sprint(values[0]) != "valid" || (len(values)-1)%2 != 0 {
		return fmt.Errorf("invalid Redis hash response for key %s", key)
	}
	result := make(map[string]string, (len(values)-1)/2)
	for index := 1; index < len(values); index += 2 {
		result[fmt.Sprint(values[index])] = fmt.Sprint(values[index+1])
	}
	return redisHashObjectFromMap(result, obj)
}

func redisHashObjectFromMap(result map[string]string, obj interface{}) error {
	// Handle both pointer and non-pointer values
	val := reflect.ValueOf(obj)
	if val.Kind() != reflect.Ptr {
		return fmt.Errorf("obj must be a pointer to a struct, got %T", obj)
	}

	v := val.Elem()
	if v.Kind() != reflect.Struct {
		return fmt.Errorf("obj must be a pointer to a struct, got pointer to %T", v.Interface())
	}

	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		fieldName := field.Name
		if value, ok := result[fieldName]; ok {
			fieldValue := v.Field(i)

			// Handle pointer types
			if fieldValue.Kind() == reflect.Ptr {
				if value == "" {
					continue
				}
				if fieldValue.IsNil() {
					fieldValue.Set(reflect.New(fieldValue.Type().Elem()))
				}
				fieldValue = fieldValue.Elem()
			}

			// Enhanced type handling for Token struct
			switch fieldValue.Kind() {
			case reflect.String:
				fieldValue.SetString(value)
			case reflect.Int, reflect.Int64:
				intValue, err := strconv.ParseInt(value, 10, 64)
				if err != nil {
					return fmt.Errorf("failed to parse int field %s: %w", fieldName, err)
				}
				fieldValue.SetInt(intValue)
			case reflect.Bool:
				boolValue, err := strconv.ParseBool(value)
				if err != nil {
					return fmt.Errorf("failed to parse bool field %s: %w", fieldName, err)
				}
				fieldValue.SetBool(boolValue)
			case reflect.Struct:
				// Special handling for gorm.DeletedAt
				if fieldValue.Type().String() == "gorm.DeletedAt" {
					if value != "" {
						timeValue, err := time.Parse(time.RFC3339, value)
						if err != nil {
							return fmt.Errorf("failed to parse DeletedAt field %s: %w", fieldName, err)
						}
						fieldValue.Set(reflect.ValueOf(gorm.DeletedAt{Time: timeValue, Valid: true}))
					}
				}
			default:
				return fmt.Errorf("unsupported field type: %s for field %s", fieldValue.Kind(), fieldName)
			}
		}
	}

	return nil
}

// RedisIncr Add this function to handle atomic increments
func RedisIncr(key string, delta int64) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis INCR: key=%s, delta=%d", key, delta))
	}
	// 检查键的剩余生存时间
	ttlCmd := RDB.TTL(context.Background(), key)
	ttl, err := ttlCmd.Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return fmt.Errorf("failed to get TTL: %w", err)
	}

	// 只有在 key 存在且有 TTL 时才需要特殊处理
	if ttl > 0 {
		ctx := context.Background()
		// 开始一个Redis事务
		txn := RDB.TxPipeline()

		// 减少余额
		decrCmd := txn.IncrBy(ctx, key, delta)
		if err := decrCmd.Err(); err != nil {
			return err // 如果减少失败，则直接返回错误
		}

		// 重新设置过期时间，使用原来的过期时间
		txn.Expire(ctx, key, ttl)

		// 执行事务
		_, err = txn.Exec(ctx)
		return err
	}
	return nil
}

func RedisHIncrBy(key, field string, delta int64) error {
	return redisHIncrByWithOperationID(key, field, delta, GetUUID())
}

const quotaMutationDedupSeconds = 60

func redisHIncrByWithOperationID(key, field string, delta int64, operationID string) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis HINCRBY: key=%s, field=%s, delta=%d", key, field, delta))
	}
	if operationID == "" {
		return errors.New("redis quota operation ID is required")
	}
	const script = `
local previous = redis.call('GET', KEYS[2])
if previous then
  return tonumber(previous)
end
if not redis.call('HGET', KEYS[1], 'Id') or not redis.call('HGET', KEYS[1], ARGV[1]) then
  return -2
end
redis.call('HINCRBY', KEYS[1], ARGV[1], ARGV[2])
local expiration_seconds = tonumber(ARGV[3])
local expiration_ms = expiration_seconds * 1000
local current_ttl_ms = redis.call('PTTL', KEYS[1])
if expiration_ms > 0 and current_ttl_ms >= 0 and current_ttl_ms < expiration_ms then
  redis.call('PEXPIRE', KEYS[1], expiration_ms)
end
redis.call('SET', KEYS[2], '1', 'EX', ARGV[4])
return 1
`
	result, err := RDB.Eval(
		context.Background(),
		script,
		[]string{key, key + ":quota-op:" + operationID},
		field,
		delta,
		RedisKeyCacheSeconds(),
		quotaMutationDedupSeconds,
	).Int64()
	if err != nil {
		return fmt.Errorf("failed to increment Redis quota: %w", err)
	}
	if result != 1 {
		return ErrRedisQuotaUnavailable
	}
	return nil
}

func RedisHSetField(key, field string, value interface{}) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis HSET field: key=%s, field=%s, value=%v", key, field, value))
	}
	ttlCmd := RDB.TTL(context.Background(), key)
	ttl, err := ttlCmd.Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return fmt.Errorf("failed to get TTL: %w", err)
	}

	if ttl > 0 {
		ctx := context.Background()
		txn := RDB.TxPipeline()

		hsetCmd := txn.HSet(ctx, key, field, value)
		if err := hsetCmd.Err(); err != nil {
			return err
		}

		txn.Expire(ctx, key, ttl)

		_, err = txn.Exec(ctx)
		return err
	}
	return nil
}
