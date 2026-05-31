package common

import "testing"

// Exercise the in-process map fallback path that's used when Redis is
// disabled. The Redis path is covered by live testing.
func TestVerifyCodeWithKey_MemoryFallback(t *testing.T) {
	prevRedis := RedisEnabled
	RedisEnabled = false
	t.Cleanup(func() { RedisEnabled = prevRedis })

	const key = "user@example.com"
	const code = "abc123"

	if VerifyCodeWithKey(key, code, EmailVerificationPurpose) {
		t.Fatalf("expected false before code is registered")
	}

	RegisterVerificationCodeWithKey(key, code, EmailVerificationPurpose)

	if !VerifyCodeWithKey(key, code, EmailVerificationPurpose) {
		t.Fatalf("expected true after registration")
	}

	if VerifyCodeWithKey(key, "wrong", EmailVerificationPurpose) {
		t.Fatalf("expected false for wrong code")
	}

	// Different purpose namespace must not collide.
	if VerifyCodeWithKey(key, code, PasswordResetPurpose) {
		t.Fatalf("purposes must be isolated")
	}

	DeleteKey(key, EmailVerificationPurpose)
	if VerifyCodeWithKey(key, code, EmailVerificationPurpose) {
		t.Fatalf("expected false after DeleteKey")
	}
}
