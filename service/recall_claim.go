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
	"math"
	"net/mail"
	"sort"
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

const recallOfferCandidateServicePageSize = 500

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

func (s *RecallClaimService) ListOffers(ctx context.Context, userID int) ([]RecallOfferView, error) {
	offers := make([]RecallOfferView, 0)
	if !operation_setting.IsRecallCampaignEnabled() {
		return offers, nil
	}
	user, ok, err := recallEnabledUserIdentity(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return offers, nil
	}
	allSubscriptionPriceIDs := make([]string, 0)
	afterRecipientID := int64(0)
	now := s.now().Unix()
	for {
		page, err := model.ListRecallOfferCandidatePageForUserWithContext(ctx, user.Id, strings.ToLower(strings.TrimSpace(user.Email)), now, afterRecipientID, recallOfferCandidateServicePageSize)
		if err != nil {
			return nil, err
		}
		for _, candidate := range page.Candidates {
			offer, err := s.recallOfferFromCandidate(ctx, candidate, false)
			if err != nil {
				if isSkippableRecallOfferCandidateError(err) {
					logRecallOfferCandidateSkip(candidate, err)
					continue
				}
				return nil, err
			}
			offers = append(offers, offer.View)
			allSubscriptionPriceIDs = append(allSubscriptionPriceIDs, offer.View.Products.SubscriptionPriceIDs...)
		}
		if !page.HasMore {
			break
		}
		afterRecipientID = page.NextAfterRecipientID
	}
	planIDsByPriceID, err := resolveRecallSubscriptionPlanIDsByPriceID(ctx, allSubscriptionPriceIDs)
	if err != nil {
		return nil, err
	}
	for index := range offers {
		offers[index].Products.SubscriptionPlanIDs = recallSubscriptionPlanIDsForPriceIDs(offers[index].Products.SubscriptionPriceIDs, planIDsByPriceID)
	}
	sort.SliceStable(offers, func(i, j int) bool {
		if offers[i].IssuedAt != offers[j].IssuedAt {
			return offers[i].IssuedAt > offers[j].IssuedAt
		}
		return offers[i].RecipientID < offers[j].RecipientID
	})
	return offers, nil
}

