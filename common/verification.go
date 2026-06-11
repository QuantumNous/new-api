package common

import (
	"context"
	"errors"
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

func verificationRedisKey(key string, purpose string) string {
	return fmt.Sprintf("verification:%s:%s", purpose, key)
}

// RDB stays nil until InitRedisClient even though RedisEnabled defaults to
// true, so guard both (same as PublishConfigChanged in redis_pubsub.go).
func verificationRedisUsable() bool {
	return RedisEnabled && RDB != nil
}

// Codes must be stored in Redis when it is enabled: with multiple instances
// behind a load balancer, the instance that verifies a code is usually not
// the one that generated it, so the in-memory map only works single-instance.
//
// These call RDB directly instead of the RedisSet/RedisGet wrappers: codes
// are credentials, and the wrappers log keys and values in debug mode.
func RegisterVerificationCodeWithKey(key string, code string, purpose string) {
	if verificationRedisUsable() {
		err := RDB.Set(context.Background(), verificationRedisKey(key, purpose), code, time.Duration(VerificationValidMinutes)*time.Minute).Err()
		if err == nil {
			return
		}
		SysError("failed to store verification code in Redis, falling back to memory: " + err.Error())
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
}

func VerifyCodeWithKey(key string, code string, purpose string) bool {
	if verificationRedisUsable() {
		storedCode, err := RDB.Get(context.Background(), verificationRedisKey(key, purpose)).Result()
		if err == nil {
			return code == storedCode
		}
		if !errors.Is(err, redis.Nil) {
			SysError("failed to read verification code from Redis: " + err.Error())
		}
		// fall through to the in-memory map, which may hold codes stored
		// there when a Redis write failed
	}
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false
	}
	return code == value.code
}

func DeleteKey(key string, purpose string) {
	if verificationRedisUsable() {
		if err := RDB.Del(context.Background(), verificationRedisKey(key, purpose)).Err(); err != nil {
			SysError("failed to delete verification code from Redis: " + err.Error())
		}
	}
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	delete(verificationMap, purpose+key)
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
