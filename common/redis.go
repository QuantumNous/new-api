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
	ctx := context.Background()

	data := make(map[string]interface{})

	// 使用反射遍历结构体字段
	v := reflect.ValueOf(obj).Elem()
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

	txn := RDB.TxPipeline()
	txn.HSet(ctx, key, data)

	// 只有在 expiration 大于 0 时才设置过期时间
	if expiration > 0 {
		txn.Expire(ctx, key, expiration)
	}

	_, err := txn.Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to execute transaction: %w", err)
	}
	return nil
}

// RedisCacheVersion returns the current invalidation generation for a cache.
// A missing version key is generation zero.
func RedisCacheVersion(versionKey string) (int64, error) {
	value, err := RDB.Get(context.Background(), versionKey).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	return value, err
}

func cacheVersionTTLSeconds() int {
	if ttl := RedisKeyCacheSeconds(); ttl > 0 {
		return ttl
	}
	return 24 * 60 * 60
}

// RedisHSetObjIfVersion populates a hash only when no invalidation happened
// after its database snapshot was read. The version check, HSET and expiry are
// one Redis operation so another instance cannot interleave an invalidation.
func RedisHSetObjIfVersion(key string, obj interface{}, expiration time.Duration, versionKey string, expectedVersion int64) (bool, error) {
	data := make(map[string]interface{})
	v := reflect.ValueOf(obj)
	if v.Kind() != reflect.Ptr || v.IsNil() || v.Elem().Kind() != reflect.Struct {
		return false, fmt.Errorf("obj must be a non-nil pointer to a struct, got %T", obj)
	}
	v = v.Elem()
	t := v.Type()
	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		value := v.Field(i)
		if field.Type.String() == "gorm.DeletedAt" {
			continue
		}
		if value.Kind() == reflect.Ptr {
			if value.IsNil() {
				data[field.Name] = ""
				continue
			}
			value = value.Elem()
		}
		if value.Kind() == reflect.Bool {
			data[field.Name] = strconv.FormatBool(value.Bool())
		} else {
			data[field.Name] = fmt.Sprintf("%v", value.Interface())
		}
	}
	args := make([]interface{}, 0, 2+2*len(data))
	args = append(args, expectedVersion, int64(expiration/time.Second))
	for field, value := range data {
		args = append(args, field, value)
	}
	const script = "local current = redis.call('GET', KEYS[2]); " +
		"if not current then current = '0' end; " +
		"if current ~= ARGV[1] then return 0 end; " +
		"for i = 3, #ARGV, 2 do redis.call('HSET', KEYS[1], ARGV[i], ARGV[i + 1]) end; " +
		"local ttl = tonumber(ARGV[2]); if ttl and ttl > 0 then redis.call('EXPIRE', KEYS[1], ttl) end; return 1"
	result, err := RDB.Eval(context.Background(), script, []string{key, versionKey}, args...).Int64()
	return result == 1, err
}

// RedisBumpCacheVersionAndDelete atomically prevents old snapshots from being
// refilled and removes the current cache value across all application instances.
func RedisBumpCacheVersionAndDelete(versionKey, cacheKey string) error {
	// Version keys are coordination metadata, not durable state. Keep them for
	// at least the cache lifetime so stale writers lose their CAS, then reclaim
	// them to prevent create/delete churn from leaking Redis keys indefinitely.
	const script = "redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], ARGV[1]); redis.call('DEL', KEYS[2]); return 1"
	return RDB.Eval(context.Background(), script, []string{versionKey, cacheKey}, cacheVersionTTLSeconds()).Err()
}

// RedisHIncrByWithVersion updates a cache after its durable database mutation.
// A missing hash needs no pending delta because a later refill already sees the
// committed database value.
func RedisHIncrByWithVersion(key, field string, delta int64, versionKey string) error {
	const script = "redis.call('INCR', KEYS[2]); redis.call('EXPIRE', KEYS[2], ARGV[3]); " +
		"if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end; " +
		"local ttl = redis.call('TTL', KEYS[1]); redis.call('HINCRBY', KEYS[1], ARGV[1], ARGV[2]); " +
		"if ttl > 0 then redis.call('EXPIRE', KEYS[1], ttl) end; return 1"
	return RDB.Eval(context.Background(), script, []string{key, versionKey}, field, delta, cacheVersionTTLSeconds()).Err()
}

