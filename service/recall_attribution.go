package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stripe/stripe-go/v86"
)

type RecallPaymentFact struct {
	SourceEventID     string
	CheckoutSessionID string
	TradeNo           string
	UserID            int
	AmountTotal       int64
	Currency          string
	DiscountAmount    int64
	PromotionCodeID   string
	ClaimCampaignID   int64
	ClaimRecipientID  int64

	hasDiscount           bool
	discountDetailsLoaded bool
}

type RecallCurrencyMetrics struct {
	Currency       string `json:"currency"`
	DirectCount    int64  `json:"direct_count"`
	AssistedCount  int64  `json:"assisted_count"`
	NoCouponCount  int64  `json:"no_coupon_count"`
	PaymentAmount  int64  `json:"payment_amount"`
	DiscountAmount int64  `json:"discount_amount"`
}

type RecallCampaignMetrics struct {
	CandidateCount         int64                   `json:"candidate_count"`
	EnrolledCount          int64                   `json:"enrolled_count"`
	ExcludedCount          int64                   `json:"excluded_count"`
	CustomerSuccessCount   int64                   `json:"customer_success_count"`
	CustomerFailureCount   int64                   `json:"customer_failure_count"`
	CodeSuccessCount       int64                   `json:"code_success_count"`
	CodeFailureCount       int64                   `json:"code_failure_count"`
	MessagesScheduledCount int64                   `json:"messages_scheduled_count"`
	MessagesAcceptedCount  int64                   `json:"messages_accepted_count"`
	MessagesFailedCount    int64                   `json:"messages_failed_count"`
	MessagesCancelledCount int64                   `json:"messages_cancelled_count"`
	ObservedClickCount     int64                   `json:"observed_click_count"`
	DirectCount            int64                   `json:"direct_count"`
	AssistedCount          int64                   `json:"assisted_count"`
	NoCouponCount          int64                   `json:"no_coupon_count"`
	CurrencyMetrics        []RecallCurrencyMetrics `json:"currency_metrics"`
}

type RecallAttributionService struct {
	stripe RecallStripeClient
	now    func() time.Time
}

const (
	recallAttributionLeaseDuration = 15 * time.Minute
	recallAttributionRetryBase     = time.Minute
	recallAttributionRetryMax      = time.Hour
)

var recallAttributionCheckoutSessionExpansions = []string{
	"discounts.promotion_code",
	"total_details.breakdown.discounts.discount",
}

func NewRecallAttributionService(client RecallStripeClient) *RecallAttributionService {
	if client == nil {
		client = NewStripeRecallClient()
	}
	return &RecallAttributionService{stripe: client, now: time.Now}
}

func ParseRecallPayment(event stripe.Event, tradeNo string, userID int) (RecallPaymentFact, error) {
	if event.Data == nil || len(event.Data.Raw) == 0 {
		return RecallPaymentFact{}, errors.New("Stripe event is missing Checkout Session data")
	}
	var session stripe.CheckoutSession
	if err := common.Unmarshal(event.Data.Raw, &session); err != nil {
		return RecallPaymentFact{}, err
	}
	fact := recallPaymentFactFromSession(&session)
	fact.SourceEventID = strings.TrimSpace(event.ID)
	fact.TradeNo = strings.TrimSpace(tradeNo)
	fact.UserID = userID
	return fact, nil
}

