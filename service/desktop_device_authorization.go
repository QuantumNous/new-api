package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

const (
	DesktopDeviceAuthorizationExpiresIn = 300
	DesktopDeviceAuthorizationInterval  = 5
	desktopDeviceAuthorizationMaxPoll   = 10
)

const (
	desktopAuthorizationPending   = "pending"
	desktopAuthorizationApproved  = "approved"
	desktopAuthorizationDenied    = "denied"
	desktopAuthorizationConsuming = "consuming"
	desktopAuthorizationIssued    = "issued"
)

var desktopUserCodeAlphabet = []byte("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

type DesktopDeviceAuthorizationError struct {
	Code       string
	RetryAfter int
	Cause      error
}

func (err *DesktopDeviceAuthorizationError) Error() string {
	if err.Cause != nil {
		return fmt.Sprintf("%s: %v", err.Code, err.Cause)
	}
	return err.Code
}

func (err *DesktopDeviceAuthorizationError) Unwrap() error {
	return err.Cause
}

type DesktopDeviceAuthorizationView struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type desktopDeviceAuthorizationRecord struct {
	Status          string `json:"status"`
	ClientName      string `json:"client_name"`
	UserCodeDigest  string `json:"user_code_digest"`
	UserID          int    `json:"user_id"`
	UserAuthVersion int64  `json:"user_auth_version"`
	CreatedAt       int64  `json:"created_at"`
	ExpiresAt       int64  `json:"expires_at"`
	NextPollAt      int64  `json:"next_poll_at"`
	PollInterval    int    `json:"poll_interval"`
}

func DesktopDeviceAuthorizationAvailable() bool {
	return common.RedisEnabled && common.RDB != nil
}

func CreateDesktopDeviceAuthorization(clientName string, serverAddress string) (*DesktopDeviceAuthorizationView, error) {
	if !DesktopDeviceAuthorizationAvailable() {
		return nil, desktopAuthorizationError("temporarily_unavailable", 0, nil)
	}
	clientName = strings.TrimSpace(clientName)
	if len(clientName) > 80 {
		return nil, desktopAuthorizationError("invalid_request", 0, nil)
	}
	if clientName == "" {
		clientName = "野菜API Desktop"
	}
	verificationURI := strings.TrimRight(strings.TrimSpace(serverAddress), "/") + "/desktop-authorize"
	if strings.HasPrefix(verificationURI, "/") {
		return nil, desktopAuthorizationError("temporarily_unavailable", 0, errors.New("server address is not configured"))
	}

	const createScript = `
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`
	now := time.Now().Unix()
	for range 8 {
		deviceCode, err := common.GenerateRandomCharsKey(64)
		if err != nil {
			return nil, desktopAuthorizationError("server_error", 0, err)
		}
		userCode, err := generateDesktopUserCode()
		if err != nil {
			return nil, desktopAuthorizationError("server_error", 0, err)
		}
		deviceDigest := desktopAuthorizationDigest(deviceCode)
		userDigest := desktopAuthorizationDigest(userCode)
		record := desktopDeviceAuthorizationRecord{
			Status:         desktopAuthorizationPending,
			ClientName:     clientName,
			UserCodeDigest: userDigest,
			CreatedAt:      now,
			ExpiresAt:      now + DesktopDeviceAuthorizationExpiresIn,
			PollInterval:   DesktopDeviceAuthorizationInterval,
		}
		payload, err := common.Marshal(record)
		if err != nil {
			return nil, desktopAuthorizationError("server_error", 0, err)
		}
		created, err := common.RDB.Eval(
			context.Background(),
			createScript,
			[]string{desktopDeviceAuthorizationKey(deviceDigest), desktopUserAuthorizationKey(userDigest)},
			string(payload),
			deviceDigest,
			DesktopDeviceAuthorizationExpiresIn,
		).Int()
		if err != nil {
			return nil, desktopAuthorizationError("temporarily_unavailable", 0, err)
		}
		if created != 1 {
			continue
		}
		return &DesktopDeviceAuthorizationView{
			DeviceCode:              deviceCode,
			UserCode:                userCode,
			VerificationURI:         verificationURI,
			VerificationURIComplete: verificationURI + "?user_code=" + url.QueryEscape(userCode),
			ExpiresIn:               DesktopDeviceAuthorizationExpiresIn,
			Interval:                DesktopDeviceAuthorizationInterval,
		}, nil
	}
	return nil, desktopAuthorizationError("server_error", 0, errors.New("could not allocate a unique device authorization"))
}

func DecideDesktopDeviceAuthorization(userCode string, decision string, userID int, userAuthVersion int64) (string, string, error) {
	if !DesktopDeviceAuthorizationAvailable() {
		return "", "", desktopAuthorizationError("temporarily_unavailable", 0, nil)
	}
	normalized, ok := normalizeDesktopUserCode(userCode)
	if !ok || userID <= 0 || userAuthVersion <= 0 {
		return "", "", desktopAuthorizationError("invalid_request", 0, nil)
	}
	status := desktopAuthorizationApproved
	if decision == "deny" {
		status = desktopAuthorizationDenied
	} else if decision != "approve" {
		return "", "", desktopAuthorizationError("invalid_request", 0, nil)
	}
	ctx := context.Background()
	userKey := desktopUserAuthorizationKey(desktopAuthorizationDigest(normalized))
	deviceDigest, err := common.RDB.Get(ctx, userKey).Result()
	if errors.Is(err, redis.Nil) {
		return "", "", desktopAuthorizationError("expired_token", 0, nil)
	}
	if err != nil {
		return "", "", desktopAuthorizationError("temporarily_unavailable", 0, err)
	}
	deviceKey := desktopDeviceAuthorizationKey(deviceDigest)
	var clientName string
	err = watchDesktopAuthorization(ctx, []string{deviceKey}, func(tx *redis.Tx) error {
		raw, getErr := tx.Get(ctx, deviceKey).Result()
		if errors.Is(getErr, redis.Nil) {
			return desktopAuthorizationError("expired_token", 0, nil)
		}
		if getErr != nil {
			return getErr
		}
		var record desktopDeviceAuthorizationRecord
		if unmarshalErr := common.UnmarshalJsonStr(raw, &record); unmarshalErr != nil {
			return unmarshalErr
		}
		clientName = record.ClientName
		if record.ExpiresAt <= time.Now().Unix() {
			return desktopAuthorizationError("expired_token", 0, nil)
		}
		if record.Status == status {
			if status == desktopAuthorizationDenied || (record.UserID == userID && record.UserAuthVersion == userAuthVersion) {
				return nil
			}
		}
		if record.Status != desktopAuthorizationPending {
			return desktopAuthorizationError("decision_conflict", 0, nil)
		}
		record.Status = status
		if status == desktopAuthorizationApproved {
			record.UserID = userID
			record.UserAuthVersion = userAuthVersion
		}
		payload, marshalErr := common.Marshal(record)
		if marshalErr != nil {
			return marshalErr
		}
		_, updateErr := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, deviceKey, string(payload), redis.KeepTTL)
			return nil
		})
		return updateErr
	})
	if err != nil {
		var flowErr *DesktopDeviceAuthorizationError
		if errors.As(err, &flowErr) {
			return "", clientName, flowErr
		}
		return "", clientName, desktopAuthorizationError("temporarily_unavailable", 0, err)
	}
	return status, clientName, nil
}

