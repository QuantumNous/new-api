package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

const DesktopConnectCodeTTLSeconds = 300

type DesktopConnectCodeError struct {
	Code  string
	Cause error
}

func (err *DesktopConnectCodeError) Error() string {
	if err.Cause != nil {
		return fmt.Sprintf("%s: %v", err.Code, err.Cause)
	}
	return err.Code
}

func (err *DesktopConnectCodeError) Unwrap() error {
	return err.Cause
}

type DesktopConnectCodeIssueView struct {
	Code       string `json:"code"`
	Origin     string `json:"origin"`
	ExpiresAt  int64  `json:"expiresAt"`
	TTLSeconds int    `json:"ttlSeconds"`
}

type desktopConnectCodeRecord struct {
	Origin          string `json:"origin"`
	UserID          int    `json:"user_id"`
	UserAuthVersion int64  `json:"user_auth_version"`
	Used            bool   `json:"used"`
	ExpiresAt       int64  `json:"expires_at"`
}

func DesktopConnectCodeAvailable() bool {
	return DesktopDeviceAuthorizationAvailable()
}

func IssueDesktopConnectCode(userID int, userAuthVersion int64, declaredOrigin string, requestOrigin string, requestHost string) (*DesktopConnectCodeIssueView, error) {
	if !DesktopConnectCodeAvailable() {
		return nil, desktopConnectCodeError("temporarily_unavailable", nil)
	}
	if userID <= 0 || userAuthVersion <= 0 {
		return nil, desktopConnectCodeError("session_required", nil)
	}
	origin, err := resolveDesktopConnectIssueOrigin(declaredOrigin, requestOrigin, requestHost)
	if err != nil {
		return nil, err
	}

	const createScript = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1
`
	now := time.Now().Unix()
	expiresAt := now + DesktopConnectCodeTTLSeconds
	record := desktopConnectCodeRecord{
		Origin:          origin,
		UserID:          userID,
		UserAuthVersion: userAuthVersion,
		ExpiresAt:       expiresAt,
	}
	for range 8 {
		code, genErr := common.GenerateRandomCharsKey(48)
		if genErr != nil {
			return nil, desktopConnectCodeError("server_error", genErr)
		}
		if len(code) < 32 {
			continue
		}
		payload, marshalErr := common.Marshal(record)
		if marshalErr != nil {
			return nil, desktopConnectCodeError("server_error", marshalErr)
		}
		key := desktopConnectCodeKey(desktopAuthorizationDigest(code))
		created, evalErr := common.RDB.Eval(
			context.Background(),
			createScript,
			[]string{key},
			string(payload),
			DesktopConnectCodeTTLSeconds,
		).Int()
		if evalErr != nil {
			return nil, desktopConnectCodeError("temporarily_unavailable", evalErr)
		}
		if created != 1 {
			continue
		}
		return &DesktopConnectCodeIssueView{
			Code:       code,
			Origin:     origin,
			ExpiresAt:  expiresAt,
			TTLSeconds: DesktopConnectCodeTTLSeconds,
		}, nil
	}
	return nil, desktopConnectCodeError("server_error", errors.New("could not allocate a unique connect code"))
}

func ExchangeDesktopConnectCode(code string, requestHost string, ip string, userAgent string) (*AuthBundle, error) {
	if !DesktopConnectCodeAvailable() {
		return nil, desktopConnectCodeError("temporarily_unavailable", nil)
	}
	code = strings.TrimSpace(code)
	if len(code) < 32 || len(code) > 512 {
		return nil, desktopConnectCodeError("connect_code_expired", nil)
	}
	requestOrigin, err := desktopConnectOriginFromRequestHost(requestHost)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	key := desktopConnectCodeKey(desktopAuthorizationDigest(code))
	var claimed desktopConnectCodeRecord
	err = watchDesktopAuthorization(ctx, []string{key}, func(tx *redis.Tx) error {
		claimed = desktopConnectCodeRecord{}
		raw, getErr := tx.Get(ctx, key).Result()
		if errors.Is(getErr, redis.Nil) {
			return desktopConnectCodeError("connect_code_expired", nil)
		}
		if getErr != nil {
			return getErr
		}
		var record desktopConnectCodeRecord
		if unmarshalErr := common.UnmarshalJsonStr(raw, &record); unmarshalErr != nil {
			return unmarshalErr
		}
		now := time.Now().Unix()
		if record.ExpiresAt <= now {
			return desktopConnectCodeError("connect_code_expired", nil)
		}
		if record.Used {
			return desktopConnectCodeError("connect_code_already_used", nil)
		}
		if record.Origin != requestOrigin {
			return desktopConnectCodeError("connect_origin_mismatch", nil)
		}
		record.Used = true
		claimed = record
		payload, marshalErr := common.Marshal(record)
		if marshalErr != nil {
			return marshalErr
		}
		_, updateErr := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, key, string(payload), redis.KeepTTL)
			return nil
		})
		return updateErr
	})
	if err != nil {
		var flowErr *DesktopConnectCodeError
		if errors.As(err, &flowErr) {
			return nil, flowErr
		}
		var authFlowErr *DesktopDeviceAuthorizationError
		if errors.As(err, &authFlowErr) {
			return nil, err
		}
		return nil, desktopConnectCodeError("temporarily_unavailable", err)
	}
	if claimed.UserID <= 0 || claimed.UserAuthVersion <= 0 {
		return nil, desktopConnectCodeError("connect_code_expired", nil)
	}
	bundle, sessionErr := CreateLoginSessionAtAuthVersion(claimed.UserID, claimed.UserAuthVersion, DesktopLoginMethod, ip, userAgent)
	if sessionErr != nil {
		rollbackDesktopConnectCodeClaim(key)
		return nil, desktopConnectCodeError("server_error", sessionErr)
	}
	return bundle, nil
}

func resolveDesktopConnectIssueOrigin(declaredOrigin string, requestOrigin string, requestHost string) (string, error) {
	declaredOrigin = strings.TrimSpace(declaredOrigin)
	if declaredOrigin != "" {
		origin, ok := canonicalDesktopConnectHTTPSOrigin(declaredOrigin)
		if !ok {
			return "", desktopConnectCodeError("connect_origin_invalid", nil)
		}
		return origin, nil
	}
	requestOrigin = strings.TrimSpace(requestOrigin)
	if requestOrigin != "" {
		origin, ok := canonicalDesktopConnectHTTPSOrigin(requestOrigin)
		if !ok {
			return "", desktopConnectCodeError("connect_origin_invalid", nil)
		}
		return origin, nil
	}
	origin, err := desktopConnectOriginFromRequestHost(requestHost)
	if err != nil {
		return "", err
	}
	return origin, nil
}

func desktopConnectOriginFromRequestHost(requestHost string) (string, error) {
	host := strings.TrimSpace(requestHost)
	if host == "" {
		return "", desktopConnectCodeError("connect_origin_required", nil)
	}
	host = strings.Split(host, ":")[0]
	if host == "" || desktopConnectHostIsLiteralIP(host) {
		return "", desktopConnectCodeError("connect_origin_invalid", nil)
	}
	return "https://" + strings.ToLower(host), nil
}

func canonicalDesktopConnectHTTPSOrigin(raw string) (string, bool) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Port() != "" {
		return "", false
	}
	if parsed.User != nil {
		return "", false
	}
	path := parsed.EscapedPath()
	if path != "" && path != "/" {
		return "", false
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", false
	}
	host := parsed.Hostname()
	if host == "" || desktopConnectHostIsLiteralIP(host) {
		return "", false
	}
	canonical := "https://" + strings.ToLower(host)
	if raw != canonical && raw != canonical+"/" {
		return "", false
	}
	return canonical, true
}

func desktopConnectHostIsLiteralIP(host string) bool {
	bare := strings.TrimSuffix(strings.TrimPrefix(host, "["), "]")
	return net.ParseIP(bare) != nil
}

func desktopConnectCodeKey(digest string) string {
	return "desktop:v2:connect:" + digest
}

func desktopConnectCodeError(code string, cause error) error {
	return &DesktopConnectCodeError{Code: code, Cause: cause}
}

func rollbackDesktopConnectCodeClaim(key string) {
	ctx := context.Background()
	_ = watchDesktopAuthorization(ctx, []string{key}, func(tx *redis.Tx) error {
		raw, err := tx.Get(ctx, key).Result()
		if err != nil {
			return err
		}
		var record desktopConnectCodeRecord
		if err := common.UnmarshalJsonStr(raw, &record); err != nil {
			return err
		}
		if !record.Used {
			return nil
		}
		record.Used = false
		payload, err := common.Marshal(record)
		if err != nil {
			return err
		}
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, key, string(payload), redis.KeepTTL)
			return nil
		})
		return err
	})
}

func DesktopConnectCodeHTTPStatus(code string) int {
	switch code {
	case "session_required":
		return http.StatusUnauthorized
	case "connect_origin_mismatch":
		return http.StatusForbidden
	case "connect_code_already_used":
		return http.StatusConflict
	case "temporarily_unavailable", "server_error":
		return http.StatusServiceUnavailable
	default:
		return http.StatusBadRequest
	}
}
