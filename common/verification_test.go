package common

import (
	"bytes"
	"context"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetVerificationTestState(t *testing.T) {
	t.Helper()

	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	oldValidMinutes := VerificationValidMinutes
	oldDebugEnabled := DebugEnabled
	t.Cleanup(func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
		VerificationValidMinutes = oldValidMinutes
		DebugEnabled = oldDebugEnabled
		verificationMutex.Lock()
		verificationMap = make(map[string]verificationValue)
		verificationMutex.Unlock()
	})

	RedisEnabled = false
	RDB = nil
	VerificationValidMinutes = 10
	DebugEnabled = false
	verificationMutex.Lock()
	verificationMap = make(map[string]verificationValue)
	verificationMutex.Unlock()
}

func newFailingRedisClient() *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:         "127.0.0.1:0",
		DialTimeout:  time.Millisecond,
		ReadTimeout:  time.Millisecond,
		WriteTimeout: time.Millisecond,
	})
}

func setupRedisVerificationTest(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	resetVerificationTestState(t)
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	t.Cleanup(func() { require.NoError(t, client.Close()) })
	RedisEnabled = true
	RDB = client
	return server
}

func TestVerificationCodesRedisAcrossClients(t *testing.T) {
	server := setupRedisVerificationTest(t)
	storeVerificationCodeInMemory("user@example.com", "stale-code", EmailVerificationPurpose)
	RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)
	RegisterVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)

	// A separate client with no local codes must read the shared store.
	require.Empty(t, verificationMap)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { require.NoError(t, client.Close()) })
	RDB = client

	assert.False(t, VerifyCodeWithKey("other@example.com", "123456", EmailVerificationPurpose))
	assert.False(t, VerifyCodeWithKey("user@example.com", "wrong", EmailVerificationPurpose))
	assert.False(t, VerifyCodeWithKey("user@example.com", "reset-token", EmailVerificationPurpose))
	assert.False(t, VerifyCodeWithKey("user@example.com", "123456", PasswordResetPurpose))
	assert.True(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
	assert.True(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))

	require.NoError(t, DeleteKey("user@example.com", EmailVerificationPurpose))
	assert.False(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
	storeVerificationCodeInMemory("user@example.com", "reset-token", PasswordResetPurpose)
	assert.True(t, VerifyCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose))
	assert.False(t, VerifyCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose))
	assert.False(t, verifyCodeInMemory("user@example.com", "reset-token", PasswordResetPurpose))
	assert.Empty(t, server.Keys())
}

func TestVerificationCodesRedisExpire(t *testing.T) {
	for _, purpose := range []string{EmailVerificationPurpose, PasswordResetPurpose} {
		t.Run(purpose, func(t *testing.T) {
			server := setupRedisVerificationTest(t)
			VerificationValidMinutes = 2
			RegisterVerificationCodeWithKey("user@example.com", "123456", purpose)
			require.Empty(t, verificationMap)
			keys := server.Keys()
			require.Len(t, keys, 1)
			ttl, err := RDB.TTL(context.Background(), keys[0]).Result()
			require.NoError(t, err)
			assert.Equal(t, 2*time.Minute, ttl)

			server.FastForward(2*time.Minute - time.Second)
			assert.True(t, server.Exists(keys[0]))
			server.FastForward(time.Second)
			assert.False(t, VerifyCodeWithKey("user@example.com", "123456", purpose))
			assert.Empty(t, server.Keys())
		})
	}
}

func TestPasswordResetVerificationRedisConcurrentConsume(t *testing.T) {
	server := setupRedisVerificationTest(t)
	RegisterVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.Empty(t, verificationMap)

	start := make(chan struct{})
	results := make(chan bool, 2)
	var consumers sync.WaitGroup
	for range 2 {
		consumers.Go(func() {
			<-start
			results <- VerifyCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
		})
	}
	close(start)
	consumers.Wait()
	close(results)
	var successes int
	for matched := range results {
		if matched {
			successes++
		}
	}
	assert.Equal(t, 1, successes)
	assert.Empty(t, server.Keys())
}

