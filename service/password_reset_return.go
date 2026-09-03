package service

import (
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const passwordResetReturnPurpose = "custom-domain-password-reset-return-v1"

var (
	ErrPasswordResetReturnInvalid = errors.New("password reset return context is invalid")
	ErrPasswordResetReturnExpired = errors.New("password reset return context has expired")
)

type passwordResetReturnPayload struct {
	DomainID  int64  `json:"domain_id"`
	Host      string `json:"host"`
	ExpiresAt int64  `json:"expires_at"`
}

// CreatePasswordResetReturnContext signs a verified peer-main or promotion
// source. The email and token remain outside the payload but are bound through
// a purpose-separated HMAC, preventing copied contexts from being attached to
// another reset request.
func CreatePasswordResetReturnContext(domainID int64, host, email, token string, expiresAt time.Time) (string, error) {
	if domainID < 0 || token == "" || expiresAt.IsZero() || !expiresAt.After(time.Now()) {
		return "", ErrPasswordResetReturnInvalid
	}
	resolver, err := NewRuntimeCustomDomainResolver()
	if err != nil {
		return "", ErrPasswordResetReturnInvalid
	}
	context, err := resolver.ResolveStoredOrigin(domainID, host)
	if err != nil || (context.Kind != CustomDomainKindMain && context.Kind != CustomDomainKindCustom) {
		return "", ErrPasswordResetReturnInvalid
	}

	payloadBytes, err := common.Marshal(passwordResetReturnPayload{
		DomainID:  domainID,
		Host:      context.Host,
		ExpiresAt: expiresAt.Unix(),
	})
	if err != nil {
		return "", fmt.Errorf("marshal password reset return context: %w", err)
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	binding := passwordResetReturnBinding(email, token)
	signature := common.GenerateHMACWithKey(
		[]byte(passwordResetReturnPurpose+":signature:"+common.SessionSecret),
		encodedPayload+"."+binding,
	)
	return encodedPayload + "." + signature, nil
}

// ResolvePasswordResetReturnContext returns an active destination Host. A
// valid context for an origin that is no longer allowed is intentionally not
// an error: callers must fall back to the fixed callback site.
func ResolvePasswordResetReturnContext(raw, email, token string, now time.Time) (string, bool, error) {
	parts := strings.Split(raw, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" || token == "" {
		return "", false, ErrPasswordResetReturnInvalid
	}
	binding := passwordResetReturnBinding(email, token)
	expectedSignature := common.GenerateHMACWithKey(
		[]byte(passwordResetReturnPurpose+":signature:"+common.SessionSecret),
		parts[0]+"."+binding,
	)
	if !constantTimeEqual(parts[1], expectedSignature) {
		return "", false, ErrPasswordResetReturnInvalid
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", false, ErrPasswordResetReturnInvalid
	}
	var payload passwordResetReturnPayload
	if err := common.Unmarshal(payloadBytes, &payload); err != nil || payload.DomainID < 0 || payload.Host == "" || payload.ExpiresAt <= 0 {
		return "", false, ErrPasswordResetReturnInvalid
	}
	if !time.Unix(payload.ExpiresAt, 0).After(now) {
		return "", false, ErrPasswordResetReturnExpired
	}
	resolver, err := NewRuntimeCustomDomainResolver()
	if err != nil {
		return "", false, err
	}
	context, err := resolver.ResolveStoredOrigin(payload.DomainID, payload.Host)
	if err == ErrCustomDomainOriginInvalid || context.Kind == CustomDomainKindDisabled {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if context.Kind != CustomDomainKindMain && context.Kind != CustomDomainKindCustom {
		return "", false, nil
	}
	return context.Host, true, nil
}

func passwordResetReturnBinding(email, token string) string {
	return common.GenerateHMACWithKey(
		[]byte(passwordResetReturnPurpose+":binding:"+common.SessionSecret),
		model.NormalizeEmail(email)+"\x00"+token,
	)
}

func constantTimeEqual(left, right string) bool {
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
}
