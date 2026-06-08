// Package quota provides atomic per-tenant rate-limit checks for DR-13.
//
// Three dimensions are enforced at the relay entry point, before any upstream call:
//   - RPM  (requests per minute)  — sliding 60-second window
//   - TPM  (tokens per minute)    — per-minute bucket, uses estimated tokens
//   - Monthly                     — per-calendar-month request counter
//
// Each check has a Redis path (atomic Lua) and an in-memory fallback path
// for deployments that run without Redis.  A limit of 0 means unlimited.
package quota

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// ---------------------------------------------------------------------------
// Redis Lua scripts
// ---------------------------------------------------------------------------

// rpmLua atomically slides the window and adds the current request.
// Returns 1 if allowed, 0 if the limit is already reached.
var rpmLua = redis.NewScript(`
local key     = KEYS[1]
local now_ms  = tonumber(ARGV[1])
local limit   = tonumber(ARGV[2])
local win_ms  = 60000
local seq_key = key .. ":seq"
redis.call("ZREMRANGEBYSCORE", key, "-inf", now_ms - win_ms)
local count = tonumber(redis.call("ZCARD", key))
if count >= limit then
  return 0
end
local seq = redis.call("INCR", seq_key)
redis.call("ZADD", key, now_ms, seq)
redis.call("PEXPIRE", key, win_ms + 5000)
redis.call("EXPIRE",  seq_key, 120)
return 1
`)

// tpmLua atomically checks and reserves estimated tokens in the current
// minute bucket.  Returns 1 if allowed, 0 if the bucket would overflow.
var tpmLua = redis.NewScript(`
local key       = KEYS[1]
local estimated = tonumber(ARGV[1])
local limit     = tonumber(ARGV[2])
local expiry    = tonumber(ARGV[3])
local current   = tonumber(redis.call("GET", key) or "0")
if current + estimated > limit then
  return 0
end
redis.call("INCRBY", key, estimated)
redis.call("EXPIRE",  key, expiry)
return 1
`)

// monthlyLua atomically increments the monthly counter if under the limit.
// Returns 1 if allowed, 0 if the limit is already reached.
var monthlyLua = redis.NewScript(`
local key    = KEYS[1]
local limit  = tonumber(ARGV[1])
local expiry = tonumber(ARGV[2])
local count  = redis.call("INCR", key)
if tonumber(count) == 1 then
  redis.call("EXPIRE", key, expiry)
end
if tonumber(count) > limit then
  redis.call("DECR", key)
  return 0
end
return 1
`)

// ---------------------------------------------------------------------------
// In-memory fallback state
// ---------------------------------------------------------------------------

var memRPM struct {
	mu    sync.Mutex
	store map[string][]int64 // key → slice of unix-second timestamps (oldest first)
}

var memTPM struct {
	mu    sync.Mutex
	store map[string]int // "tokenID:YYYYMMDDHHMI" → accumulated tokens
}

var memMonthly struct {
	mu    sync.Mutex
	store map[string]int // "tokenID:YYYYMM" → request count
}

func init() {
	memRPM.store = make(map[string][]int64)
	memTPM.store = make(map[string]int)
	memMonthly.store = make(map[string]int)
	go cleanupMemStores()
}

