package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCaptchaStoresCreatedAt(t *testing.T) {
	prevRedis := RedisEnabled
	RedisEnabled = false
	t.Cleanup(func() {
		RedisEnabled = prevRedis
	})

	before := time.Now().UnixMilli()
	SeedCaptchaForTest("cid-1", "123456")
	after := time.Now().UnixMilli()

	createdAt, ok := GetCaptchaCreatedAt("cid-1")
	require.True(t, ok)
	require.GreaterOrEqual(t, createdAt, before)
	require.LessOrEqual(t, createdAt, after)
	require.True(t, VerifyCaptcha("cid-1", "123456"))
	_, ok = GetCaptchaCreatedAt("cid-1")
	require.False(t, ok)
}

func TestCaptchaCreatedAtUsedForDuration(t *testing.T) {
	prevRedis := RedisEnabled
	RedisEnabled = false
	t.Cleanup(func() {
		RedisEnabled = prevRedis
	})

	issuedAt := time.Now().Add(-2 * time.Second).UnixMilli()
	SeedCaptchaWithCreatedAtForTest("cid-fast", "999999", issuedAt)
	createdAt, ok := GetCaptchaCreatedAt("cid-fast")
	require.True(t, ok)
	require.Equal(t, issuedAt, createdAt)
	require.Less(t, time.Now().UnixMilli()-createdAt, int64(3000))
	// peek does not consume
	require.True(t, VerifyCaptcha("cid-fast", "999999"))
}

func TestCaptchaWrongAnswerDoesNotConsume(t *testing.T) {
	prevRedis := RedisEnabled
	RedisEnabled = false
	t.Cleanup(func() {
		RedisEnabled = prevRedis
	})

	SeedCaptchaForTest("cid-wrong", "111111")
	require.False(t, VerifyCaptcha("cid-wrong", "000000"))
	require.True(t, VerifyCaptcha("cid-wrong", "111111"))
}