func ExchangeDesktopDeviceAuthorization(deviceCode string, ip string, userAgent string) (*AuthBundle, error) {
	if !DesktopDeviceAuthorizationAvailable() {
		return nil, desktopAuthorizationError("temporarily_unavailable", 0, nil)
	}
	deviceCode = strings.TrimSpace(deviceCode)
	if len(deviceCode) < 32 || len(deviceCode) > 128 {
		return nil, desktopAuthorizationError("invalid_device_code", 0, nil)
	}
	ctx := context.Background()
	deviceKey := desktopDeviceAuthorizationKey(desktopAuthorizationDigest(deviceCode))
	var claimed desktopDeviceAuthorizationRecord
	var outcomeErr error
	err := watchDesktopAuthorization(ctx, []string{deviceKey}, func(tx *redis.Tx) error {
		raw, getErr := tx.Get(ctx, deviceKey).Result()
		if errors.Is(getErr, redis.Nil) {
			return desktopAuthorizationError("expired_token", 0, nil)
		}
		if getErr != nil {
			return getErr
		}
		var record desktopDeviceAuthorizationRecord
		if unmarshalErr := common.UnmarshalJsonStr(raw, &record); unmarshalErr != nil {
			return unmarshalErr
		}
		now := time.Now().Unix()
		if record.ExpiresAt <= now {
			return desktopAuthorizationError("expired_token", 0, nil)
		}
		switch record.Status {
		case desktopAuthorizationPending:
			if record.NextPollAt > now {
				if record.PollInterval < desktopDeviceAuthorizationMaxPoll {
					record.PollInterval++
				}
				record.NextPollAt = now + int64(record.PollInterval)
				outcomeErr = desktopAuthorizationError("slow_down", record.PollInterval, nil)
			} else {
				record.NextPollAt = now + int64(record.PollInterval)
				outcomeErr = desktopAuthorizationError("authorization_pending", record.PollInterval, nil)
			}
		case desktopAuthorizationDenied:
			return desktopAuthorizationError("access_denied", 0, nil)
		case desktopAuthorizationConsuming, desktopAuthorizationIssued:
			return desktopAuthorizationError("already_used", 0, nil)
		case desktopAuthorizationApproved:
			record.Status = desktopAuthorizationConsuming
			claimed = record
		default:
			return desktopAuthorizationError("invalid_device_code", 0, nil)
		}
		payload, marshalErr := common.Marshal(record)
		if marshalErr != nil {
			return marshalErr
		}
		_, updateErr := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, deviceKey, string(payload), redis.KeepTTL)
			return nil
		})
		return updateErr
	})
	if err != nil {
		var flowErr *DesktopDeviceAuthorizationError
		if errors.As(err, &flowErr) {
			return nil, flowErr
		}
		return nil, desktopAuthorizationError("temporarily_unavailable", 0, err)
	}
	if outcomeErr != nil {
		return nil, outcomeErr
	}
	if claimed.UserID <= 0 || claimed.UserAuthVersion <= 0 {
		return nil, desktopAuthorizationError("invalid_device_code", 0, nil)
	}
	bundle, err := CreateLoginSessionAtAuthVersion(claimed.UserID, claimed.UserAuthVersion, DesktopLoginMethod, ip, userAgent)
	if err != nil {
		rollbackDesktopAuthorizationClaim(deviceKey)
		return nil, desktopAuthorizationError("server_error", 0, err)
	}
	markDesktopAuthorizationIssued(deviceKey)
	_ = common.RedisDel(desktopUserAuthorizationKey(claimed.UserCodeDigest))
	return bundle, nil
}

