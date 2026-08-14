package common

import (
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useVerificationTestState(t *testing.T) {
	t.Helper()
	previousRedisEnabled := RedisEnabled
	previousRDB := RDB
	previousValidMinutes := VerificationValidMinutes
	verificationMutex.Lock()
	previousMap := verificationMap
	verificationMap = make(map[string]verificationValue)
	verificationMutex.Unlock()
	t.Cleanup(func() {
		RedisEnabled = previousRedisEnabled
		RDB = previousRDB
		VerificationValidMinutes = previousValidMinutes
		verificationMutex.Lock()
		verificationMap = previousMap
		verificationMutex.Unlock()
	})
}

func TestVerificationCodeUsesMemoryWithoutRedis(t *testing.T) {
	useVerificationTestState(t)
	RedisEnabled = false

	require.NoError(t, RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose))
	valid, err := VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)
	require.NoError(t, err)
	assert.True(t, valid)

	valid, err = VerifyCodeWithKey("user@example.com", "wrong", EmailVerificationPurpose)
	require.NoError(t, err)
	assert.False(t, valid)

	require.NoError(t, DeleteKey("user@example.com", EmailVerificationPurpose))
	valid, err = VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)
	require.NoError(t, err)
	assert.False(t, valid)
}

func TestVerificationCodeIsSharedAcrossRedisClients(t *testing.T) {
	useVerificationTestState(t)
	server := miniredis.RunT(t)
	clientA := redis.NewClient(&redis.Options{Addr: server.Addr()})
	clientB := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		_ = clientA.Close()
		_ = clientB.Close()
	})
	RedisEnabled = true
	RDB = clientA

	require.NoError(t, RegisterVerificationCodeWithKey("cluster@example.com", "654321", EmailVerificationPurpose))
	RDB = clientB
	valid, err := VerifyCodeWithKey("cluster@example.com", "654321", EmailVerificationPurpose)
	require.NoError(t, err)
	assert.True(t, valid, "a code created by one node must be readable by another node")
}

func TestVerificationCodeRedisTTLAndPurposeIsolation(t *testing.T) {
	useVerificationTestState(t)
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	RedisEnabled = true
	RDB = client
	VerificationValidMinutes = 10

	require.NoError(t, RegisterVerificationCodeWithKey("same@example.com", "email-code", EmailVerificationPurpose))
	require.NoError(t, RegisterVerificationCodeWithKey("same@example.com", "reset-code", PasswordResetPurpose))

	valid, err := VerifyCodeWithKey("same@example.com", "email-code", PasswordResetPurpose)
	require.NoError(t, err)
	assert.False(t, valid)
	valid, err = VerifyCodeWithKey("same@example.com", "reset-code", PasswordResetPurpose)
	require.NoError(t, err)
	assert.True(t, valid)

	server.FastForward(10 * time.Minute)
	valid, err = VerifyCodeWithKey("same@example.com", "email-code", EmailVerificationPurpose)
	require.NoError(t, err)
	assert.False(t, valid)
	valid, err = VerifyCodeWithKey("same@example.com", "reset-code", PasswordResetPurpose)
	require.NoError(t, err)
	assert.False(t, valid)
}

func TestVerificationCodeDoesNotSilentlyFallBackWhenRedisFails(t *testing.T) {
	useVerificationTestState(t)
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	RedisEnabled = true
	RDB = client
	server.Close()

	err := RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)
	require.Error(t, err)

	_, err = VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose)
	require.Error(t, err)
}

func TestVerificationStorageKeyDoesNotExposeEmail(t *testing.T) {
	storageKey := verificationStorageKey("private@example.com", EmailVerificationPurpose)
	assert.NotContains(t, storageKey, "private@example.com")
	assert.Contains(t, storageKey, verificationRedisPrefix+EmailVerificationPurpose+":")
}
