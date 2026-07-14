package common

import (
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
)

func resetVerificationTestState(t *testing.T) {
	t.Helper()

	oldRedisEnabled := RedisEnabled
	oldRDB := RDB
	oldMap := verificationMap
	oldValidMinutes := VerificationValidMinutes

	RedisEnabled = false
	RDB = nil
	verificationMap = make(map[string]verificationValue)
	VerificationValidMinutes = 10

	t.Cleanup(func() {
		RedisEnabled = oldRedisEnabled
		RDB = oldRDB
		verificationMap = oldMap
		VerificationValidMinutes = oldValidMinutes
	})
}

func TestVerificationCodeMemoryFallback(t *testing.T) {
	resetVerificationTestState(t)

	if err := RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose); err != nil {
		t.Fatalf("expected verification code registration to succeed: %v", err)
	}

	if !VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected verification code to match")
	}
	if VerifyCodeWithKey("user@example.com", "000000", EmailVerificationPurpose) {
		t.Fatal("expected wrong verification code to fail")
	}

	DeleteKey("user@example.com", EmailVerificationPurpose)
	if VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected deleted verification code to fail")
	}
}

func TestVerificationCodeMemoryExpiration(t *testing.T) {
	resetVerificationTestState(t)

	verificationMap[verificationKey("user@example.com", EmailVerificationPurpose)] = verificationValue{
		code: "123456",
		time: time.Now().Add(-time.Duration(VerificationValidMinutes)*time.Minute - time.Second),
	}

	if VerifyCodeWithKey("user@example.com", "123456", EmailVerificationPurpose) {
		t.Fatal("expected expired verification code to fail")
	}
}

func TestVerificationCodeRedisFailureDoesNotFallbackToMemory(t *testing.T) {
	resetVerificationTestState(t)

	client := redis.NewClient(&redis.Options{
		Addr:         "127.0.0.1:0",
		DialTimeout:  time.Millisecond,
		ReadTimeout:  time.Millisecond,
		WriteTimeout: time.Millisecond,
	})
	t.Cleanup(func() {
		_ = client.Close()
	})

	RedisEnabled = true
	RDB = client
	verificationMap[verificationKey("user@example.com", EmailVerificationPurpose)] = verificationValue{
		code: "stale",
		time: time.Now(),
	}

	if VerifyCodeWithKey("user@example.com", "stale", EmailVerificationPurpose) {
		t.Fatal("expected Redis-enabled verification not to fallback to memory")
	}

	if err := RegisterVerificationCodeWithKey("user@example.com", "123456", EmailVerificationPurpose); err == nil {
		t.Fatal("expected Redis write failure")
	}
	if _, ok := verificationMap[verificationKey("user@example.com", EmailVerificationPurpose)]; ok {
		t.Fatal("expected Redis write failure to clear stale in-memory code")
	}
}
