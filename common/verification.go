package common

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
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

const consumeVerificationCodeScript = `
local value = redis.call("GET", KEYS[1])
if not value then
	return 0
end
if value == ARGV[1] then
	return redis.call("DEL", KEYS[1])
end
return 0
`

func RegisterVerificationCodeWithKey(key string, code string, purpose string) {
	if redisVerificationEnabled() {
		if err := storeVerificationCodeInRedis(verificationRedisKey(key, purpose), code); err == nil {
			deleteVerificationCodeFromMemory(key, purpose)
			return
		} else {
			SysLog(fmt.Sprintf("failed to store verification code in Redis, falling back to memory: %v", err))
		}
	}

	storeVerificationCodeInMemory(key, code, purpose)
}

func storeVerificationCodeInRedis(redisKey string, code string) error {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis SET verification code: key=%s, expiration=%v", redisKey, verificationTTL()))
	}
	return RDB.Set(context.Background(), redisKey, code, verificationTTL()).Err()
}

func storeVerificationCodeInMemory(key string, code string, purpose string) {
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
	if redisVerificationEnabled() {
		value, err := RedisGet(verificationRedisKey(key, purpose))
		if err == nil {
			matched := verificationCodeEqual(value, code)
			if matched {
				deleteVerificationCodeFromMemory(key, purpose)
			}
			return matched
		}
		if errors.Is(err, redis.Nil) {
			return false
		}
		SysLog(fmt.Sprintf("failed to get verification code from Redis, falling back to memory: %v", err))
	}

	return verifyCodeInMemory(key, code, purpose)
}

func verifyCodeInMemory(key string, code string, purpose string) bool {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false
	}
	return verificationCodeEqual(value.code, code)
}

func ConsumeVerificationCodeWithKey(key string, code string, purpose string) (bool, error) {
	if redisVerificationEnabled() {
		matched, err := consumeVerificationCodeFromRedis(verificationRedisKey(key, purpose), code)
		if err == nil {
			if matched {
				deleteVerificationCodeFromMemory(key, purpose)
			}
			return matched, nil
		}
		SysLog(fmt.Sprintf("failed to consume verification code from Redis, falling back to memory: %v", err))
		if consumeVerificationCodeInMemory(key, code, purpose) {
			return true, nil
		}
		return false, err
	}

	return consumeVerificationCodeInMemory(key, code, purpose), nil
}

func consumeVerificationCodeFromRedis(redisKey string, code string) (bool, error) {
	if DebugEnabled {
		SysLog(fmt.Sprintf("Redis consume verification code: key=%s", redisKey))
	}
	result, err := RDB.Eval(context.Background(), consumeVerificationCodeScript, []string{redisKey}, code).Int()
	if err != nil {
		return false, err
	}
	return result == 1, nil
}

func consumeVerificationCodeInMemory(key string, code string, purpose string) bool {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false
	}
	if !verificationCodeEqual(value.code, code) {
		return false
	}
	delete(verificationMap, purpose+key)
	return true
}

func DeleteKey(key string, purpose string) error {
	var redisErr error
	if redisVerificationEnabled() {
		if err := RedisDel(verificationRedisKey(key, purpose)); err != nil {
			SysLog(fmt.Sprintf("failed to delete verification code from Redis, deleting memory fallback: %v", err))
			redisErr = err
		}
	}

	deleteVerificationCodeFromMemory(key, purpose)
	return redisErr
}

func deleteVerificationCodeFromMemory(key string, purpose string) {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	delete(verificationMap, purpose+key)
}

func redisVerificationEnabled() bool {
	return RedisEnabled && RDB != nil
}

func verificationTTL() time.Duration {
	return time.Duration(VerificationValidMinutes) * time.Minute
}

func verificationRedisKey(key string, purpose string) string {
	sum := sha256.Sum256([]byte(purpose + ":" + key))
	return "verification:" + purpose + ":" + hex.EncodeToString(sum[:])
}

func verificationCodeEqual(value string, code string) bool {
	return subtle.ConstantTimeCompare([]byte(value), []byte(code)) == 1
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
