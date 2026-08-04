package service

import (
	"fmt"
	"net"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

type image2RedisFixture struct {
	Name     string
	Attempts int
	Enabled  bool
	Optional *string
}

// TestImage2IsolatedRedisHashTTL is intentionally opt-in. It only accepts a
// loopback address supplied by the caller, so a normal test run cannot
// accidentally connect to a production Redis instance. Run it with a local
// disposable Redis server and P3_ISOLATED_REDIS_ADDR=127.0.0.1:<port>.
func TestImage2IsolatedRedisHashTTL(t *testing.T) {
	address := strings.TrimSpace(os.Getenv("P3_ISOLATED_REDIS_ADDR"))
	if address == "" {
		t.Skip("set P3_ISOLATED_REDIS_ADDR to an explicitly isolated loopback Redis")
	}
	host, _, err := net.SplitHostPort(address)
	require.NoError(t, err)
	if host != "localhost" {
		ip := net.ParseIP(host)
		require.NotNil(t, ip, "P3 isolated Redis host must be localhost or a loopback IP")
		require.True(t, ip.IsLoopback(), "P3 isolated Redis host must be loopback")
	}

	client := redis.NewClient(&redis.Options{Addr: address, DB: 15})
	t.Cleanup(func() { _ = client.Close() })
	ctx := t.Context()
	_, err = client.Ping(ctx).Result()
	require.NoError(t, err)

	oldClient := common.RDB
	oldRedisEnabled := common.RedisEnabled
	common.RDB = client
	common.RedisEnabled = true
	t.Cleanup(func() {
		common.RDB = oldClient
		common.RedisEnabled = oldRedisEnabled
	})

	key := fmt.Sprintf("p3:image2:redis-ttl:%d", time.Now().UnixNano())
	t.Cleanup(func() { _ = client.Del(ctx, key).Err() })
	optional := "metadata"
	fixture := &image2RedisFixture{Name: "isolated", Attempts: 1, Enabled: true, Optional: &optional}

	// RedisHSetObj uses one transaction pipeline containing HSET + EXPIRE.
	require.NoError(t, common.RedisHSetObj(key, fixture, 3*time.Second))
	fields, err := client.HGetAll(ctx, key).Result()
	require.NoError(t, err)
	require.Equal(t, "isolated", fields["Name"])
	require.Equal(t, "1", fields["Attempts"])
	require.Equal(t, "true", fields["Enabled"])
	require.Equal(t, "metadata", fields["Optional"])

	ttl, err := client.TTL(ctx, key).Result()
	require.NoError(t, err)
	require.Greater(t, ttl, time.Duration(0))
	require.LessOrEqual(t, ttl, 3*time.Second)

	// A field update must preserve the existing TTL rather than turning the
	// hash into a non-expiring key. This covers the HSET/EXPIRE contract used by
	// the token/user cache paths.
	require.NoError(t, common.RedisHSetField(key, "Attempts", "2"))
	require.Equal(t, "2", client.HGet(ctx, key, "Attempts").Val())
	updatedTTL, err := client.TTL(ctx, key).Result()
	require.NoError(t, err)
	require.Greater(t, updatedTTL, time.Duration(0))
	require.LessOrEqual(t, updatedTTL, ttl)

	require.Eventually(t, func() bool {
		exists, existsErr := client.Exists(ctx, key).Result()
		return existsErr == nil && exists == 0
	}, 5*time.Second, 100*time.Millisecond, "isolated Redis hash should expire")
}
