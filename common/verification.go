package common

import (
	"context"
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

const verificationRedisPrefix = "verify_code:"

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

func verificationRedisKey(key, purpose string) string {
	return verificationRedisPrefix + purpose + ":" + key
}

func RegisterVerificationCodeWithKey(key string, code string, purpose string) {
	if RedisEnabled {
		ttl := time.Duration(VerificationValidMinutes) * time.Minute
		if err := RedisSet(verificationRedisKey(key, purpose), code, ttl); err != nil {
			SysError("RegisterVerificationCodeWithKey: redis set failed: " + err.Error())
		}
		return
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
	if RedisEnabled {
		stored, err := RedisGet(verificationRedisKey(key, purpose))
		if err != nil {
			if err != redis.Nil {
				SysError("VerifyCodeWithKey: redis get failed: " + err.Error())
			}
			return false
		}
		return stored == code
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
	if RedisEnabled {
		if err := RDB.Del(context.Background(), verificationRedisKey(key, purpose)).Err(); err != nil {
			SysError("DeleteKey: redis del failed: " + err.Error())
		}
		return
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
