package common

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

type verificationValue struct {
	code string
	time time.Time
}

const (
	EmailVerificationPurpose = "v"
	PasswordResetPurpose     = "r"
	verificationRedisPrefix  = "verification:"
)

var verificationMutex sync.Mutex
var verificationMap map[string]verificationValue
var verificationMapMaxSize = 10
var VerificationValidMinutes = 10

func GenerateVerificationCode(length int) string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	if length == 0 {
		return code
	}
	return code[:length]
}

func verificationStorageKey(key string, purpose string) string {
	digest := sha256.Sum256([]byte(key))
	return fmt.Sprintf("%s%s:%x", verificationRedisPrefix, purpose, digest)
}

func verificationTTL() time.Duration {
	return time.Duration(VerificationValidMinutes) * time.Minute
}

func RegisterVerificationCodeWithKey(key string, code string, purpose string) error {
	if RedisEnabled {
		if RDB == nil {
			return fmt.Errorf("verification code storage: Redis is enabled but unavailable")
		}
		// Do not use RedisSet here: its debug logging includes the value, which
		// would disclose the verification code in application logs.
		if err := RDB.Set(context.Background(), verificationStorageKey(key, purpose), code, verificationTTL()).Err(); err != nil {
			return fmt.Errorf("store verification code in Redis: %w", err)
		}
		return nil
	}

	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap[purpose+key] = verificationValue{
		code: code,
		time: time.Now(),
	}
	if len(verificationMap) > verificationMapMaxSize {
		removeExpiredPairs()
	}
	return nil
}

func VerifyCodeWithKey(key string, code string, purpose string) (bool, error) {
	if RedisEnabled {
		if RDB == nil {
			return false, fmt.Errorf("verification code storage: Redis is enabled but unavailable")
		}
		storedCode, err := RedisGet(verificationStorageKey(key, purpose))
		if err != nil {
			// A missing or expired code is an ordinary failed verification. Other
			// Redis errors must remain distinguishable from an invalid code.
			if err == redis.Nil {
				return false, nil
			}
			return false, fmt.Errorf("read verification code from Redis: %w", err)
		}
		return secureCodeEqual(storedCode, code), nil
	}

	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false, nil
	}
	return secureCodeEqual(value.code, code), nil
}

func secureCodeEqual(expected string, actual string) bool {
	return subtle.ConstantTimeCompare([]byte(expected), []byte(actual)) == 1
}

func DeleteKey(key string, purpose string) error {
	if RedisEnabled {
		if RDB == nil {
			return fmt.Errorf("verification code storage: Redis is enabled but unavailable")
		}
		if err := RedisDel(verificationStorageKey(key, purpose)); err != nil {
			return fmt.Errorf("delete verification code from Redis: %w", err)
		}
		return nil
	}

	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	delete(verificationMap, purpose+key)
	return nil
}

// no lock inside, so the caller must lock the verificationMap before calling!
func removeExpiredPairs() {
	now := time.Now()
	for key := range verificationMap {
		if int(now.Sub(verificationMap[key].time).Seconds()) >= VerificationValidMinutes*60 {
			delete(verificationMap, key)
		}
	}
}

func init() {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap = make(map[string]verificationValue)
}
