package common

import (
	"crypto/sha256"
	"encoding/hex"
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

func verificationKey(key string, purpose string) string {
	return purpose + key
}

func verificationRedisEnabled() bool {
	return RedisEnabled && RDB != nil
}

func verificationRedisKey(key string, purpose string) string {
	sum := sha256.Sum256([]byte(purpose + ":" + key))
	return "verification:" + purpose + ":" + hex.EncodeToString(sum[:])
}

func GenerateVerificationCode(length int) string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	if length == 0 {
		return code
	}
	return code[:length]
}

func RegisterVerificationCodeWithKey(key string, code string, purpose string) error {
	if verificationRedisEnabled() {
		err := RedisSet(verificationRedisKey(key, purpose), code, time.Duration(VerificationValidMinutes)*time.Minute)
		if err != nil {
			SysLog("failed to save verification code to Redis: " + err.Error())
			deleteVerificationCodeInMemory(key, purpose)
			return err
		}
		deleteVerificationCodeInMemory(key, purpose)
		return nil
	}
	registerVerificationCodeInMemory(key, code, purpose)
	return nil
}

func registerVerificationCodeInMemory(key string, code string, purpose string) {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap[verificationKey(key, purpose)] = verificationValue{
		code: code,
		time: time.Now(),
	}
	if len(verificationMap) > verificationMapMaxSize {
		removeExpiredPairs()
	}
}

func VerifyCodeWithKey(key string, code string, purpose string) bool {
	if verificationRedisEnabled() {
		value, err := RedisGet(verificationRedisKey(key, purpose))
		if err == nil {
			return code == value
		}
		if !errors.Is(err, redis.Nil) {
			SysLog("failed to get verification code from Redis: " + err.Error())
		}
		return false
	}
	return verifyCodeWithKeyInMemory(key, code, purpose)
}

func verifyCodeWithKeyInMemory(key string, code string, purpose string) bool {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[verificationKey(key, purpose)]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false
	}
	return code == value.code
}

func DeleteKey(key string, purpose string) {
	if verificationRedisEnabled() {
		err := RedisDelKey(verificationRedisKey(key, purpose))
		if err != nil {
			SysLog("failed to delete verification code from Redis: " + err.Error())
		}
	}
	deleteVerificationCodeInMemory(key, purpose)
}

func deleteVerificationCodeInMemory(key string, purpose string) {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	delete(verificationMap, verificationKey(key, purpose))
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
