package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/mail"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

var (
	ErrRecallClaimLeaseLost        = errors.New("recall claim message lease was lost")
	ErrRecallClaimUnknown          = errors.New("recall claim is unknown")
	ErrRecallClaimWrongUser        = errors.New("recall claim belongs to another user")
	ErrRecallClaimExpired          = errors.New("recall claim has expired")
	ErrRecallClaimConverted        = errors.New("recall claim has already converted")
	ErrRecallClaimSuppressed       = errors.New("recall claim is suppressed")
	ErrRecallClaimInactive         = errors.New("recall claim is inactive")
	ErrRecallClaimPromotionInvalid = errors.New("recall claim promotion is invalid")
	ErrRecallClaimWrongPrice       = errors.New("recall claim does not apply to this price")
	ErrRecallClaimPurchaseKind     = errors.New("recall claim purchase kind is invalid")
	ErrRecallClaimInvalidConfig    = errors.New("recall claim campaign configuration is invalid")
	ErrRecallUnsubscribeInvalid    = errors.New("recall unsubscribe token is invalid")
	ErrRecallUnsubscribeExpired    = errors.New("recall unsubscribe token has expired")
)

type RecallClaimService struct {
	now    func() time.Time
	random io.Reader
}

func NewRecallClaimService() *RecallClaimService {
	return &RecallClaimService{
		now:    time.Now,
		random: rand.Reader,
	}
}

func (s *RecallClaimService) IssueClaim(ctx context.Context, messageID int64, leaseOwner string, expectedLeaseUntil int64) (string, error) {
	randomBytes := make([]byte, 36)
	if _, err := io.ReadFull(s.random, randomBytes); err != nil {
		return "", err
	}
	claim := base64.RawURLEncoding.EncodeToString(randomBytes)
	digest := sha256.Sum256([]byte(claim))
	claimHash := hex.EncodeToString(digest[:])
	updated, err := model.SetRecallMessageClaimHash(ctx, messageID, leaseOwner, expectedLeaseUntil, claimHash)
	if err != nil {
		return "", err
	}
	if !updated {
		return "", ErrRecallClaimLeaseLost
	}
	return claim, nil
}

func (s *RecallClaimService) ValidateClaim(ctx context.Context, userID int, claim string) (*RecallClaimView, error) {
	_, view, err := s.validateClaim(ctx, userID, claim)
	return view, err
}

func (s *RecallClaimService) ValidateClaimForPurchase(ctx context.Context, userID int, claim string, purchaseKind string, priceID string) (*RecallClaimView, error) {
	_, view, err := s.validateClaim(ctx, userID, claim)
	if err != nil {
		return nil, err
	}
	purchaseKind = strings.TrimSpace(purchaseKind)
	priceID = strings.TrimSpace(priceID)
	if purchaseKind == "" && priceID == "" {
		return view, nil
	}
	var allowedPrices []string
	switch purchaseKind {
	case RecallPurchaseKindTopUp:
		allowedPrices = view.Products.TopUpPriceIDs
	case RecallPurchaseKindSubscription:
		allowedPrices = view.Products.SubscriptionPriceIDs
	default:
		return nil, ErrRecallClaimPurchaseKind
	}
	if !containsRecallPriceID(allowedPrices, priceID) {
		return nil, ErrRecallClaimWrongPrice
	}
	return view, nil
}

