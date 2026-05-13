package common

import (
	"context"
	"errors"
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

const verificationRedisKeyPrefix = "verification:"

func GenerateVerificationCode(length int) string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	if length == 0 {
		return code
	}
	return code[:length]
}

func RegisterVerificationCodeWithKey(key string, code string, purpose string) {
	key = normalizeVerificationKey(key)
	if RedisEnabled && RDB != nil {
		err := RDB.Set(context.Background(), verificationRedisKey(key, purpose), code, verificationTTL()).Err()
		if err == nil {
			return
		}
		SysLog("failed to save verification code to Redis, falling back to memory: " + err.Error())
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
	key = normalizeVerificationKey(key)
	code = strings.TrimSpace(code)
	if RedisEnabled && RDB != nil {
		value, err := RDB.Get(context.Background(), verificationRedisKey(key, purpose)).Result()
		if err == nil {
			return code == value
		}
		if errors.Is(err, redis.Nil) {
			return false
		}
		SysLog("failed to read verification code from Redis, falling back to memory: " + err.Error())
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
	key = normalizeVerificationKey(key)
	if RedisEnabled && RDB != nil {
		if err := RDB.Del(context.Background(), verificationRedisKey(key, purpose)).Err(); err != nil {
			SysLog("failed to delete verification code from Redis: " + err.Error())
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

func verificationRedisKey(key string, purpose string) string {
	return verificationRedisKeyPrefix + purpose + ":" + key
}

func verificationTTL() time.Duration {
	return time.Duration(VerificationValidMinutes) * time.Minute
}

func normalizeVerificationKey(key string) string {
	return strings.ToLower(strings.TrimSpace(key))
}

func init() {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap = make(map[string]verificationValue)
}
