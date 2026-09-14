package common

import (
	"bytes"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
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
