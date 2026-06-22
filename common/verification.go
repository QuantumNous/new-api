package common

import (
	"crypto/sha256"
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

func RegisterVerificationCodeWithKey(key string, code string, purpose string) error {
	if redisVerificationEnabled() {
		if err := RedisSet(verificationRedisKey(key, purpose), code, verificationTTL()); err == nil {
			deleteVerificationCodeFromMemory(key, purpose)
			return nil
		} else {
			SysLog(fmt.Sprintf("failed to store verification code in Redis, falling back to memory: %v", err))
		}
	}

	storeVerificationCodeInMemory(key, code, purpose)
	return nil
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
			return value == code
		}
		if !errors.Is(err, redis.Nil) {
			SysLog(fmt.Sprintf("failed to get verification code from Redis, falling back to memory: %v", err))
		}
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
	return code == value.code
}

func DeleteKey(key string, purpose string) {
	if redisVerificationEnabled() {
		if err := RedisDel(verificationRedisKey(key, purpose)); err != nil {
			SysLog(fmt.Sprintf("failed to delete verification code from Redis, deleting memory fallback: %v", err))
		}
	}

	deleteVerificationCodeFromMemory(key, purpose)
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
