package common

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"
)

// Fixed-window counters shared by token RPM limits and channel rate/quota
// limits. Every counter key embeds its own window bucket (epoch minute,
// calendar day, or calendar month), so a window resets by rolling to the next
// bucket and stale keys expire on their own. Redis is the authoritative store
// for multi-node deployments; the in-memory fallback keeps single-node
// deployments working. Values may go negative (refund deltas) and are compared
// by callers with >= limit, which keeps net accounting consistent with the
// channels.used_quota column.

const windowCounterJanitorInterval = 10 * time.Minute

type windowCounterEntry struct {
	value     int64
	expiresAt time.Time
}

type windowCounterStore struct {
	mutex   sync.RWMutex
	entries map[string]windowCounterEntry
}

var windowCounters = &windowCounterStore{entries: map[string]windowCounterEntry{}}
var windowCounterJanitorOnce sync.Once

// CounterKey builds a fixed-window counter key from a prefix, an entity id,
// and the current window bucket label (for example the epoch minute).
func CounterKey(prefix string, id int, bucket string) string {
	return fmt.Sprintf("%s:%d:%s", prefix, id, bucket)
}

// CounterMinuteBucket returns the current epoch-minute bucket label. All
// timezones share the same minute boundary, so RPM/TPM windows roll over
// simultaneously on every node.
func CounterMinuteBucket() string {
	return strconv.FormatInt(time.Now().Unix()/60, 10)
}

// CounterIncrBy adds delta to the fixed-window counter named key and returns
// the new value. ttl must cover at least the window length so the bucket stays
// readable while it is current. When Redis is unavailable the in-memory store
// takes over so a counter outage never blocks billing or selection paths.
func CounterIncrBy(key string, delta int64, ttl time.Duration) (int64, error) {
	if RedisEnabled && RDB != nil {
		return redisCounterIncrBy(key, delta, ttl)
	}
	return memoryCounterIncrBy(key, delta, ttl), nil
}

// CounterGet returns the current value of one counter, or 0 when unset or
// expired. Read failures fail open (value 0) after logging.
func CounterGet(key string) int64 {
	return CounterMGet([]string{key})[key]
}

// CounterMGet reads several counter values in one round trip. Keys missing
// from the result map must be treated as 0 by callers.
func CounterMGet(keys []string) map[string]int64 {
	values := make(map[string]int64, len(keys))
	if len(keys) == 0 {
		return values
	}
	if RedisEnabled && RDB != nil {
		redisValues, err := redisCounterMGet(keys)
		if err != nil {
			SysError("failed to read rate limit counters: " + err.Error())
			return values
		}
		return redisValues
	}
	return memoryCounterMGet(keys)
}

func redisCounterIncrBy(key string, delta int64, ttl time.Duration) (int64, error) {
	ctx := context.Background()
	txn := RDB.TxPipeline()
	incrCmd := txn.IncrBy(ctx, key, delta)
	if ttl > 0 {
		txn.Expire(ctx, key, ttl)
	}
	if _, err := txn.Exec(ctx); err != nil {
		return 0, err
	}
	return incrCmd.Val(), nil
}

func redisCounterMGet(keys []string) (map[string]int64, error) {
	ctx := context.Background()
	raw, err := RDB.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}
	values := make(map[string]int64, len(keys))
	for i, item := range raw {
		if item == nil {
			continue
		}
		if str, ok := item.(string); ok {
			if value, parseErr := strconv.ParseInt(str, 10, 64); parseErr == nil {
				values[keys[i]] = value
			}
		}
	}
	return values, nil
}

func memoryCounterIncrBy(key string, delta int64, ttl time.Duration) int64 {
	startWindowCounterJanitor()
	now := time.Now()
	windowCounters.mutex.Lock()
	defer windowCounters.mutex.Unlock()
	entry, ok := windowCounters.entries[key]
	if !ok || now.After(entry.expiresAt) {
		entry = windowCounterEntry{expiresAt: now.Add(ttl)}
	}
	entry.value += delta
	windowCounters.entries[key] = entry
	return entry.value
}

func memoryCounterMGet(keys []string) map[string]int64 {
	startWindowCounterJanitor()
	now := time.Now()
	windowCounters.mutex.RLock()
	defer windowCounters.mutex.RUnlock()
	values := make(map[string]int64, len(keys))
	for _, key := range keys {
		entry, ok := windowCounters.entries[key]
		if !ok || now.After(entry.expiresAt) {
			continue
		}
		values[key] = entry.value
	}
	return values
}

// startWindowCounterJanitor periodically drops expired in-memory buckets so a
// long-running node does not accumulate one entry per idle window.
func startWindowCounterJanitor() {
	windowCounterJanitorOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(windowCounterJanitorInterval)
			for now := range ticker.C {
				windowCounters.mutex.Lock()
				for key, entry := range windowCounters.entries {
					if now.After(entry.expiresAt) {
						delete(windowCounters.entries, key)
					}
				}
				windowCounters.mutex.Unlock()
			}
		}()
	})
}