// RedisHIncrByWithVersionPending applies debits before their database mutation
// is durably flushed. Credits wait for the durable write, preventing a failed
// batch from creating spendable cache-only quota. The debit total is recorded
// even when the hash exists so acknowledgements can preserve newer mutations.
func RedisHIncrByWithVersionPending(key, field string, delta int64, versionKey string) error {
	pendingKey := versionKey + ":pending:" + field
	const script = "redis.call('INCR', KEYS[2]); redis.call('EXPIRE', KEYS[2], ARGV[3]); " +
		"if tonumber(ARGV[2]) >= 0 then return 0 end; " +
		"redis.call('INCRBY', KEYS[3], ARGV[2]); redis.call('EXPIRE', KEYS[3], ARGV[3]); " +
		"if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end; " +
		"local ttl = redis.call('TTL', KEYS[1]); redis.call('HINCRBY', KEYS[1], ARGV[1], ARGV[2]); " +
		"if ttl > 0 then redis.call('EXPIRE', KEYS[1], ttl) end; return 1"
	return RDB.Eval(context.Background(), script, []string{key, versionKey, pendingKey}, field, delta, cacheVersionTTLSeconds()).Err()
}

// RedisHApplyPendingDelta applies uncommitted batch deltas after a
// version-checked snapshot write. The pending total remains until the durable
// batch writer acknowledges it; cache refills are readers, not owners, of the
// cross-store commit record.
func RedisHApplyPendingDelta(key, field, versionKey string) error {
	pendingKey := versionKey + ":pending:" + field
	const script = "local pending = redis.call('GET', KEYS[3]); if not pending then return 0 end; " +
		"if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end; redis.call('HINCRBY', KEYS[1], ARGV[1], pending); return 1"
	return RDB.Eval(context.Background(), script, []string{key, versionKey, pendingKey}, field).Err()
}

// RedisHAcknowledgePendingDelta acknowledges a quota mutation after the same
// delta has been committed to the database. The script preserves newer pending
// mutations and invalidates any refill that raced the database commit.
func RedisHAcknowledgePendingDelta(key, field string, pendingDelta int64, versionKey string) error {
	pendingKey := versionKey + ":pending:" + field
	const script = "local pending = redis.call('GET', KEYS[1]); " +
		"if pending and tonumber(ARGV[1]) ~= 0 then local remaining = tonumber(pending) - tonumber(ARGV[1]); " +
		"if remaining == 0 then redis.call('DEL', KEYS[1]); " +
		"else local ttl = redis.call('TTL', KEYS[1]); redis.call('SET', KEYS[1], remaining); " +
		"if ttl > 0 then redis.call('EXPIRE', KEYS[1], ttl) end end end; " +
		"redis.call('INCR', KEYS[2]); redis.call('EXPIRE', KEYS[2], ARGV[2]); redis.call('DEL', KEYS[3]); return 1"
	return RDB.Eval(context.Background(), script, []string{pendingKey, versionKey, key}, pendingDelta, cacheVersionTTLSeconds()).Err()
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
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis HINCRBY: key=%s, field=%s, delta=%d", key, field, delta))
	}
	ttlCmd := RDB.TTL(context.Background(), key)
	ttl, err := ttlCmd.Result()
	if err != nil && !errors.Is(err, redis.Nil) {
		return fmt.Errorf("failed to get TTL: %w", err)
	}

	if ttl > 0 {
		ctx := context.Background()
		txn := RDB.TxPipeline()

		incrCmd := txn.HIncrBy(ctx, key, field, delta)
		if err := incrCmd.Err(); err != nil {
			return err
		}

		txn.Expire(ctx, key, ttl)

		_, err = txn.Exec(ctx)
		return err
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