// cleanupMemStores evicts stale entries from the in-memory fallback stores every
// 5 minutes.  Without this, long-running servers accumulate one entry per
// token per minute (TPM) and per token per month (Monthly) indefinitely.
func cleanupMemStores() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		currentMinuteKey := fmt.Sprintf("%d%02d%02d%02d%02d",
			now.Year(), int(now.Month()), now.Day(), now.Hour(), now.Minute())
		currentMonthKey := fmt.Sprintf("%d%02d", now.Year(), int(now.Month()))

		memTPM.mu.Lock()
		for k := range memTPM.store {
			// key format: "tq:tpm:{id}:{YYYYMMDDHHMI}" — drop if minute has passed
			if len(k) > 14 && k[len(k)-12:] < currentMinuteKey {
				delete(memTPM.store, k)
			}
		}
		memTPM.mu.Unlock()

		memMonthly.mu.Lock()
		for k := range memMonthly.store {
			// key format: "tq:monthly:{id}:{YYYYMM}" — drop if month has passed
			if len(k) > 11 && k[len(k)-6:] < currentMonthKey {
				delete(memMonthly.store, k)
			}
		}
		memMonthly.mu.Unlock()

		// RPM store: entries are self-pruning on access; sweep empty slices here
		memRPM.mu.Lock()
		cutoff := now.Unix() - 60
		for k, q := range memRPM.store {
			if len(q) == 0 || q[len(q)-1] <= cutoff {
				delete(memRPM.store, k)
			}
		}
		memRPM.mu.Unlock()
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// CheckRPM checks the sliding-window requests-per-minute quota for a token.
// rdb may be nil when Redis is disabled (falls back to in-memory).
// Returns (true, nil) when allowed.
func CheckRPM(ctx context.Context, rdb *redis.Client, tokenID int, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}
	key := fmt.Sprintf("tq:rpm:%d", tokenID)

	if rdb != nil {
		nowMs := time.Now().UnixMilli()
		res, err := rpmLua.Run(ctx, rdb, []string{key}, nowMs, limit).Int()
		if err != nil {
			return false, err
		}
		return res == 1, nil
	}

	// Memory fallback — sliding 60-second window
	nowSec := time.Now().Unix()
	cutoff := nowSec - 60
	memRPM.mu.Lock()
	defer memRPM.mu.Unlock()
	q := memRPM.store[key]
	// drop expired entries from the front
	i := 0
	for i < len(q) && q[i] <= cutoff {
		i++
	}
	q = q[i:]
	if len(q) >= limit {
		memRPM.store[key] = q
		return false, nil
	}
	memRPM.store[key] = append(q, nowSec)
	return true, nil
}

// CheckTPM checks the per-minute token budget for a token.
// estimatedTokens is the best-effort token estimate for the current request.
// rdb may be nil (falls back to in-memory per-minute bucket).
func CheckTPM(ctx context.Context, rdb *redis.Client, tokenID int, limit int, estimatedTokens int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}
	if estimatedTokens < 0 {
		estimatedTokens = 0
	}

	now := time.Now()
	// bucket key: one per calendar minute
	minuteKey := fmt.Sprintf("tq:tpm:%d:%d%02d%02d%02d%02d",
		tokenID, now.Year(), int(now.Month()), now.Day(), now.Hour(), now.Minute())

	if rdb != nil {
		expiry := 120 // 2 minutes — keeps the bucket alive through the full window
		res, err := tpmLua.Run(ctx, rdb, []string{minuteKey}, estimatedTokens, limit, expiry).Int()
		if err != nil {
			return false, err
		}
		return res == 1, nil
	}

	// Memory fallback
	memTPM.mu.Lock()
	defer memTPM.mu.Unlock()
	current := memTPM.store[minuteKey]
	if current+estimatedTokens > limit {
		return false, nil
	}
	memTPM.store[minuteKey] = current + estimatedTokens
	return true, nil
}

// CheckMonthly checks the per-calendar-month request counter for a token.
// rdb may be nil (falls back to in-memory keyed by year-month).
func CheckMonthly(ctx context.Context, rdb *redis.Client, tokenID int, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	now := time.Now()
	monthKey := fmt.Sprintf("tq:monthly:%d:%d%02d", tokenID, now.Year(), int(now.Month()))

	if rdb != nil {
		nextMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location())
		expirySecs := int(nextMonth.Sub(now).Seconds()) + 86400 // +1 day buffer
		res, err := monthlyLua.Run(ctx, rdb, []string{monthKey}, limit, expirySecs).Int()
		if err != nil {
			return false, err
		}
		return res == 1, nil
	}

	// Memory fallback
	memMonthly.mu.Lock()
	defer memMonthly.mu.Unlock()
	count := memMonthly.store[monthKey]
	if count >= limit {
		return false, nil
	}
	memMonthly.store[monthKey] = count + 1
	return true, nil
}