func recallPaymentFactFromSession(session *stripe.CheckoutSession) RecallPaymentFact {
	if session == nil {
		return RecallPaymentFact{}
	}
	fact := RecallPaymentFact{
		CheckoutSessionID: strings.TrimSpace(session.ID),
		AmountTotal:       session.AmountTotal,
		Currency:          strings.ToUpper(strings.TrimSpace(string(session.Currency))),
	}
	if session.TotalDetails != nil {
		fact.DiscountAmount = session.TotalDetails.AmountDiscount
		fact.hasDiscount = session.TotalDetails.AmountDiscount > 0
	}
	if len(session.Discounts) > 0 {
		fact.hasDiscount = true
	}
	for _, discount := range session.Discounts {
		if discount != nil && discount.PromotionCode != nil && strings.TrimSpace(discount.PromotionCode.ID) != "" {
			fact.PromotionCodeID = strings.TrimSpace(discount.PromotionCode.ID)
			break
		}
	}
	if session.TotalDetails != nil && session.TotalDetails.Breakdown != nil {
		if len(session.TotalDetails.Breakdown.Discounts) > 0 {
			fact.hasDiscount = true
		}
		if fact.PromotionCodeID == "" {
			for _, breakdown := range session.TotalDetails.Breakdown.Discounts {
				if breakdown == nil || breakdown.Discount == nil || breakdown.Discount.PromotionCode == nil {
					continue
				}
				fact.PromotionCodeID = strings.TrimSpace(breakdown.Discount.PromotionCode.ID)
				if fact.PromotionCodeID != "" {
					break
				}
			}
		}
	}
	amountDetailsLoaded := session.TotalDetails != nil
	discountIdentityLoaded := recallCheckoutDiscountIdentityLoaded(session.Discounts)
	if session.TotalDetails != nil && session.TotalDetails.Breakdown != nil && len(session.TotalDetails.Breakdown.Discounts) > 0 {
		discountIdentityLoaded = recallBreakdownDiscountIdentityLoaded(session.TotalDetails.Breakdown.Discounts)
	}
	fact.discountDetailsLoaded = amountDetailsLoaded && discountIdentityLoaded
	if session.Metadata != nil {
		fact.ClaimCampaignID, _ = strconv.ParseInt(strings.TrimSpace(session.Metadata["recall_campaign_id"]), 10, 64)
		fact.ClaimRecipientID, _ = strconv.ParseInt(strings.TrimSpace(session.Metadata["recall_recipient_id"]), 10, 64)
	}
	return fact
}

func (s *RecallAttributionService) Attribute(ctx context.Context, fact RecallPaymentFact) error {
	if s == nil {
		return errors.New("recall attribution service is nil")
	}
	if fact.UserID <= 0 || strings.TrimSpace(fact.TradeNo) == "" {
		return errors.New("recall payment fact is missing local order identity")
	}
	if !fact.discountDetailsLoaded && strings.TrimSpace(fact.CheckoutSessionID) != "" {
		hydrated, err := s.stripe.GetCheckoutSession(
			ctx,
			strings.TrimSpace(fact.CheckoutSessionID),
			recallAttributionCheckoutSessionExpansions...,
		)
		if err != nil {
			return wrapRecallStripeError("get Stripe Checkout Session for recall attribution", err)
		}
		if hydrated == nil {
			return errors.New("Stripe Checkout Session is unavailable for recall attribution")
		}
		fresh := recallPaymentFactFromSession(hydrated)
		fresh.discountDetailsLoaded = true
		fresh.SourceEventID = fact.SourceEventID
		fresh.TradeNo = fact.TradeNo
		fresh.UserID = fact.UserID
		if fresh.ClaimCampaignID == 0 {
			fresh.ClaimCampaignID = fact.ClaimCampaignID
		}
		if fresh.ClaimRecipientID == 0 {
			fresh.ClaimRecipientID = fact.ClaimRecipientID
		}
		fact = fresh
	}

	var recipient *model.RecallRecipient
	kind := ""
	if promotionCodeID := strings.TrimSpace(fact.PromotionCodeID); promotionCodeID != "" {
		matched, found, err := model.GetRecallRecipientByPromotionCodeWithContext(ctx, fact.UserID, promotionCodeID)
		if err != nil {
			return err
		}
		if found {
			recipient = matched
			kind = model.RecallConversionDirect
		}
	}
	if recipient == nil && fact.ClaimCampaignID > 0 && fact.ClaimRecipientID > 0 {
		matched, found, err := model.GetRecallRecipientByClaimWithContext(ctx, fact.UserID, fact.ClaimCampaignID, fact.ClaimRecipientID)
		if err != nil {
			return err
		}
		if found {
			recipient = matched
			if fact.hasDiscount {
				kind = model.RecallConversionAssisted
			} else {
				kind = model.RecallConversionNoCoupon
			}
		}
	}
	if recipient == nil {
		return nil
	}

	sourceEventID := strings.TrimSpace(fact.SourceEventID)
	if sourceEventID == "" {
		sourceEventID = "checkout:" + strings.TrimSpace(fact.CheckoutSessionID)
	}
	if sourceEventID == "checkout:" {
		sourceEventID = "trade:" + strings.TrimSpace(fact.TradeNo)
	}
	eventData, err := common.Marshal(map[string]any{
		"checkout_session_id": strings.TrimSpace(fact.CheckoutSessionID),
		"trade_no":            strings.TrimSpace(fact.TradeNo),
		"conversion_kind":     kind,
		"currency":            strings.ToUpper(strings.TrimSpace(fact.Currency)),
		"amount_total":        fact.AmountTotal,
		"discount_amount":     fact.DiscountAmount,
	})
	if err != nil {
		return fmt.Errorf("marshal recall conversion event: %w", err)
	}
	_, err = model.RecordRecallConversionWithContext(ctx, model.RecallConversionRecord{
		RecipientId:    recipient.Id,
		CampaignId:     recipient.CampaignId,
		UserId:         fact.UserID,
		Kind:           kind,
		TradeNo:        strings.TrimSpace(fact.TradeNo),
		Currency:       strings.ToUpper(strings.TrimSpace(fact.Currency)),
		Amount:         fact.AmountTotal,
		DiscountAmount: fact.DiscountAmount,
		Source:         "stripe",
		SourceEventId:  sourceEventID,
		EventData:      string(eventData),
		ConvertedAt:    s.now().Unix(),
	})
	return err
}

