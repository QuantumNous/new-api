package common

import (
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type verificationValue struct {
	code string
	time time.Time
}

const (
	EmailVerificationPurpose = "v"
	PasswordResetPurpose     = "r"
	// EmailLoginPurpose namespaces JINN passwordless-with-code login.
	EmailLoginPurpose = "el"
)

var verificationMutex sync.Mutex
var verificationMap map[string]verificationValue
var verificationMapMaxSize = 10
var VerificationValidMinutes = 10

// verificationAttempts tracks wrong-code attempts per (purpose+key).
// Reset to 0 on success or on a fresh code request.
var verificationAttemptsMutex sync.Mutex
var verificationAttempts = map[string]int{}

func GenerateVerificationCode(length int) string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	if length == 0 {
		return code
	}
	return code[:length]
}

func RegisterVerificationCodeWithKey(key string, code string, purpose string) {
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
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	delete(verificationMap, purpose+key)
}

// IncrementAttemptsAndMaybeInvalidate bumps the wrong-code counter for
// (purpose+key). If the new count is >= max, the stored code is deleted so
// subsequent VerifyCodeWithKey calls return false (user must request a new
// code). Returns the new attempt count.
func IncrementAttemptsAndMaybeInvalidate(key string, purpose string, max int) int {
	verificationAttemptsMutex.Lock()
	mapKey := purpose + key
	verificationAttempts[mapKey]++
	count := verificationAttempts[mapKey]
	verificationAttemptsMutex.Unlock()
	if max > 0 && count >= max {
		DeleteKey(key, purpose)
		ResetAttempts(key, purpose)
	}
	return count
}

func ResetAttempts(key string, purpose string) {
	verificationAttemptsMutex.Lock()
	defer verificationAttemptsMutex.Unlock()
	delete(verificationAttempts, purpose+key)
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
