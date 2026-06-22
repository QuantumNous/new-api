package abuse

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

const (
	DefaultPublicRoutingRPMLimit            = 60
	DefaultPublicRoutingSharedWindowSeconds = 10 * 60
	DefaultPublicRoutingSharedIPLimit       = 3
	DefaultPublicRoutingSharedClientLimit   = 5
	FlagSharedIPFanout                      = "shared_ip_fanout"
	FlagSharedClientFanout                  = "shared_client_fanout"
)

type PublicRoutingConfig struct {
	RPMLimit            int
	SharedWindowSeconds int
	SharedIPLimit       int
	SharedClientLimit   int
}

type PublicRoutingDecision struct {
	Allowed    bool
	RetryAfter int
	Flags      []string
}

type clientWindow struct {
	expiresAt time.Time
	ips       map[string]struct{}
	clients   map[string]struct{}
}

var memPublicRouting struct {
	mu      sync.Mutex
	rpm     map[string][]int64
	windows map[string]*clientWindow
}

func init() {
	resetMemory()
}

func DefaultConfig() PublicRoutingConfig {
	return PublicRoutingConfig{
		RPMLimit:            DefaultPublicRoutingRPMLimit,
		SharedWindowSeconds: DefaultPublicRoutingSharedWindowSeconds,
		SharedIPLimit:       DefaultPublicRoutingSharedIPLimit,
		SharedClientLimit:   DefaultPublicRoutingSharedClientLimit,
	}
}

func resetMemory() {
	memPublicRouting.rpm = make(map[string][]int64)
	memPublicRouting.windows = make(map[string]*clientWindow)
}

func CheckPublicRoutingCredential(ctx context.Context, rdb *redis.Client, tokenID int, clientIP string, userAgent string, cfg PublicRoutingConfig) (PublicRoutingDecision, error) {
	cfg = normalizeConfig(cfg)
	decision := PublicRoutingDecision{Allowed: true}
	if tokenID <= 0 {
		return decision, nil
	}

	if cfg.RPMLimit > 0 {
		allowed, retryAfter, err := checkRPM(ctx, rdb, tokenID, cfg.RPMLimit)
		if err != nil {
			return decision, err
		}
		if !allowed {
			decision.Allowed = false
			decision.RetryAfter = retryAfter
			return decision, nil
		}
	}

	flags, err := observeClientFanout(ctx, rdb, tokenID, clientIP, userAgent, cfg)
	if err != nil {
		return decision, err
	}
	decision.Flags = flags
	return decision, nil
}

func normalizeConfig(cfg PublicRoutingConfig) PublicRoutingConfig {
	def := DefaultConfig()
	if cfg.RPMLimit < 0 {
		cfg.RPMLimit = def.RPMLimit
	}
	if cfg.SharedWindowSeconds <= 0 {
		cfg.SharedWindowSeconds = def.SharedWindowSeconds
	}
	if cfg.SharedIPLimit <= 0 {
		cfg.SharedIPLimit = def.SharedIPLimit
	}
	if cfg.SharedClientLimit <= 0 {
		cfg.SharedClientLimit = def.SharedClientLimit
	}
	return cfg
}

var publicRoutingRPMLua = redis.NewScript(`
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local win_ms = 60000
local seq_key = key .. ":seq"
redis.call("ZREMRANGEBYSCORE", key, "-inf", now_ms - win_ms)
local count = tonumber(redis.call("ZCARD", key))
if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  if oldest[2] then
    return {0, math.max(1, math.ceil((win_ms - (now_ms - tonumber(oldest[2]))) / 1000))}
  end
  return {0, 60}
end
local seq = redis.call("INCR", seq_key)
redis.call("ZADD", key, now_ms, seq)
redis.call("PEXPIRE", key, win_ms + 5000)
redis.call("EXPIRE", seq_key, 120)
return {1, 0}
`)