func generateDesktopUserCode() (string, error) {
	code := make([]byte, 8)
	for index := range code {
		value, err := rand.Int(rand.Reader, big.NewInt(int64(len(desktopUserCodeAlphabet))))
		if err != nil {
			return "", err
		}
		code[index] = desktopUserCodeAlphabet[value.Int64()]
	}
	return string(code[:4]) + "-" + string(code[4:]), nil
}

func normalizeDesktopUserCode(value string) (string, bool) {
	compact := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(value), "-", ""))
	if len(compact) != 8 {
		return "", false
	}
	for _, char := range []byte(compact) {
		if !strings.ContainsRune(string(desktopUserCodeAlphabet), rune(char)) {
			return "", false
		}
	}
	return compact[:4] + "-" + compact[4:], true
}

func desktopAuthorizationDigest(value string) string {
	digest := sha256.Sum256([]byte(value))
	return hex.EncodeToString(digest[:])
}

func desktopDeviceAuthorizationKey(digest string) string {
	return "desktop:v2:device:" + digest
}

func desktopUserAuthorizationKey(digest string) string {
	return "desktop:v2:user:" + digest
}

func desktopAuthorizationError(code string, retryAfter int, cause error) error {
	return &DesktopDeviceAuthorizationError{Code: code, RetryAfter: retryAfter, Cause: cause}
}

func rollbackDesktopAuthorizationClaim(deviceKey string) {
	ctx := context.Background()
	_ = watchDesktopAuthorization(ctx, []string{deviceKey}, func(tx *redis.Tx) error {
		raw, err := tx.Get(ctx, deviceKey).Result()
		if err != nil {
			return err
		}
		var record desktopDeviceAuthorizationRecord
		if err := common.UnmarshalJsonStr(raw, &record); err != nil {
			return err
		}
		if record.Status != desktopAuthorizationConsuming {
			return nil
		}
		record.Status = desktopAuthorizationApproved
		payload, err := common.Marshal(record)
		if err != nil {
			return err
		}
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, deviceKey, string(payload), redis.KeepTTL)
			return nil
		})
		return err
	})
}

func markDesktopAuthorizationIssued(deviceKey string) {
	ctx := context.Background()
	_ = watchDesktopAuthorization(ctx, []string{deviceKey}, func(tx *redis.Tx) error {
		raw, err := tx.Get(ctx, deviceKey).Result()
		if err != nil {
			return err
		}
		var record desktopDeviceAuthorizationRecord
		if err := common.UnmarshalJsonStr(raw, &record); err != nil {
			return err
		}
		if record.Status != desktopAuthorizationConsuming {
			return nil
		}
		record.Status = desktopAuthorizationIssued
		payload, err := common.Marshal(record)
		if err != nil {
			return err
		}
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, deviceKey, string(payload), redis.KeepTTL)
			return nil
		})
		return err
	})
}

func watchDesktopAuthorization(ctx context.Context, keys []string, update func(*redis.Tx) error) error {
	var err error
	for range 16 {
		err = common.RDB.Watch(ctx, update, keys...)
		if !errors.Is(err, redis.TxFailedErr) {
			return err
		}
	}
	return err
}
