package abuse

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
)

func resetPublicRoutingTestState() {
	memPublicRouting.mu.Lock()
	defer memPublicRouting.mu.Unlock()
	resetMemory()
}

func TestPublicRoutingCredentialRateLimitBlocksBeyondLimit(t *testing.T) {
	resetPublicRoutingTestState()
	cfg := DefaultConfig()
	cfg.RPMLimit = 2

	for i := 0; i < 2; i++ {
		decision, err := CheckPublicRoutingCredential(context.Background(), nil, 42, "203.0.113.1", "runner-a", cfg)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !decision.Allowed {
			t.Fatalf("request %d should be allowed", i+1)
		}
	}

	decision, err := CheckPublicRoutingCredential(context.Background(), nil, 42, "203.0.113.1", "runner-a", cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if decision.Allowed {
		t.Fatal("third request should be blocked")
	}
	if decision.RetryAfter < 1 {
		t.Fatalf("expected positive retry-after, got %d", decision.RetryAfter)
	}
}

func TestPublicRoutingCredentialRateLimitIsPerToken(t *testing.T) {
	resetPublicRoutingTestState()
	cfg := DefaultConfig()
	cfg.RPMLimit = 1

	decision, err := CheckPublicRoutingCredential(context.Background(), nil, 100, "203.0.113.1", "runner-a", cfg)
	if err != nil || !decision.Allowed {
		t.Fatalf("token 100 first request should be allowed: decision=%+v err=%v", decision, err)
	}
	decision, err = CheckPublicRoutingCredential(context.Background(), nil, 101, "203.0.113.1", "runner-a", cfg)
	if err != nil || !decision.Allowed {
		t.Fatalf("token 101 first request should be isolated and allowed: decision=%+v err=%v", decision, err)
	}
}

func TestPublicRoutingSharedCredentialFanoutFlagsAnomaly(t *testing.T) {
	resetPublicRoutingTestState()
	cfg := DefaultConfig()
	cfg.RPMLimit = 0
	cfg.SharedIPLimit = 2
	cfg.SharedClientLimit = 3

	clients := []struct {
		ip string
		ua string
	}{
		{"203.0.113.1", "runner-a"},
		{"203.0.113.2", "runner-b"},
		{"203.0.113.3", "runner-c"},
		{"203.0.113.3", "runner-d"},
	}

	var decision PublicRoutingDecision
	var err error
	for _, client := range clients {
		decision, err = CheckPublicRoutingCredential(context.Background(), nil, 7, client.ip, client.ua, cfg)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if !decision.Allowed {
		t.Fatal("fanout anomaly should be flagged, not blocked")
	}
	if len(decision.Flags) != 2 {
		t.Fatalf("expected two flags, got %+v", decision.Flags)
	}
	if decision.Flags[0] != FlagSharedIPFanout || decision.Flags[1] != FlagSharedClientFanout {
		t.Fatalf("unexpected flags: %+v", decision.Flags)
	}
}

func TestPublicRoutingRedisFailureReturnsError(t *testing.T) {
	cfg := DefaultConfig()
	cfg.RPMLimit = 1
	rdb := redis.NewClient(&redis.Options{
		Addr:        "127.0.0.1:1",
		DialTimeout: 20 * time.Millisecond,
		ReadTimeout: 20 * time.Millisecond,
		MaxRetries:  0,
	})
	defer rdb.Close()

	_, err := CheckPublicRoutingCredential(context.Background(), rdb, 999, "203.0.113.9", "runner-fail", cfg)
	if err == nil {
		t.Fatal("Redis command failure must surface an error so middleware can fail closed")
	}
}

func TestPublicRoutingRedisPath_Integration(t *testing.T) {
	redisURL := os.Getenv("DR82_REDIS_URL")
	if redisURL == "" {
		t.Skip("DR82_REDIS_URL not set")
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("parse DR82_REDIS_URL: %v", err)
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Fatalf("ping redis: %v", err)
	}

	tokenID := int(time.Now().UnixNano() % 1000000000)
	fanoutTokenID := tokenID + 1
	cfg := DefaultConfig()
	cfg.RPMLimit = 2
	cfg.SharedIPLimit = 1
	cfg.SharedClientLimit = 2

	t.Cleanup(func() {
		buckets := []int64{
			time.Now().Unix() / int64(cfg.SharedWindowSeconds),
			(time.Now().Unix() / int64(cfg.SharedWindowSeconds)) - 1,
			(time.Now().Unix() / int64(cfg.SharedWindowSeconds)) + 1,
		}
		keys := []string{
			fmt.Sprintf("prabuse:rpm:%d", tokenID),
			fmt.Sprintf("prabuse:rpm:%d:seq", tokenID),
			fmt.Sprintf("prabuse:rpm:%d", fanoutTokenID),
			fmt.Sprintf("prabuse:rpm:%d:seq", fanoutTokenID),
		}
		for _, bucket := range buckets {
			keys = append(keys,
				fmt.Sprintf("prabuse:ips:%d:%d", tokenID, bucket),
				fmt.Sprintf("prabuse:clients:%d:%d", tokenID, bucket),
				fmt.Sprintf("prabuse:ips:%d:%d", fanoutTokenID, bucket),
				fmt.Sprintf("prabuse:clients:%d:%d", fanoutTokenID, bucket),
			)
		}
		_ = rdb.Del(ctx, keys...).Err()
	})

	for i := 0; i < 2; i++ {
		decision, err := CheckPublicRoutingCredential(ctx, rdb, tokenID, "203.0.113.1", "runner-a", cfg)
		if err != nil {
			t.Fatalf("redis path request %d error: %v", i+1, err)
		}
		if !decision.Allowed {
			t.Fatalf("redis path request %d should be allowed", i+1)
		}
	}
	decision, err := CheckPublicRoutingCredential(ctx, rdb, tokenID, "203.0.113.2", "runner-b", cfg)
	if err != nil {
		t.Fatalf("redis path limit request error: %v", err)
	}
	if decision.Allowed {
		t.Fatal("redis path third request should be throttled")
	}

	_, err = CheckPublicRoutingCredential(ctx, rdb, fanoutTokenID, "203.0.113.10", "runner-a", cfg)
	if err != nil {
		t.Fatalf("redis fanout first request error: %v", err)
	}
	decision, err = CheckPublicRoutingCredential(ctx, rdb, fanoutTokenID, "203.0.113.11", "runner-b", cfg)
	if err != nil {
		t.Fatalf("redis fanout second request error: %v", err)
	}
	if len(decision.Flags) != 1 || decision.Flags[0] != FlagSharedIPFanout {
		t.Fatalf("expected redis fanout IP flag, got %+v", decision.Flags)
	}
}
