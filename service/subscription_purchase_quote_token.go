package service

import (
	"crypto/hmac"
	"encoding/base64"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const subscriptionPurchaseQuoteTokenVersion = 1

var (
	ErrSubscriptionPurchaseQuoteInvalid = errors.New("subscription purchase quote is invalid")
	ErrSubscriptionPurchaseQuoteExpired = errors.New("subscription purchase quote has expired")
)

type SubscriptionPurchaseQuoteTokenClaims struct {
	Version          int    `json:"v"`
	UserID           int    `json:"uid"`
	PlanID           int    `json:"pid"`
	PaymentChoice    string `json:"payment_choice"`
	Months           int    `json:"months"`
	RequestID        string `json:"request_id"`
	Currency         string `json:"currency"`
	UnitAmountMinor  int64  `json:"unit_amount_minor"`
	TotalAmountMinor int64  `json:"total_amount_minor"`
	PlanRevision     int64  `json:"plan_revision"`
	ExpiresAt        int64  `json:"expires_at"`
}

func SignSubscriptionPurchaseQuoteToken(claims SubscriptionPurchaseQuoteTokenClaims) (string, error) {
	if err := validateSubscriptionPurchaseQuoteTokenClaims(claims); err != nil {
		return "", err
	}
	payload, err := common.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("%w: encode claims: %v", ErrSubscriptionPurchaseQuoteInvalid, err)
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	signature := common.GenerateHMAC(encodedPayload)
	return encodedPayload + "." + signature, nil
}

func VerifySubscriptionPurchaseQuoteToken(token string, now time.Time) (SubscriptionPurchaseQuoteTokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return SubscriptionPurchaseQuoteTokenClaims{}, ErrSubscriptionPurchaseQuoteInvalid
	}
	expectedSignature := common.GenerateHMAC(parts[0])
	if !hmac.Equal([]byte(expectedSignature), []byte(parts[1])) {
		return SubscriptionPurchaseQuoteTokenClaims{}, ErrSubscriptionPurchaseQuoteInvalid
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: decode payload", ErrSubscriptionPurchaseQuoteInvalid)
	}
	var claims SubscriptionPurchaseQuoteTokenClaims
	if err := common.Unmarshal(payload, &claims); err != nil {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: decode claims", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if err := validateSubscriptionPurchaseQuoteTokenClaims(claims); err != nil {
		return SubscriptionPurchaseQuoteTokenClaims{}, err
	}
	if now.Unix() >= claims.ExpiresAt {
		return SubscriptionPurchaseQuoteTokenClaims{}, ErrSubscriptionPurchaseQuoteExpired
	}
	return claims, nil
}

func validateSubscriptionPurchaseQuoteTokenClaims(claims SubscriptionPurchaseQuoteTokenClaims) error {
	if claims.Version != subscriptionPurchaseQuoteTokenVersion {
		return fmt.Errorf("%w: unsupported version", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.UserID <= 0 || claims.PlanID <= 0 || claims.PlanRevision <= 0 {
		return fmt.Errorf("%w: missing identity or revision", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.Months < 1 || claims.Months > 12 {
		return fmt.Errorf("%w: months must be between 1 and 12", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if strings.TrimSpace(claims.RequestID) == "" || claims.RequestID != strings.TrimSpace(claims.RequestID) {
		return fmt.Errorf("%w: request id is required", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.Currency != strings.ToUpper(strings.TrimSpace(claims.Currency)) || len(claims.Currency) != 3 {
		return fmt.Errorf("%w: currency must be canonical", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.UnitAmountMinor < 0 || claims.TotalAmountMinor < 0 {
		return fmt.Errorf("%w: amount cannot be negative", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.UnitAmountMinor > math.MaxInt64/int64(claims.Months) ||
		claims.TotalAmountMinor != claims.UnitAmountMinor*int64(claims.Months) {
		return fmt.Errorf("%w: total does not match unit amount and months", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.ExpiresAt <= 0 {
		return fmt.Errorf("%w: expiry is required", ErrSubscriptionPurchaseQuoteInvalid)
	}
	switch claims.PaymentChoice {
	case SubscriptionPaymentChoicePix:
		if claims.Currency != "BRL" {
			return fmt.Errorf("%w: Pix quote must use BRL", ErrSubscriptionPurchaseQuoteInvalid)
		}
	case SubscriptionPaymentChoiceUPI:
		if claims.Currency != "INR" {
			return fmt.Errorf("%w: UPI quote must use INR", ErrSubscriptionPurchaseQuoteInvalid)
		}
	case SubscriptionPaymentChoiceAlipay, SubscriptionPaymentChoiceBalance:
	default:
		return fmt.Errorf("%w: unsupported payment choice", ErrSubscriptionPurchaseQuoteInvalid)
	}
	return nil
}
