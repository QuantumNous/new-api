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

const subscriptionPurchaseQuoteTokenVersion = 2

var (
	ErrSubscriptionPurchaseQuoteInvalid = errors.New("subscription purchase quote is invalid")
	ErrSubscriptionPurchaseQuoteExpired = errors.New("subscription purchase quote has expired")
)

type SubscriptionPurchaseQuoteTokenClaims struct {
	Version                       int    `json:"v"`
	UserID                        int    `json:"uid"`
	PlanID                        int    `json:"pid"`
	PaymentChoice                 string `json:"payment_choice"`
	PaymentMethod                 string `json:"payment_method,omitempty"`
	Months                        int    `json:"months"`
	RequestID                     string `json:"request_id"`
	Currency                      string `json:"currency"`
	UnitAmountMinor               int64  `json:"unit_amount_minor"`
	TotalAmountMinor              int64  `json:"total_amount_minor"`
	DiscountKind                  string `json:"discount_kind,omitempty"`
	DiscountAmountMinor           int64  `json:"discount_amount_minor,omitempty"`
	InvitationAvailableUSDMinor   int64  `json:"invitation_available_usd_minor,omitempty"`
	InvitationDiscountUSDMinor    int64  `json:"invitation_discount_usd_minor,omitempty"`
	InvitationDiscountAmountMinor int64  `json:"invitation_discount_amount_minor,omitempty"`
	InvitationRemainingUSDMinor   int64  `json:"invitation_remaining_usd_minor,omitempty"`
	OtherDiscountKind             string `json:"other_discount_kind,omitempty"`
	OtherDiscountAmountMinor      int64  `json:"other_discount_amount_minor,omitempty"`
	RecallCampaignID              int64  `json:"recall_campaign_id,omitempty"`
	RecallRecipientID             int64  `json:"recall_recipient_id,omitempty"`
	RecallPromotionCodeID         string `json:"recall_promotion_code_id,omitempty"`
	PlanRevision                  int64  `json:"plan_revision"`
	ExpiresAt                     int64  `json:"expires_at"`
}

func SignSubscriptionPurchaseQuoteToken(claims SubscriptionPurchaseQuoteTokenClaims) (string, error) {
	normalized, err := normalizeSubscriptionPurchaseQuoteTokenClaims(claims)
	if err != nil {
		return "", err
	}
	payload, err := common.Marshal(normalized)
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
	claims, err = normalizeSubscriptionPurchaseQuoteTokenClaims(claims)
	if err != nil {
		return SubscriptionPurchaseQuoteTokenClaims{}, err
	}
	if now.Unix() >= claims.ExpiresAt {
		return SubscriptionPurchaseQuoteTokenClaims{}, ErrSubscriptionPurchaseQuoteExpired
	}
	return claims, nil
}

func validateSubscriptionPurchaseQuoteTokenClaims(claims SubscriptionPurchaseQuoteTokenClaims) error {
	_, err := normalizeSubscriptionPurchaseQuoteTokenClaims(claims)
	return err
}