func TestVerificationCodesRedisRecoveryKeepsMissAuthoritative(t *testing.T) {
	for _, purpose := range []string{EmailVerificationPurpose, PasswordResetPurpose} {
		t.Run(purpose, func(t *testing.T) {
			server := setupRedisVerificationTest(t)
			server.SetError("ERR verification store unavailable")
			RegisterVerificationCodeWithKey("user@example.com", "123456", purpose)
			require.True(t, verifyCodeInMemory("user@example.com", "123456", purpose))
			require.Empty(t, server.Keys())

			// Recovery does not migrate local-only codes into Redis. A miss
			// must not fall back to memory, which could revive a consumed code.
			server.SetError("")
			assert.False(t, VerifyCodeWithKey("user@example.com", "123456", purpose))
			assert.True(t, verifyCodeInMemory("user@example.com", "123456", purpose))
			// A code written by another instance is authoritative too.
			require.NoError(t, RDB.Set(context.Background(), verificationRedisKey("user@example.com", purpose),
				"remote-code", time.Minute).Err())
			assert.False(t, VerifyCodeWithKey("user@example.com", "123456", purpose))

			// An error, unlike a miss, still permits the local fallback.
			server.SetError("ERR verification store unavailable")
			assert.False(t, VerifyCodeWithKey("user@example.com", "wrong", purpose))
			assert.True(t, VerifyCodeWithKey("user@example.com", "123456", purpose))
			assert.Equal(t, purpose == EmailVerificationPurpose,
				VerifyCodeWithKey("user@example.com", "123456", purpose))
		})
	}
}

func TestConsumeVerificationCodeRedisMissAndError(t *testing.T) {
	server := setupRedisVerificationTest(t)
	matched, err := ConsumeVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.NoError(t, err)
	assert.False(t, matched)

	server.SetError("ERR verification store unavailable")
	matched, err = ConsumeVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.EqualError(t, err, "ERR verification store unavailable")
	assert.False(t, matched)
}

func TestPasswordResetVerificationConsumesMemoryToken(t *testing.T) {
	resetVerificationTestState(t)

	RegisterVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)

	require.True(t, VerifyCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose))
	require.False(t, VerifyCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose))
}

func TestEmailVerificationKeepsMemoryCodeUntilDelete(t *testing.T) {
	resetVerificationTestState(t)

	RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)

	require.True(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
	require.True(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
	require.NoError(t, DeleteKey("user@example.com", EmailVerificationPurpose))
	require.False(t, VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
}

func TestVerificationCodesDoNotLogRedisValues(t *testing.T) {
	resetVerificationTestState(t)

	client := newFailingRedisClient()
	defer client.Close()

	var logs bytes.Buffer
	LogWriterMu.Lock()
	oldWriter := gin.DefaultWriter
	gin.DefaultWriter = &logs
	LogWriterMu.Unlock()
	t.Cleanup(func() {
		LogWriterMu.Lock()
		gin.DefaultWriter = oldWriter
		LogWriterMu.Unlock()
	})

	RedisEnabled = true
	RDB = client
	DebugEnabled = true

	token := "password-reset-token-should-not-be-logged"
	RegisterVerificationCodeWithKey("user@example.com", token, PasswordResetPurpose)

	require.NotContains(t, logs.String(), token)
	require.Contains(t, logs.String(), "Redis SET verification code")
}

func TestVerificationCodesConsumeMemoryFallbackWhenRedisFails(t *testing.T) {
	resetVerificationTestState(t)

	client := newFailingRedisClient()
	defer client.Close()
	RedisEnabled = true
	RDB = client

	RegisterVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)

	ok, err := ConsumeVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = ConsumeVerificationCodeWithKey("user@example.com", "reset-token", PasswordResetPurpose)
	require.Error(t, err)
	require.False(t, ok)
}

func TestVerificationCodesDeleteReturnsRedisError(t *testing.T) {
	resetVerificationTestState(t)

	client := newFailingRedisClient()
	defer client.Close()
	RedisEnabled = true
	RDB = client
	storeVerificationCodeInMemory("user@example.com", "123456", EmailVerificationPurpose)

	err := DeleteKey("user@example.com", EmailVerificationPurpose)
	require.Error(t, err)
	require.False(t, verifyCodeInMemory("user@example.com", "123456", EmailVerificationPurpose))
}
