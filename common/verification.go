package common

import (
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

var ErrVerificationCodeInvalid = errors.New("verification code is invalid")

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

// ConsumeVerificationCodeWithKey validates and consumes a verification code
// in one critical section. Call it only after the protected operation commits;
// callers that need rollback semantics should keep the operation idempotent.
func ConsumeVerificationCodeWithKey(key string, code string, purpose string) bool {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 || value.code != code {
		return false
	}
	delete(verificationMap, purpose+key)
	return true
}

// ConsumeVerificationCodeWithAction reserves the code under the mutex, runs
// the protected operation without holding the global lock, and restores the
// code if the action fails so transient database errors do not strand a retry.
func ConsumeVerificationCodeWithAction(key string, code string, purpose string, action func() error) error {
	verificationMutex.Lock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 || value.code != code {
		verificationMutex.Unlock()
		return ErrVerificationCodeInvalid
	}
	delete(verificationMap, purpose+key)
	verificationMutex.Unlock()

	if action == nil {
		return nil
	}
	if err := action(); err != nil {
		verificationMutex.Lock()
		if _, exists := verificationMap[purpose+key]; !exists {
			verificationMap[purpose+key] = value
		}
		verificationMutex.Unlock()
		return err
	}
	return nil
}

func DeleteKey(key string, purpose string) {
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
