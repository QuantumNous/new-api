package common

import (
	"bytes"
	"context"
	"testing"
	"time"

	miniredis "github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
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

	RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)

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

	RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)
	server.FastForward(time.Minute + time.Second)

	require.False(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
}

func TestVerificationCodesDoNotLogRedisValues(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	defer client.Close()

	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	oldValidMinutes := VerificationValidMinutes
	oldDebugEnabled := DebugEnabled
	var logs bytes.Buffer
	LogWriterMu.Lock()
	oldWriter := gin.DefaultWriter
	gin.DefaultWriter = &logs
	LogWriterMu.Unlock()
	t.Cleanup(func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
		VerificationValidMinutes = oldValidMinutes
		DebugEnabled = oldDebugEnabled
		verificationMap = make(map[string]verificationValue)
		LogWriterMu.Lock()
		gin.DefaultWriter = oldWriter
		LogWriterMu.Unlock()
	})

	RedisEnabled = true
	RDB = client
	VerificationValidMinutes = 10
	DebugEnabled = true
	verificationMap = make(map[string]verificationValue)

	token := "password-reset-token-should-not-be-logged"
	RegisterVerificationCodeWithKey("user@example.com", token, PasswordResetPurpose)

	require.NotContains(t, logs.String(), token)
	require.Contains(t, logs.String(), "Redis SET verification code")
}

func TestVerificationCodesDoNotFallbackToMemoryAfterRedisMiss(t *testing.T) {
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

	storeVerificationCodeInMemory("user@example.com", "old-code", EmailVerificationPurpose)

	require.False(t, VerifyCodeWithKey("user@example.com", "old-code", EmailVerificationPurpose))
}

func TestVerificationCodesConsumeRedisTokenOnce(t *testing.T) {
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

	RegisterVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)

	ok, err := ConsumeVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = ConsumeVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.NoError(t, err)
	require.False(t, ok)
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

	RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)

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

func TestVerificationCodesConsumeMemoryFallbackWhenRedisFails(t *testing.T) {
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

	RegisterVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)

	ok, err := ConsumeVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = ConsumeVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.Error(t, err)
	require.False(t, ok)
}

func TestVerificationCodesDeleteReturnsRedisError(t *testing.T) {
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
	storeVerificationCodeInMemory("user@example.com", "123456", EmailVerificationPurpose)

	err := DeleteKey("user@example.com", EmailVerificationPurpose)
	require.Error(t, err)
	require.False(t, verifyCodeInMemory("user@example.com", "123456", EmailVerificationPurpose))
}