func normalizeSubscriptionPurchaseQuoteTokenClaims(claims SubscriptionPurchaseQuoteTokenClaims) (SubscriptionPurchaseQuoteTokenClaims, error) {
	if claims.Version != subscriptionPurchaseQuoteTokenVersion && claims.Version != 1 {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: unsupported version", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.UserID <= 0 || claims.PlanID <= 0 || claims.PlanRevision <= 0 {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: missing identity or revision", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.Months < 1 || claims.Months > 12 {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: months must be between 1 and 12", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if strings.TrimSpace(claims.RequestID) == "" || claims.RequestID != strings.TrimSpace(claims.RequestID) {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: request id is required", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.Currency != strings.ToUpper(strings.TrimSpace(claims.Currency)) || len(claims.Currency) != 3 {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: currency must be canonical", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.UnitAmountMinor < 0 || claims.TotalAmountMinor < 0 || claims.DiscountAmountMinor < 0 ||
		claims.InvitationAvailableUSDMinor < 0 || claims.InvitationDiscountUSDMinor < 0 ||
		claims.InvitationDiscountAmountMinor < 0 || claims.InvitationRemainingUSDMinor < 0 ||
		claims.OtherDiscountAmountMinor < 0 {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: amount cannot be negative", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.UnitAmountMinor > math.MaxInt64/int64(claims.Months) ||
		claims.TotalAmountMinor != claims.UnitAmountMinor*int64(claims.Months)-claims.DiscountAmountMinor {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: total does not match unit amount and months", ErrSubscriptionPurchaseQuoteInvalid)
	}
	claims.DiscountKind = strings.TrimSpace(claims.DiscountKind)
	claims.RecallPromotionCodeID = strings.TrimSpace(claims.RecallPromotionCodeID)
	if claims.DiscountKind == "" {
		if claims.DiscountAmountMinor > 0 {
			claims.DiscountKind = SubscriptionDiscountKindRecall
		} else {
			claims.DiscountKind = SubscriptionDiscountKindNone
		}
	}
	claims.OtherDiscountKind = strings.TrimSpace(claims.OtherDiscountKind)
	switch claims.DiscountKind {
	case SubscriptionDiscountKindNone:
		if claims.DiscountAmountMinor != 0 {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: discount kind does not match amount", ErrSubscriptionPurchaseQuoteInvalid)
		}
		if claims.InvitationDiscountUSDMinor != 0 || claims.InvitationDiscountAmountMinor != 0 ||
			claims.OtherDiscountKind != "" || claims.OtherDiscountAmountMinor != 0 {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: discount facts conflict with none discount", ErrSubscriptionPurchaseQuoteInvalid)
		}
	case SubscriptionDiscountKindInvitation:
		if claims.DiscountAmountMinor <= 0 {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: invitation discount requires amount", ErrSubscriptionPurchaseQuoteInvalid)
		}
		if claims.DiscountAmountMinor != claims.InvitationDiscountAmountMinor {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: invitation discount amount mismatch", ErrSubscriptionPurchaseQuoteInvalid)
		}
		if claims.InvitationDiscountUSDMinor <= 0 || claims.InvitationAvailableUSDMinor <= 0 ||
			claims.InvitationAvailableUSDMinor != claims.InvitationDiscountUSDMinor+claims.InvitationRemainingUSDMinor {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: invitation USD facts are inconsistent", ErrSubscriptionPurchaseQuoteInvalid)
		}
		if claims.RecallCampaignID != 0 || claims.RecallRecipientID != 0 || claims.RecallPromotionCodeID != "" {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: invitation quote cannot include recall identity", ErrSubscriptionPurchaseQuoteInvalid)
		}
	case SubscriptionDiscountKindRecall:
		if claims.DiscountAmountMinor <= 0 {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: recall discount requires amount", ErrSubscriptionPurchaseQuoteInvalid)
		}
		if claims.DiscountAmountMinor > claims.UnitAmountMinor {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: recall discount exceeds monthly unit amount", ErrSubscriptionPurchaseQuoteInvalid)
		}
		if claims.RecallCampaignID <= 0 || claims.RecallRecipientID <= 0 {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: discounted quote requires recall identity", ErrSubscriptionPurchaseQuoteInvalid)
		}
		if claims.OtherDiscountKind == "" {
			claims.OtherDiscountKind = SubscriptionDiscountKindRecall
		}
		if claims.OtherDiscountAmountMinor == 0 {
			claims.OtherDiscountAmountMinor = claims.DiscountAmountMinor
		}
	default:
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: unsupported discount kind", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.OtherDiscountKind == "" && claims.OtherDiscountAmountMinor != 0 {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: other discount amount requires kind", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.OtherDiscountKind != "" && claims.OtherDiscountAmountMinor <= 0 {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: other discount kind requires amount", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.OtherDiscountKind != "" && claims.OtherDiscountKind != SubscriptionDiscountKindRecall {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: unsupported other discount kind", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.DiscountKind != SubscriptionDiscountKindRecall &&
		(claims.RecallCampaignID != 0 || claims.RecallRecipientID != 0 || claims.RecallPromotionCodeID != "") {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: recall identity requires recall discount", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if claims.ExpiresAt <= 0 {
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: expiry is required", ErrSubscriptionPurchaseQuoteInvalid)
	}
	claims.PaymentChoice = strings.ToLower(strings.TrimSpace(claims.PaymentChoice))
	claims.PaymentMethod = strings.ToLower(strings.TrimSpace(claims.PaymentMethod))
	switch claims.PaymentChoice {
	case SubscriptionPaymentChoicePix:
		if claims.Currency != "BRL" {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: Pix quote must use BRL", ErrSubscriptionPurchaseQuoteInvalid)
		}
	case SubscriptionPaymentChoiceUPI:
		if claims.Currency != "INR" {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: UPI quote must use INR", ErrSubscriptionPurchaseQuoteInvalid)
		}
	case SubscriptionPaymentChoiceEpay:
		if claims.PaymentMethod == "" {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: ePay quote requires payment method", ErrSubscriptionPurchaseQuoteInvalid)
		}
	case SubscriptionPaymentChoiceAlipay, SubscriptionPaymentChoiceBalance, SubscriptionPaymentChoiceStripeRecurring:
		if claims.PaymentMethod != "" {
			return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: payment method requires ePay choice", ErrSubscriptionPurchaseQuoteInvalid)
		}
	default:
		return SubscriptionPurchaseQuoteTokenClaims{}, fmt.Errorf("%w: unsupported payment choice", ErrSubscriptionPurchaseQuoteInvalid)
	}
	return claims, nil
}
