package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/go-redis/redis/v8"
)

const (
	DeviceAuthStatusPending = "pending"
	// DeviceAuthStatusApproving is held while the approving request mints the
	// relay token, so a double-submitted approval cannot mint a second one.
	// Polls treat it exactly like pending.
	DeviceAuthStatusApproving = "approving"
	DeviceAuthStatusApproved  = "approved"
	DeviceAuthStatusDenied    = "denied"

	// DeviceAuthLifetime bounds how long an unapproved request stays usable.
	DeviceAuthLifetime = 10 * time.Minute
	// DeviceAuthPollInterval is the minimum gap the desktop app must leave
	// between token polls; faster polling is answered with slow_down.
	DeviceAuthPollInterval = 5 * time.Second

	deviceCodeRedisPrefix = "device_auth:device:"
	userCodeRedisPrefix   = "device_auth:user:"

	// Excludes vowels and glyphs that are easy to misread when a user retypes
	// the code from the desktop window into the browser.
	userCodeAlphabet = "BCDFGHJKLMNPQRSTVWXZ23456789"
	userCodeLength   = 8
)

var (
	ErrDeviceAuthNotFound    = errors.New("device authorization request not found")
	ErrDeviceAuthExpired     = errors.New("device authorization request has expired")
	ErrDeviceAuthAlreadyUsed = errors.New("device authorization request was already decided")
)

// DeviceAuthRequest is the short-lived record backing one desktop sign-in.
type DeviceAuthRequest struct {
	DeviceCode   string `json:"device_code"`
	UserCode     string `json:"user_code"`
	ClientName   string `json:"client_name"`
	ClientIP     string `json:"client_ip"`
	Status       string `json:"status"`
	UserId       int    `json:"user_id"`
	RelayTokenId int    `json:"relay_token_id"`
	ApiKey       string `json:"api_key"`
	CreatedAt    int64  `json:"created_at"`
	LastPolledAt int64  `json:"last_polled_at"`
}

func (r *DeviceAuthRequest) Expired() bool {
	return time.Now().Unix()-r.CreatedAt >= int64(DeviceAuthLifetime.Seconds())
}

type deviceAuthMemoryEntry struct {
	request  DeviceAuthRequest
	expireAt time.Time
}

var (
	deviceAuthMutex  sync.Mutex
	deviceAuthByCode = make(map[string]deviceAuthMemoryEntry)
	deviceAuthByUser = make(map[string]string)
)

func NewDeviceAuthRequest(clientName string, clientIP string) (*DeviceAuthRequest, error) {
	deviceCode, err := randomDeviceCode()
	if err != nil {
		return nil, err
	}
	userCode := ""
	for attempt := 0; attempt < 5; attempt++ {
		candidate, err := randomUserCode()
		if err != nil {
			return nil, err
		}
		existing, err := GetDeviceAuthByUserCode(candidate)
		if err != nil && !errors.Is(err, ErrDeviceAuthNotFound) {
			return nil, err
		}
		if existing == nil {
			userCode = candidate
			break
		}
	}
	if userCode == "" {
		return nil, errors.New("failed to allocate a unique user code")
	}
	request := &DeviceAuthRequest{
		DeviceCode: deviceCode,
		UserCode:   userCode,
		ClientName: clientName,
		ClientIP:   clientIP,
		Status:     DeviceAuthStatusPending,
		CreatedAt:  time.Now().Unix(),
	}
	if err := SaveDeviceAuthRequest(request); err != nil {
		return nil, err
	}
	return request, nil
}

func SaveDeviceAuthRequest(request *DeviceAuthRequest) error {
	if common.RedisEnabled {
		payload, err := common.Marshal(request)
		if err != nil {
			return err
		}
		ttl := remainingLifetime(request)
		if err := common.RedisSet(deviceCodeRedisPrefix+request.DeviceCode, string(payload), ttl); err != nil {
			return err
		}
		return common.RedisSet(userCodeRedisPrefix+request.UserCode, request.DeviceCode, ttl)
	}

	deviceAuthMutex.Lock()
	defer deviceAuthMutex.Unlock()
	sweepExpiredDeviceAuthLocked()
	deviceAuthByCode[request.DeviceCode] = deviceAuthMemoryEntry{
		request:  *request,
		expireAt: time.Now().Add(remainingLifetime(request)),
	}
	deviceAuthByUser[request.UserCode] = request.DeviceCode
	return nil
}

func GetDeviceAuthByDeviceCode(deviceCode string) (*DeviceAuthRequest, error) {
	if deviceCode == "" {
		return nil, ErrDeviceAuthNotFound
	}
	if common.RedisEnabled {
		payload, err := common.RedisGet(deviceCodeRedisPrefix + deviceCode)
		if err != nil || payload == "" {
			return nil, ErrDeviceAuthNotFound
		}
		request := &DeviceAuthRequest{}
		if err := common.UnmarshalJsonStr(payload, request); err != nil {
			return nil, err
		}
		return request, nil
	}

	deviceAuthMutex.Lock()
	defer deviceAuthMutex.Unlock()
	entry, ok := deviceAuthByCode[deviceCode]
	if !ok || time.Now().After(entry.expireAt) {
		return nil, ErrDeviceAuthNotFound
	}
	request := entry.request
	return &request, nil
}