func (s *RecallAttributionService) ReconcileBatch(ctx context.Context, limit int) (int, error) {
	if s == nil || s.stripe == nil || limit <= 0 {
		return 0, nil
	}
	batchNow := s.now().Unix()
	candidates, err := model.ListRecallAttributionCandidatesWithContext(ctx, batchNow, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	var firstErr error
	for _, candidate := range candidates {
		lease, acquired, leaseErr := model.LeaseRecallAttributionCandidateWithContext(
			ctx,
			candidate,
			batchNow,
			batchNow+int64(recallAttributionLeaseDuration/time.Second),
		)
		if leaseErr != nil {
			if firstErr == nil {
				firstErr = leaseErr
			}
			continue
		}
		if !acquired {
			continue
		}
		session, getErr := s.stripe.GetCheckoutSession(
			ctx,
			candidate.CheckoutSessionId,
			recallAttributionCheckoutSessionExpansions...,
		)
		if getErr != nil {
			wrappedErr := wrapRecallStripeError("get Stripe Checkout Session for recall reconciliation", getErr)
			if firstErr == nil {
				firstErr = wrappedErr
			}
			var progressErr error
			if isRecallReconciliationMissingResource(wrappedErr) {
				_, progressErr = model.CompleteRecallAttributionCandidateWithContext(ctx, candidate, lease, s.now().Unix(), "stripe_fetch_missing")
			} else {
				_, progressErr = model.RetryRecallAttributionCandidateWithContext(ctx, candidate, lease, recallAttributionNextAttemptAt(s.now(), lease.Attempt), "stripe_fetch_failed")
			}
			if firstErr == nil && progressErr != nil {
				firstErr = progressErr
			}
			continue
		}
		if session == nil {
			if firstErr == nil {
				firstErr = errors.New("Stripe Checkout Session is unavailable for recall reconciliation")
			}
			if _, progressErr := model.RetryRecallAttributionCandidateWithContext(ctx, candidate, lease, recallAttributionNextAttemptAt(s.now(), lease.Attempt), "stripe_session_unavailable"); firstErr == nil && progressErr != nil {
				firstErr = progressErr
			}
			continue
		}
		if session.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid && session.PaymentStatus != stripe.CheckoutSessionPaymentStatusNoPaymentRequired {
			if _, progressErr := model.RetryRecallAttributionCandidateWithContext(ctx, candidate, lease, recallAttributionNextAttemptAt(s.now(), lease.Attempt), "stripe_payment_pending"); firstErr == nil && progressErr != nil {
				firstErr = progressErr
			}
			continue
		}
		if session.Created > 0 && session.Created < candidate.EnrolledAt {
			if _, progressErr := model.CompleteRecallAttributionCandidateWithContext(ctx, candidate, lease, s.now().Unix(), "session_before_enrollment"); firstErr == nil && progressErr != nil {
				firstErr = progressErr
			}
			continue
		}
		fact := recallPaymentFactFromSession(session)
		fact.discountDetailsLoaded = true
		if fact.CheckoutSessionID == "" {
			fact.CheckoutSessionID = candidate.CheckoutSessionId
		}
		fact.SourceEventID = "reconcile:" + candidate.CheckoutSessionId
		fact.TradeNo = candidate.TradeNo
		fact.UserID = candidate.UserId
		if attributeErr := s.Attribute(ctx, fact); attributeErr != nil {
			if firstErr == nil {
				firstErr = attributeErr
			}
			if _, progressErr := model.RetryRecallAttributionCandidateWithContext(ctx, candidate, lease, recallAttributionNextAttemptAt(s.now(), lease.Attempt), "attribution_failed"); firstErr == nil && progressErr != nil {
				firstErr = progressErr
			}
			continue
		}
		completed, progressErr := model.CompleteRecallAttributionCandidateWithContext(ctx, candidate, lease, s.now().Unix(), "examined")
		if progressErr != nil {
			if firstErr == nil {
				firstErr = progressErr
			}
			continue
		}
		if completed {
			processed++
		}
	}
	return processed, firstErr
}

func recallCheckoutDiscountIdentityLoaded(discounts []*stripe.CheckoutSessionDiscount) bool {
	if discounts == nil {
		return false
	}
	for _, discount := range discounts {
		if discount == nil {
			return false
		}
		if discount.PromotionCode != nil && strings.TrimSpace(discount.PromotionCode.ID) != "" {
			continue
		}
		return false
	}
	return true
}

func recallBreakdownDiscountIdentityLoaded(discounts []*stripe.CheckoutSessionTotalDetailsBreakdownDiscount) bool {
	for _, breakdown := range discounts {
		if breakdown == nil || breakdown.Discount == nil {
			return false
		}
		if breakdown.Discount.PromotionCode != nil && strings.TrimSpace(breakdown.Discount.PromotionCode.ID) != "" {
			continue
		}
		if breakdown.Discount.Source != nil && breakdown.Discount.Source.Coupon != nil && strings.TrimSpace(breakdown.Discount.Source.Coupon.ID) != "" {
			continue
		}
		return false
	}
	return true
}

func isRecallReconciliationMissingResource(err error) bool {
	var stripeErr *stripe.Error
	return errors.As(err, &stripeErr) && stripeErr.Code == stripe.ErrorCodeResourceMissing
}

func recallAttributionNextAttemptAt(now time.Time, attempt int) int64 {
	delay := recallAttributionRetryBase
	for currentAttempt := 1; currentAttempt < attempt && delay < recallAttributionRetryMax; currentAttempt++ {
		delay *= 2
		if delay > recallAttributionRetryMax {
			delay = recallAttributionRetryMax
		}
	}
	return now.Add(delay).Unix()
}

func (s *RecallAttributionService) GetMetrics(ctx context.Context, campaignID int64) (RecallCampaignMetrics, error) {
	countRows, currencyRows, err := model.QueryRecallCampaignMetricRows(ctx, campaignID)
	if err != nil {
		return RecallCampaignMetrics{}, err
	}
	metrics := RecallCampaignMetrics{CurrencyMetrics: make([]RecallCurrencyMetrics, 0)}
	for _, row := range countRows {
		switch row.Metric {
		case "candidates":
			metrics.CandidateCount = row.Count
		case "enrolled":
			metrics.EnrolledCount = row.Count
		case "excluded":
			metrics.ExcludedCount = row.Count
		case "customer_success":
			metrics.CustomerSuccessCount = row.Count
		case "customer_failure":
			metrics.CustomerFailureCount = row.Count
		case "code_success":
			metrics.CodeSuccessCount = row.Count
		case "code_failure":
			metrics.CodeFailureCount = row.Count
		case "messages_scheduled":
			metrics.MessagesScheduledCount = row.Count
		case "messages_accepted":
			metrics.MessagesAcceptedCount = row.Count
		case "messages_failed":
			metrics.MessagesFailedCount = row.Count
		case "messages_cancelled":
			metrics.MessagesCancelledCount = row.Count
		case "observed_clicks":
			metrics.ObservedClickCount = row.Count
		case "direct":
			metrics.DirectCount = row.Count
		case "assisted":
			metrics.AssistedCount = row.Count
		case "no_coupon":
			metrics.NoCouponCount = row.Count
		}
	}
	indexByCurrency := make(map[string]int)
	for _, row := range currencyRows {
		index, exists := indexByCurrency[row.Currency]
		if !exists {
			index = len(metrics.CurrencyMetrics)
			indexByCurrency[row.Currency] = index
			metrics.CurrencyMetrics = append(metrics.CurrencyMetrics, RecallCurrencyMetrics{Currency: row.Currency})
		}
		currency := &metrics.CurrencyMetrics[index]
		switch row.ConversionKind {
		case model.RecallConversionDirect:
			currency.DirectCount += row.Count
		case model.RecallConversionAssisted:
			currency.AssistedCount += row.Count
		case model.RecallConversionNoCoupon:
			currency.NoCouponCount += row.Count
		}
		currency.PaymentAmount += row.PaymentAmount
		currency.DiscountAmount += row.DiscountAmount
	}
	return metrics, nil
}
