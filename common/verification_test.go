package common

import (
	"context"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestVerificationCodesUseRedisWhenEnabled(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	defer client.Close()

	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	oldValidMinutes := VerificationValidMinutes
	t.Cleanup(func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
		VerificationValidMinutes = oldValidMinutes
		verificationMap = make(map[string]verificationValue)
	})

	RedisEnabled = true
	RDB = client
	VerificationValidMinutes = 10
	verificationMap = make(map[string]verificationValue)

	require.NoError(t, RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))

	keys, err := client.Keys(context.Background(), "verification:*").Result()
	require.NoError(t, err)
	require.Len(t, keys, 1)

	got, err := client.Get(context.Background(), keys[0]).Result()
	require.NoError(t, err)
	require.Equal(t, "123456", got)

	ttl, err := client.TTL(context.Background(), keys[0]).Result()
	require.NoError(t, err)
	require.Greater(t, ttl, 9*time.Minute)
	require.LessOrEqual(t, ttl, 10*time.Minute)

	require.True(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
	require.False(t, VerifyCodeWithKey("user@example.com", "000000", EmailVerificationPurpose))

	DeleteKey("user@example.com", EmailVerificationPurpose)
	require.False(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
}

func TestVerificationCodesExpireInRedis(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	defer client.Close()

	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	oldValidMinutes := VerificationValidMinutes
	t.Cleanup(func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
		VerificationValidMinutes = oldValidMinutes
		verificationMap = make(map[string]verificationValue)
	})

	RedisEnabled = true
	RDB = client
	VerificationValidMinutes = 1
	verificationMap = make(map[string]verificationValue)

	require.NoError(t, RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
	server.FastForward(time.Minute + time.Second)

	require.False(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
}

func TestVerificationCodesFallbackToMemoryWhenRedisFails(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	defer client.Close()
	server.Close()

	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	oldValidMinutes := VerificationValidMinutes
	t.Cleanup(func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
		VerificationValidMinutes = oldValidMinutes
		verificationMap = make(map[string]verificationValue)
	})

	RedisEnabled = true
	RDB = client
	VerificationValidMinutes = 10
	verificationMap = make(map[string]verificationValue)

	require.NoError(t, RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))

	verificationMutex.Lock()
	stored, ok := verificationMap[EmailVerificationPurpose+"user@example.com"]
	verificationMutex.Unlock()
	require.True(t, ok)
	require.Equal(t, "123456", stored.code)

	require.True(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
	require.False(t, VerifyCodeWithKey("user@example.com", "000000", EmailVerificationPurpose))

	DeleteKey("user@example.com", EmailVerificationPurpose)
	require.False(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
}