func GetDeviceAuthByUserCode(userCode string) (*DeviceAuthRequest, error) {
	normalized := NormalizeUserCode(userCode)
	if normalized == "" {
		return nil, ErrDeviceAuthNotFound
	}
	if common.RedisEnabled {
		deviceCode, err := common.RedisGet(userCodeRedisPrefix + normalized)
		if err != nil || deviceCode == "" {
			return nil, ErrDeviceAuthNotFound
		}
		return GetDeviceAuthByDeviceCode(deviceCode)
	}

	deviceAuthMutex.Lock()
	deviceCode, ok := deviceAuthByUser[normalized]
	deviceAuthMutex.Unlock()
	if !ok {
		return nil, ErrDeviceAuthNotFound
	}
	return GetDeviceAuthByDeviceCode(deviceCode)
}

// deviceAuthAction is what a mutation decided to do with the record it was handed.
type deviceAuthAction int

const (
	deviceAuthKeep deviceAuthAction = iota
	deviceAuthSave
	deviceAuthDelete
)

// deviceAuthWatchAttempts bounds the optimistic retry loop; contention here is
// one desktop polling against one browser click, never a hot key.
const deviceAuthWatchAttempts = 5

// updateDeviceAuthRequest runs mutate against the stored record and applies its
// decision as one atomic step. Reading a copy, mutating it and blindly saving it
// back would let a poll that only wanted to stamp last_polled_at overwrite an
// approval that landed in between, losing the approval and orphaning the relay
// token it created.
func updateDeviceAuthRequest(deviceCode string, mutate func(*DeviceAuthRequest) (deviceAuthAction, error)) (*DeviceAuthRequest, error) {
	if deviceCode == "" {
		return nil, ErrDeviceAuthNotFound
	}
	if !common.RedisEnabled {
		deviceAuthMutex.Lock()
		defer deviceAuthMutex.Unlock()
		entry, ok := deviceAuthByCode[deviceCode]
		if !ok || time.Now().After(entry.expireAt) {
			return nil, ErrDeviceAuthNotFound
		}
		request := entry.request
		action, err := mutate(&request)
		if err != nil {
			return nil, err
		}
		switch action {
		case deviceAuthSave:
			deviceAuthByCode[deviceCode] = deviceAuthMemoryEntry{
				request:  request,
				expireAt: time.Now().Add(remainingLifetime(&request)),
			}
			deviceAuthByUser[request.UserCode] = deviceCode
		case deviceAuthDelete:
			delete(deviceAuthByCode, deviceCode)
			delete(deviceAuthByUser, request.UserCode)
		}
		return &request, nil
	}

	ctx := context.Background()
	key := deviceCodeRedisPrefix + deviceCode
	var result *DeviceAuthRequest
	txf := func(tx *redis.Tx) error {
		payload, err := tx.Get(ctx, key).Result()
		if err != nil || payload == "" {
			return ErrDeviceAuthNotFound
		}
		request := &DeviceAuthRequest{}
		if err := common.UnmarshalJsonStr(payload, request); err != nil {
			return err
		}
		action, err := mutate(request)
		if err != nil {
			return err
		}
		result = request
		if action == deviceAuthKeep {
			return nil
		}
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			if action == deviceAuthDelete {
				pipe.Del(ctx, key, userCodeRedisPrefix+request.UserCode)
				return nil
			}
			updated, err := common.Marshal(request)
			if err != nil {
				return err
			}
			ttl := remainingLifetime(request)
			pipe.Set(ctx, key, string(updated), ttl)
			pipe.Set(ctx, userCodeRedisPrefix+request.UserCode, request.DeviceCode, ttl)
			return nil
		})
		return err
	}
	for attempt := 0; attempt < deviceAuthWatchAttempts; attempt++ {
		err := common.RDB.Watch(ctx, txf, key)
		if errors.Is(err, redis.TxFailedErr) {
			continue
		}
		if err != nil {
			return nil, err
		}
		return result, nil
	}
	return nil, errors.New("device authorization request is being updated concurrently")
}

// PollDeviceAuthRequest advances one desktop poll. An approved request is
// consumed in the same atomic step, so the credentials are handed out exactly
// once even when two polls arrive together.
func PollDeviceAuthRequest(deviceCode string) (request *DeviceAuthRequest, tooSoon bool, err error) {
	request, err = updateDeviceAuthRequest(deviceCode, func(r *DeviceAuthRequest) (deviceAuthAction, error) {
		if r.Expired() || r.Status == DeviceAuthStatusDenied {
			return deviceAuthDelete, nil
		}
		if r.Status == DeviceAuthStatusApproved {
			return deviceAuthDelete, nil
		}
		now := time.Now().Unix()
		tooSoon = r.LastPolledAt > 0 && now-r.LastPolledAt < int64(DeviceAuthPollInterval.Seconds())
		r.LastPolledAt = now
		return deviceAuthSave, nil
	})
	return request, tooSoon, err
}