func (s *RecallClaimService) validateClaim(ctx context.Context, userID int, claim string) (*model.RecallClaimRecord, *RecallClaimView, error) {
	if !operation_setting.IsRecallCampaignEnabled() {
		return nil, nil, ErrRecallDisabled
	}
	claim = strings.TrimSpace(claim)
	if claim == "" {
		return nil, nil, ErrRecallClaimUnknown
	}
	claimHash := recallClaimTokenHash(claim)
	record, found, err := model.FindRecallClaimByHashWithContext(ctx, claimHash)
	if err != nil {
		return nil, nil, err
	}
	if !found || subtle.ConstantTimeCompare([]byte(record.ClaimTokenHash), []byte(claimHash)) != 1 {
		return nil, nil, ErrRecallClaimUnknown
	}
	bindNeeded := false
	bindRecipientEmail := ""
	if record.Recipient.UserId > 0 {
		if record.Recipient.UserId != userID {
			return nil, nil, ErrRecallClaimWrongUser
		}
	} else {
		user, found, err := model.GetRecallClaimUserWithContext(ctx, userID)
		if err != nil {
			return nil, nil, err
		}
		if !found {
			return nil, nil, ErrRecallClaimWrongUser
		}
		recipientEmail, ok := normalizeRecallClaimEmail(record.Recipient.EmailSnapshot)
		if !ok || user.Status != common.UserStatusEnabled {
			return nil, nil, ErrRecallClaimWrongUser
		}
		userEmail, ok := normalizeRecallClaimEmail(user.Email)
		if !ok || userEmail != recipientEmail {
			return nil, nil, ErrRecallClaimWrongUser
		}
		bindNeeded = true
		bindRecipientEmail = recipientEmail
	}
	if record.Campaign.Id != record.Recipient.CampaignId || !activeRecallCampaignStatus(record.Campaign.Status) {
		return nil, nil, ErrRecallClaimInactive
	}
	if record.Recipient.ConvertedAt != 0 || record.Recipient.State == model.RecallRecipientConverted {
		return nil, nil, ErrRecallClaimConverted
	}
	if record.Recipient.State == model.RecallRecipientSuppressed {
		return nil, nil, ErrRecallClaimSuppressed
	}
	if !activeRecallRecipientState(record.Recipient.State) {
		return nil, nil, ErrRecallClaimInactive
	}
	if record.Recipient.StripePromotionCodeId == nil || strings.TrimSpace(*record.Recipient.StripePromotionCodeId) == "" || strings.TrimSpace(record.Recipient.PromotionCode) == "" {
		return nil, nil, ErrRecallClaimPromotionInvalid
	}
	if record.Recipient.PromotionExpiresAt <= s.now().Unix() {
		return nil, nil, ErrRecallClaimExpired
	}

	discount := RecallDiscountConfig{}
	if err := common.Unmarshal([]byte(record.Campaign.DiscountConfig), &discount); err != nil {
		return nil, nil, fmt.Errorf("%w: discount", ErrRecallClaimInvalidConfig)
	}
	products := RecallProductScope{}
	if err := common.Unmarshal([]byte(record.Campaign.ProductScope), &products); err != nil {
		return nil, nil, fmt.Errorf("%w: products", ErrRecallClaimInvalidConfig)
	}
	if bindNeeded {
		bound, _, err := model.BindRecallRecipientUserWithContext(ctx, record.Recipient.Id, userID, bindRecipientEmail)
		if err != nil {
			if errors.Is(err, model.ErrRecallRecipientBindingConflict) {
				return nil, nil, ErrRecallClaimWrongUser
			}
			return nil, nil, err
		}
		record.Recipient = *bound
	}
	clickOutcome, err := model.RecordRecallClaimClickWithContext(ctx, record.Recipient.Id, record.Campaign.Id, s.now().Unix())
	if err != nil {
		return nil, nil, err
	}
	switch clickOutcome {
	case model.RecallClaimClickConverted:
		return nil, nil, ErrRecallClaimConverted
	case model.RecallClaimClickSuppressed:
		return nil, nil, ErrRecallClaimSuppressed
	case model.RecallClaimClickInactive:
		return nil, nil, ErrRecallClaimInactive
	}
	view := &RecallClaimView{
		CampaignID:          record.Campaign.Id,
		RecipientID:         record.Recipient.Id,
		CampaignName:        record.Campaign.Name,
		PromotionCodeMasked: model.MaskPromotionCode(record.Recipient.PromotionCode),
		ExpiresAt:           record.Recipient.PromotionExpiresAt,
		Discount:            discount,
		Products:            products,
		Redeemed:            false,
	}
	return record, view, nil
}

func (s *RecallClaimService) BuildCheckoutDiscount(ctx context.Context, userID int, claim string, purchaseKind string, priceID string) (*RecallCheckoutDiscount, error) {
	if strings.TrimSpace(claim) == "" {
		return nil, nil
	}
	record, view, err := s.validateClaim(ctx, userID, claim)
	if err != nil {
		return nil, err
	}
	var allowedPrices []string
	switch purchaseKind {
	case RecallPurchaseKindTopUp:
		allowedPrices = view.Products.TopUpPriceIDs
	case RecallPurchaseKindSubscription:
		allowedPrices = view.Products.SubscriptionPriceIDs
	default:
		return nil, ErrRecallClaimPurchaseKind
	}
	if !containsRecallPriceID(allowedPrices, priceID) {
		return nil, ErrRecallClaimWrongPrice
	}
	return &RecallCheckoutDiscount{
		PromotionCodeID: strings.TrimSpace(*record.Recipient.StripePromotionCodeId),
		CampaignID:      view.CampaignID,
		RecipientID:     view.RecipientID,
	}, nil
}

type recallUnsubscribePayload struct {
	Version     int   `json:"v"`
	UserID      int   `json:"u"`
	RecipientID int64 `json:"r"`
	ExpiresAt   int64 `json:"e"`
}

