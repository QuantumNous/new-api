package common

import (
	"testing"
	"time"
)

func resetVerificationMap() {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap = make(map[string]verificationValue)
}

func withRedisDisabled(t *testing.T) {
	t.Helper()
	prev := RedisEnabled
	RedisEnabled = false
	t.Cleanup(func() { RedisEnabled = prev })
}

func TestVerifyCodeWithKeyMemory(t *testing.T) {
	withRedisDisabled(t)
	resetVerificationMap()

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected correct code to verify")
	}
	if VerifyCodeWithKey("a@b.com", "000000", EmailVerificationPurpose) {
		t.Fatal("expected wrong code to fail")
	}
	if VerifyCodeWithKey("a@b.com", "123456", PasswordResetPurpose) {
		t.Fatal("expected different purpose to fail")
	}

	DeleteKey("a@b.com", EmailVerificationPurpose)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected deleted code to fail")
	}
}

func TestVerifyCodeWithKeyMemoryExpiry(t *testing.T) {
	withRedisDisabled(t)
	resetVerificationMap()

	prev := VerificationValidMinutes
	VerificationValidMinutes = 0
	t.Cleanup(func() { VerificationValidMinutes = prev })

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected expired code to fail")
	}
}

// Regression test: with Redis enabled, a code registered by one instance must
// verify on another instance whose in-memory map is empty.
func TestVerifyCodeWithKeyRedisCrossInstance(t *testing.T) {
	_, cleanup := setupMiniredis(t)
	defer cleanup()

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	// simulate the request landing on a different instance
	resetVerificationMap()

	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected code stored in Redis to verify on another instance")
	}
	if VerifyCodeWithKey("a@b.com", "000000", EmailVerificationPurpose) {
		t.Fatal("expected wrong code to fail")
	}
	if VerifyCodeWithKey("a@b.com", "123456", PasswordResetPurpose) {
		t.Fatal("expected different purpose to fail")
	}

	DeleteKey("a@b.com", EmailVerificationPurpose)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected deleted code to fail")
	}
}

func TestVerifyCodeWithKeyRedisExpiry(t *testing.T) {
	mr, cleanup := setupMiniredis(t)
	defer cleanup()

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	resetVerificationMap()

	// must verify via Redis first, so the expiry below exercises the real TTL
	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected code to verify before expiry")
	}

	mr.FastForward(time.Duration(VerificationValidMinutes)*time.Minute + time.Second)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected expired code to fail")
	}
}

// When Redis is enabled but unreachable, registration must fall back to the
// in-memory map so single-instance deployments keep working.
func TestVerifyCodeWithKeyRedisDownFallback(t *testing.T) {
	mr, cleanup := setupMiniredis(t)
	defer cleanup()
	resetVerificationMap()

	mr.Close() // Redis becomes unreachable

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected memory fallback to verify when Redis is down")
	}
}

// RedisEnabled defaults to true before InitRedisClient runs, leaving RDB nil;
// the verification functions must use the memory path instead of panicking.
func TestVerifyCodeWithKeyNilRDBFallsBackToMemory(t *testing.T) {
	prevEnabled, prevRDB := RedisEnabled, RDB
	RedisEnabled, RDB = true, nil
	t.Cleanup(func() { RedisEnabled, RDB = prevEnabled, prevRDB })
	resetVerificationMap()

	RegisterVerificationCodeWithKey("a@b.com", "123456", EmailVerificationPurpose)
	if !VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected memory path to work with nil RDB")
	}
	DeleteKey("a@b.com", EmailVerificationPurpose)
	if VerifyCodeWithKey("a@b.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected deleted code to fail")
	}
}