// ClaimDeviceAuthForApproval hands exactly one caller the right to approve a
// pending request, so a double-submitted approval cannot mint two desktop keys.
func ClaimDeviceAuthForApproval(userCode string, userId int) (*DeviceAuthRequest, error) {
	pending, err := GetDeviceAuthByUserCode(userCode)
	if err != nil {
		return nil, err
	}
	return updateDeviceAuthRequest(pending.DeviceCode, func(r *DeviceAuthRequest) (deviceAuthAction, error) {
		if r.Expired() {
			return deviceAuthKeep, ErrDeviceAuthExpired
		}
		if r.Status != DeviceAuthStatusPending {
			return deviceAuthKeep, ErrDeviceAuthAlreadyUsed
		}
		r.Status = DeviceAuthStatusApproving
		r.UserId = userId
		return deviceAuthSave, nil
	})
}

// CompleteDeviceAuthApproval publishes the credentials the desktop collects on
// its next poll.
func CompleteDeviceAuthApproval(deviceCode string, relayTokenId int, apiKey string) error {
	_, err := updateDeviceAuthRequest(deviceCode, func(r *DeviceAuthRequest) (deviceAuthAction, error) {
		r.Status = DeviceAuthStatusApproved
		r.RelayTokenId = relayTokenId
		r.ApiKey = apiKey
		return deviceAuthSave, nil
	})
	return err
}

// AbandonDeviceAuthApproval releases a claim whose approval failed, so the user
// can retry with the code still shown in the desktop window.
func AbandonDeviceAuthApproval(deviceCode string) {
	_, err := updateDeviceAuthRequest(deviceCode, func(r *DeviceAuthRequest) (deviceAuthAction, error) {
		if r.Status != DeviceAuthStatusApproving {
			return deviceAuthKeep, nil
		}
		r.Status = DeviceAuthStatusPending
		r.UserId = 0
		return deviceAuthSave, nil
	})
	if err != nil {
		common.SysError("failed to release device authorization claim: " + err.Error())
	}
}

// DenyDeviceAuthRequest records the user's refusal; the next poll reports it and
// drops the request.
func DenyDeviceAuthRequest(userCode string, userId int) error {
	pending, err := GetDeviceAuthByUserCode(userCode)
	if err != nil {
		return err
	}
	_, err = updateDeviceAuthRequest(pending.DeviceCode, func(r *DeviceAuthRequest) (deviceAuthAction, error) {
		if r.Expired() {
			return deviceAuthKeep, ErrDeviceAuthExpired
		}
		if r.Status != DeviceAuthStatusPending {
			return deviceAuthKeep, ErrDeviceAuthAlreadyUsed
		}
		r.Status = DeviceAuthStatusDenied
		r.UserId = userId
		return deviceAuthSave, nil
	})
	return err
}

func DeleteDeviceAuthRequest(request *DeviceAuthRequest) {
	if common.RedisEnabled {
		_ = common.RedisDel(deviceCodeRedisPrefix + request.DeviceCode)
		_ = common.RedisDel(userCodeRedisPrefix + request.UserCode)
		return
	}
	deviceAuthMutex.Lock()
	defer deviceAuthMutex.Unlock()
	delete(deviceAuthByCode, request.DeviceCode)
	delete(deviceAuthByUser, request.UserCode)
}

// NormalizeUserCode accepts what the user actually typed (lowercase, dashes,
// stray spaces) and reduces it to the stored form.
func NormalizeUserCode(userCode string) string {
	cleaned := strings.ToUpper(strings.TrimSpace(userCode))
	cleaned = strings.ReplaceAll(cleaned, "-", "")
	cleaned = strings.ReplaceAll(cleaned, " ", "")
	return cleaned
}

// FormatUserCode groups the stored code for display.
func FormatUserCode(userCode string) string {
	if len(userCode) != userCodeLength {
		return userCode
	}
	return userCode[:4] + "-" + userCode[4:]
}

func remainingLifetime(request *DeviceAuthRequest) time.Duration {
	elapsed := time.Since(time.Unix(request.CreatedAt, 0))
	remaining := DeviceAuthLifetime - elapsed
	if remaining < time.Second {
		return time.Second
	}
	return remaining
}

// no lock inside, so the caller must hold deviceAuthMutex
func sweepExpiredDeviceAuthLocked() {
	now := time.Now()
	for deviceCode, entry := range deviceAuthByCode {
		if now.After(entry.expireAt) {
			delete(deviceAuthByCode, deviceCode)
			delete(deviceAuthByUser, entry.request.UserCode)
		}
	}
}

func randomDeviceCode() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func randomUserCode() (string, error) {
	limit := big.NewInt(int64(len(userCodeAlphabet)))
	builder := strings.Builder{}
	for i := 0; i < userCodeLength; i++ {
		index, err := rand.Int(rand.Reader, limit)
		if err != nil {
			return "", err
		}
		builder.WriteByte(userCodeAlphabet[index.Int64()])
	}
	return builder.String(), nil
}