func checkRPM(ctx context.Context, rdb *redis.Client, tokenID int, limit int) (bool, int, error) {
	key := fmt.Sprintf("prabuse:rpm:%d", tokenID)
	if rdb != nil {
		res, err := publicRoutingRPMLua.Run(ctx, rdb, []string{key}, time.Now().UnixMilli(), limit).Slice()
		if err != nil {
			return false, 0, err
		}
		if len(res) != 2 {
			return false, 0, fmt.Errorf("unexpected public routing rpm script result")
		}
		allowed, ok := redisInt(res[0])
		if !ok {
			return false, 0, fmt.Errorf("unexpected public routing rpm allowed result")
		}
		retryAfter, ok := redisInt(res[1])
		if !ok {
			return false, 0, fmt.Errorf("unexpected public routing rpm retry result")
		}
		return allowed == 1, retryAfter, nil
	}

	now := time.Now().Unix()
	cutoff := now - 60
	memPublicRouting.mu.Lock()
	defer memPublicRouting.mu.Unlock()
	q := memPublicRouting.rpm[key]
	i := 0
	for i < len(q) && q[i] <= cutoff {
		i++
	}
	q = q[i:]
	if len(q) >= limit {
		memPublicRouting.rpm[key] = q
		retryAfter := int(60 - (now - q[0]))
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, retryAfter, nil
	}
	memPublicRouting.rpm[key] = append(q, now)
	return true, 0, nil
}

func redisInt(v any) (int, bool) {
	switch n := v.(type) {
	case int64:
		return int(n), true
	case int:
		return n, true
	default:
		return 0, false
	}
}

func observeClientFanout(ctx context.Context, rdb *redis.Client, tokenID int, clientIP string, userAgent string, cfg PublicRoutingConfig) ([]string, error) {
	clientIP = strings.TrimSpace(clientIP)
	clientFingerprint := fingerprintClient(clientIP, userAgent)
	if clientIP == "" && clientFingerprint == "" {
		return nil, nil
	}

	if rdb != nil {
		bucket := time.Now().Unix() / int64(cfg.SharedWindowSeconds)
		ipKey := fmt.Sprintf("prabuse:ips:%d:%d", tokenID, bucket)
		clientKey := fmt.Sprintf("prabuse:clients:%d:%d", tokenID, bucket)
		expiry := time.Duration(cfg.SharedWindowSeconds*2) * time.Second
		pipe := rdb.TxPipeline()
		if clientIP != "" {
			pipe.SAdd(ctx, ipKey, clientIP)
			pipe.Expire(ctx, ipKey, expiry)
		}
		if clientFingerprint != "" {
			pipe.SAdd(ctx, clientKey, clientFingerprint)
			pipe.Expire(ctx, clientKey, expiry)
		}
		ipCountCmd := pipe.SCard(ctx, ipKey)
		clientCountCmd := pipe.SCard(ctx, clientKey)
		if _, err := pipe.Exec(ctx); err != nil {
			return nil, err
		}
		return flagsForCounts(ipCountCmd.Val(), clientCountCmd.Val(), cfg), nil
	}

	key := fmt.Sprintf("%d:%d", tokenID, time.Now().Unix()/int64(cfg.SharedWindowSeconds))
	memPublicRouting.mu.Lock()
	defer memPublicRouting.mu.Unlock()
	win := memPublicRouting.windows[key]
	if win == nil || time.Now().After(win.expiresAt) {
		win = &clientWindow{
			expiresAt: time.Now().Add(time.Duration(cfg.SharedWindowSeconds*2) * time.Second),
			ips:       make(map[string]struct{}),
			clients:   make(map[string]struct{}),
		}
		memPublicRouting.windows[key] = win
	}
	if clientIP != "" {
		win.ips[clientIP] = struct{}{}
	}
	if clientFingerprint != "" {
		win.clients[clientFingerprint] = struct{}{}
	}
	for k, v := range memPublicRouting.windows {
		if time.Now().After(v.expiresAt) {
			delete(memPublicRouting.windows, k)
		}
	}
	return flagsForCounts(int64(len(win.ips)), int64(len(win.clients)), cfg), nil
}

func fingerprintClient(clientIP string, userAgent string) string {
	clientIP = strings.TrimSpace(clientIP)
	userAgent = strings.TrimSpace(userAgent)
	if clientIP == "" && userAgent == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(clientIP + "\x00" + userAgent))
	return hex.EncodeToString(sum[:])
}

func flagsForCounts(ipCount int64, clientCount int64, cfg PublicRoutingConfig) []string {
	flags := make([]string, 0, 2)
	if ipCount > int64(cfg.SharedIPLimit) {
		flags = append(flags, FlagSharedIPFanout)
	}
	if clientCount > int64(cfg.SharedClientLimit) {
		flags = append(flags, FlagSharedClientFanout)
	}
	return flags
}