func (s *RecallClaimService) CreateUnsubscribeToken(userID int, expiresAt time.Time) (string, error) {
	if userID <= 0 {
		return "", ErrRecallUnsubscribeInvalid
	}
	payload, err := common.Marshal(recallUnsubscribePayload{Version: 1, UserID: userID, ExpiresAt: expiresAt.Unix()})
	if err != nil {
		return "", err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	signature := common.GenerateHMACWithKey([]byte(common.CryptoSecret), encodedPayload)
	return encodedPayload + "." + signature, nil
}

func (s *RecallClaimService) CreateRecipientUnsubscribeToken(recipientID int64, expiresAt time.Time) (string, error) {
	if recipientID <= 0 {
		return "", ErrRecallUnsubscribeInvalid
	}
	payload, err := common.Marshal(recallUnsubscribePayload{Version: 2, RecipientID: recipientID, ExpiresAt: expiresAt.Unix()})
	if err != nil {
		return "", err
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(payload)
	signature := common.GenerateHMACWithKey([]byte(common.CryptoSecret), encodedPayload)
	return encodedPayload + "." + signature, nil
}

func (s *RecallClaimService) Unsubscribe(ctx context.Context, token string) error {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return ErrRecallUnsubscribeInvalid
	}
	wantSignature, err := hex.DecodeString(common.GenerateHMACWithKey([]byte(common.CryptoSecret), parts[0]))
	if err != nil {
		return ErrRecallUnsubscribeInvalid
	}
	gotSignature, err := hex.DecodeString(parts[1])
	if err != nil || !hmac.Equal(gotSignature, wantSignature) {
		return ErrRecallUnsubscribeInvalid
	}
	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return ErrRecallUnsubscribeInvalid
	}
	payload := recallUnsubscribePayload{}
	if err := common.Unmarshal(payloadJSON, &payload); err != nil {
		return ErrRecallUnsubscribeInvalid
	}
	if payload.ExpiresAt <= s.now().Unix() {
		return ErrRecallUnsubscribeExpired
	}
	switch payload.Version {
	case 1:
		if payload.UserID <= 0 || payload.RecipientID != 0 {
			return ErrRecallUnsubscribeInvalid
		}
		return s.unsubscribeUser(ctx, payload.UserID)
	case 2:
		if payload.RecipientID <= 0 || payload.UserID != 0 {
			return ErrRecallUnsubscribeInvalid
		}
		return s.unsubscribeRecipient(ctx, payload.RecipientID)
	default:
		return ErrRecallUnsubscribeInvalid
	}
}

func (s *RecallClaimService) unsubscribeUser(ctx context.Context, userID int) error {
	found, err := model.SetRecallMarketingOptOutWithContext(ctx, userID, s.now().Unix())
	if err != nil {
		return err
	}
	if !found {
		return ErrRecallUnsubscribeInvalid
	}
	return nil
}

func (s *RecallClaimService) unsubscribeRecipient(ctx context.Context, recipientID int64) error {
	recipient, err := loadRecallUnsubscribeRecipient(ctx, recipientID)
	if err != nil {
		return err
	}
	if recipient.UserId > 0 {
		return s.unsubscribeUser(ctx, recipient.UserId)
	}
	suppressed, err := model.SuppressRecallRecipientWithContext(ctx, recipientID, s.now().Unix())
	if err != nil && !errors.Is(err, model.ErrRecallRecipientBindingConflict) {
		return err
	}
	if suppressed {
		return nil
	}
	recipient, err = loadRecallUnsubscribeRecipient(ctx, recipientID)
	if err != nil {
		return err
	}
	if recipient.UserId > 0 {
		return s.unsubscribeUser(ctx, recipient.UserId)
	}
	if recipient.State == model.RecallRecipientSuppressed {
		return nil
	}
	return ErrRecallUnsubscribeInvalid
}

func loadRecallUnsubscribeRecipient(ctx context.Context, recipientID int64) (*model.RecallRecipient, error) {
	recipient, found, err := model.GetRecallRecipientByIDWithContext(ctx, recipientID)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ErrRecallUnsubscribeInvalid
	}
	return recipient, nil
}

func normalizeRecallClaimEmail(email string) (string, bool) {
	trimmed := strings.TrimSpace(email)
	if trimmed == "" {
		return "", false
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil || parsed.Address != trimmed {
		return "", false
	}
	return strings.ToLower(trimmed), true
}

func recallClaimTokenHash(claim string) string {
	digest := sha256.Sum256([]byte(claim))
	return hex.EncodeToString(digest[:])
}

func activeRecallCampaignStatus(status string) bool {
	switch status {
	case model.RecallCampaignScheduled,
		model.RecallCampaignRunning,
		model.RecallCampaignPaused,
		model.RecallCampaignCancelled,
		model.RecallCampaignCompleted:
		return true
	default:
		return false
	}
}

func activeRecallRecipientState(state string) bool {
	switch state {
	case model.RecallRecipientQueued, model.RecallRecipientCustomerReady, model.RecallRecipientCodeReady, model.RecallRecipientContacting:
		return true
	default:
		return false
	}
}

func containsRecallPriceID(priceIDs []string, selected string) bool {
	selected = strings.TrimSpace(selected)
	for _, priceID := range priceIDs {
		if strings.TrimSpace(priceID) == selected {
			return true
		}
	}
	return false
}