func (s *RecallClaimService) ResolveBestRecallOffer(ctx context.Context, userID int, purchaseKind string, priceID string, currency string, subtotalMinor int64) (*RecallResolvedOffer, error) {
	purchaseKind = strings.TrimSpace(purchaseKind)
	priceID = strings.TrimSpace(priceID)
	currency = strings.TrimSpace(currency)
	if purchaseKind != RecallPurchaseKindTopUp && purchaseKind != RecallPurchaseKindSubscription {
		return nil, ErrRecallClaimPurchaseKind
	}
	if priceID == "" {
		return nil, ErrRecallClaimWrongPrice
	}
	if currency == "" || subtotalMinor < 0 {
		return nil, fmt.Errorf("recall offer purchase facts are invalid")
	}
	if subtotalMinor == 0 {
		return nil, nil
	}
	if !operation_setting.IsRecallCampaignEnabled() {
		return nil, nil
	}
	user, ok, err := recallEnabledUserIdentity(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	var best *RecallResolvedOffer
	afterRecipientID := int64(0)
	now := s.now().Unix()
	for {
		page, err := model.ListRecallOfferCandidatePageForUserWithContext(ctx, user.Id, strings.ToLower(strings.TrimSpace(user.Email)), now, afterRecipientID, recallOfferCandidateServicePageSize)
		if err != nil {
			return nil, err
		}
		for _, candidate := range page.Candidates {
			offer, err := s.recallOfferFromCandidate(ctx, candidate, false)
			if err != nil {
				if isSkippableRecallOfferCandidateError(err) {
					logRecallOfferCandidateSkip(candidate, err)
					continue
				}
				return nil, err
			}
			if !recallOfferAppliesToPrice(offer.View.Products, purchaseKind, priceID) {
				continue
			}
			discountMinor := calculateRecallActualDiscountAmountMinor(offer.View.Discount, currency, subtotalMinor)
			if discountMinor <= 0 {
				continue
			}
			offer.DiscountMinor = discountMinor
			if best == nil || recallResolvedOfferBeats(*offer, *best) {
				selected := *offer
				best = &selected
			}
		}
		if !page.HasMore {
			break
		}
		afterRecipientID = page.NextAfterRecipientID
	}
	return best, nil
}

func recallResolvedOfferBeats(candidate RecallResolvedOffer, current RecallResolvedOffer) bool {
	if candidate.DiscountMinor != current.DiscountMinor {
		return candidate.DiscountMinor > current.DiscountMinor
	}
	if candidate.View.IssuedAt != current.View.IssuedAt {
		return candidate.View.IssuedAt > current.View.IssuedAt
	}
	return candidate.View.RecipientID < current.View.RecipientID
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
	campaignType, err := normalizeRecallCampaignType(record.Campaign.CampaignType)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: campaign type", ErrRecallClaimInvalidConfig)
	}
	if campaignType != model.RecallCampaignTypePromotion {
		return nil, nil, ErrRecallClaimPromotionInvalid
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
	subscriptionPlanIDs, err := resolveRecallSubscriptionPlanIDs(ctx, products.SubscriptionPriceIDs)
	if err != nil {
		return nil, nil, err
	}
	products.SubscriptionPlanIDs = subscriptionPlanIDs
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

func recallEnabledUserIdentity(ctx context.Context, userID int) (*model.User, bool, error) {
	user, found, err := model.GetRecallClaimUserWithContext(ctx, userID)
	if err != nil {
		return nil, false, err
	}
	if !found || user.Status != common.UserStatusEnabled {
		return nil, false, nil
	}
	if _, ok := normalizeRecallClaimEmail(user.Email); !ok {
		return nil, false, nil
	}
	return user, true, nil
}

func (s *RecallClaimService) recallOfferFromCandidate(ctx context.Context, candidate model.RecallOfferCandidate, hydrateSubscriptionPlanIDs bool) (*RecallResolvedOffer, error) {
	if candidate.Campaign.Id != candidate.Recipient.CampaignId || !activeRecallCampaignStatus(candidate.Campaign.Status) {
		return nil, ErrRecallClaimInactive
	}
	if candidate.Recipient.ConvertedAt != 0 || candidate.Recipient.State == model.RecallRecipientConverted {
		return nil, ErrRecallClaimConverted
	}
	if candidate.Recipient.State == model.RecallRecipientSuppressed {
		return nil, ErrRecallClaimSuppressed
	}
	if !activeRecallRecipientState(candidate.Recipient.State) {
		return nil, ErrRecallClaimInactive
	}
	promotionCodeID := ""
	if candidate.Recipient.StripePromotionCodeId != nil {
		promotionCodeID = strings.TrimSpace(*candidate.Recipient.StripePromotionCodeId)
	}
	if promotionCodeID == "" || strings.TrimSpace(candidate.Recipient.PromotionCode) == "" {
		return nil, ErrRecallClaimPromotionInvalid
	}
	if candidate.Recipient.PromotionExpiresAt <= s.now().Unix() {
		return nil, ErrRecallClaimExpired
	}
	discount := RecallDiscountConfig{}
	if err := common.Unmarshal([]byte(candidate.Campaign.DiscountConfig), &discount); err != nil {
		return nil, fmt.Errorf("%w: discount", ErrRecallClaimInvalidConfig)
	}
	products := RecallProductScope{}
	if err := common.Unmarshal([]byte(candidate.Campaign.ProductScope), &products); err != nil {
		return nil, fmt.Errorf("%w: products", ErrRecallClaimInvalidConfig)
	}
	products.TopUpPriceIDs = normalizeRecallStripeIDs(products.TopUpPriceIDs)
	products.SubscriptionPriceIDs = normalizeRecallStripeIDs(products.SubscriptionPriceIDs)
	if len(products.TopUpPriceIDs)+len(products.SubscriptionPriceIDs) == 0 {
		return nil, fmt.Errorf("%w: products", ErrRecallClaimInvalidConfig)
	}
	if hydrateSubscriptionPlanIDs {
		subscriptionPlanIDs, err := resolveRecallSubscriptionPlanIDs(ctx, products.SubscriptionPriceIDs)
		if err != nil {
			return nil, err
		}
		products.SubscriptionPlanIDs = subscriptionPlanIDs
	}
	view := RecallOfferView{
		RecallClaimView: RecallClaimView{
			CampaignID:          candidate.Campaign.Id,
			RecipientID:         candidate.Recipient.Id,
			CampaignName:        candidate.Campaign.Name,
			PromotionCodeMasked: model.MaskPromotionCode(candidate.Recipient.PromotionCode),
			ExpiresAt:           candidate.Recipient.PromotionExpiresAt,
			Discount:            discount,
			Products:            products,
			Redeemed:            false,
		},
		IssuedAt: candidate.EffectiveIssuedAt(),
	}
	return &RecallResolvedOffer{
		View:            view,
		PromotionCodeID: promotionCodeID,
	}, nil
}

func resolveRecallSubscriptionPlanIDs(ctx context.Context, rawPriceIDs []string) ([]int, error) {
	planIDsByPriceID, err := resolveRecallSubscriptionPlanIDsByPriceID(ctx, rawPriceIDs)
	if err != nil {
		return nil, err
	}
	return recallSubscriptionPlanIDsForPriceIDs(rawPriceIDs, planIDsByPriceID), nil
}

func resolveRecallSubscriptionPlanIDsByPriceID(ctx context.Context, rawPriceIDs []string) (map[string][]int, error) {
	priceIDs := normalizeRecallStripeIDs(rawPriceIDs)
	if len(priceIDs) == 0 {
		return map[string][]int{}, nil
	}
	plans, err := model.ListRecallSubscriptionPlansByStripePriceIDsWithContext(ctx, priceIDs)
	if err != nil {
		return nil, err
	}
	planIDsByPriceID := make(map[string][]int, len(plans))
	for _, plan := range plans {
		priceID := strings.TrimSpace(plan.StripePriceId)
		if priceID != "" && plan.Id > 0 && plan.Enabled {
			planIDsByPriceID[priceID] = append(planIDsByPriceID[priceID], plan.Id)
		}
	}
	return planIDsByPriceID, nil
}

func recallSubscriptionPlanIDsForPriceIDs(rawPriceIDs []string, planIDsByPriceID map[string][]int) []int {
	priceIDs := normalizeRecallStripeIDs(rawPriceIDs)
	planIDs := make([]int, 0, len(priceIDs))
	seen := make(map[int]struct{}, len(priceIDs))
	for _, priceID := range priceIDs {
		for _, planID := range planIDsByPriceID[priceID] {
			if _, exists := seen[planID]; exists {
				continue
			}
			seen[planID] = struct{}{}
			planIDs = append(planIDs, planID)
		}
	}
	return planIDs
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

func (s *RecallClaimService) BuildFirstMonthPurchaseDiscount(ctx context.Context, userID int, claim string, purchaseKind string, priceID string, currency string, unitAmountMinor int64) (*RecallPurchaseDiscount, error) {
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
	discountMinor := calculateRecallFirstMonthDiscountAmountMinor(view.Discount, currency, unitAmountMinor)
	if discountMinor <= 0 {
		return &RecallPurchaseDiscount{}, nil
	}
	promotionCodeID := strings.TrimSpace(*record.Recipient.StripePromotionCodeId)
	if promotionCodeID == "" || view.CampaignID <= 0 || view.RecipientID <= 0 {
		return nil, ErrRecallClaimPromotionInvalid
	}
	return &RecallPurchaseDiscount{
		PromotionCodeID:     promotionCodeID,
		CampaignID:          view.CampaignID,
		RecipientID:         view.RecipientID,
		DiscountAmountMinor: discountMinor,
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

func recallOfferAppliesToPrice(products RecallProductScope, purchaseKind string, priceID string) bool {
	switch purchaseKind {
	case RecallPurchaseKindTopUp:
		return containsRecallPriceID(products.TopUpPriceIDs, priceID)
	case RecallPurchaseKindSubscription:
		return containsRecallPriceID(products.SubscriptionPriceIDs, priceID)
	default:
		return false
	}
}

func logRecallOfferCandidateSkip(candidate model.RecallOfferCandidate, err error) {
	if err == nil {
		return
	}
	common.SysLog(fmt.Sprintf(
		"recall_offer_candidate_skipped campaign_id=%d recipient_id=%d reason=%s",
		candidate.Campaign.Id,
		candidate.Recipient.Id,
		sanitizeRecallOfferSkipReason(err),
	))
}

func isSkippableRecallOfferCandidateError(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, ErrRecallClaimInactive) ||
		errors.Is(err, ErrRecallClaimConverted) ||
		errors.Is(err, ErrRecallClaimSuppressed) ||
		errors.Is(err, ErrRecallClaimPromotionInvalid) ||
		errors.Is(err, ErrRecallClaimExpired) ||
		errors.Is(err, ErrRecallClaimInvalidConfig)
}

func sanitizeRecallOfferSkipReason(err error) string {
	if err == nil {
		return ""
	}
	switch {
	case errors.Is(err, ErrRecallClaimInactive):
		return "inactive"
	case errors.Is(err, ErrRecallClaimConverted):
		return "converted"
	case errors.Is(err, ErrRecallClaimSuppressed):
		return "suppressed"
	case errors.Is(err, ErrRecallClaimPromotionInvalid):
		return "promotion_invalid"
	case errors.Is(err, ErrRecallClaimExpired):
		return "expired"
	case errors.Is(err, ErrRecallClaimInvalidConfig):
		return "invalid_config"
	default:
		return "error"
	}
}

func calculateRecallFirstMonthDiscountAmountMinor(discount RecallDiscountConfig, currency string, unitAmountMinor int64) int64 {
	return calculateRecallDiscountAmountMinor(discount, currency, unitAmountMinor, false)
}

func calculateRecallActualDiscountAmountMinor(discount RecallDiscountConfig, currency string, subtotalMinor int64) int64 {
	return calculateRecallDiscountAmountMinor(discount, currency, subtotalMinor, true)
}

func calculateRecallDiscountAmountMinor(discount RecallDiscountConfig, currency string, unitAmountMinor int64, exactCurrency bool) int64 {
	if unitAmountMinor <= 0 {
		return 0
	}
	currency = strings.TrimSpace(currency)
	currencyMatches := func(configured string) bool {
		configured = strings.TrimSpace(configured)
		if exactCurrency {
			return strings.ToUpper(configured) == strings.ToUpper(currency)
		}
		return strings.EqualFold(configured, currency)
	}
	if discount.MinimumSpend != nil && discount.MinimumSpend.Enabled {
		minimumAmount, ok := discount.MinimumSpend.Amounts[strings.ToLower(currency)]
		if !ok || unitAmountMinor < minimumAmount {
			return 0
		}
	} else if discount.MinimumSpend == nil && discount.MinimumAmount > 0 {
		if !currencyMatches(discount.MinimumAmountCurrency) || unitAmountMinor < discount.MinimumAmount {
			return 0
		}
	}
	var amount int64
	switch strings.ToLower(strings.TrimSpace(discount.Type)) {
	case "percent":
		if discount.PercentOff <= 0 {
			return 0
		}
		if discount.PercentOff >= 100 {
			return unitAmountMinor
		}
		raw := math.Round(float64(unitAmountMinor) * discount.PercentOff / 100)
		if raw >= float64(unitAmountMinor) {
			return unitAmountMinor
		}
		amount = int64(raw)
	case "fixed":
		found := false
		for optionCurrency, optionAmount := range discount.CurrencyOptions {
			if currencyMatches(optionCurrency) {
				amount = optionAmount
				found = true
				break
			}
		}
		if !found {
			if !currencyMatches(discount.Currency) {
				return 0
			}
			amount = discount.AmountOff
		}
	default:
		return 0
	}
	if amount < 0 {
		return 0
	}
	if amount > unitAmountMinor {
		return unitAmountMinor
	}
	return amount
}
