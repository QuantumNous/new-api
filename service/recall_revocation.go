package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

const (
	recallPromotionRevocationLeaseSeconds = int64(60)
	recallPromotionRevocationBaseBackoff  = int64(60)
	recallPromotionRevocationMaxBackoff   = int64(3600)
)

type RecallPromotionRevocationWorker struct {
	stripe   *RecallStripeService
	now      func() time.Time
	owner    string
	scanGate chan struct{}
}

func NewRecallPromotionRevocationWorker(stripeService *RecallStripeService, owner string) *RecallPromotionRevocationWorker {
	if stripeService == nil {
		stripeService = NewRecallStripeService(nil)
	}
	return &RecallPromotionRevocationWorker{
		stripe:   stripeService,
		now:      time.Now,
		owner:    strings.TrimSpace(owner),
		scanGate: make(chan struct{}, 1),
	}
}

func (w *RecallPromotionRevocationWorker) RunBatch(ctx context.Context, limit int) (int, error) {
	if w == nil || limit <= 0 {
		return 0, nil
	}
	if strings.TrimSpace(w.owner) == "" {
		return 0, fmt.Errorf("recall promotion revocation owner is required")
	}
	select {
	case w.scanGate <- struct{}{}:
		defer func() { <-w.scanGate }()
	case <-ctx.Done():
		return 0, ctx.Err()
	}
	now := w.now().Unix()
	items, err := model.ListDueRecallPromotionRevocationsWithContext(ctx, now, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	var firstErr error
	for _, item := range items {
		if err := ctx.Err(); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			break
		}
		leaseUntil := now + recallPromotionRevocationLeaseSeconds
		won, leaseErr := model.LeaseRecallPromotionRevocation(ctx, item.Id, w.owner, now, leaseUntil)
		if leaseErr != nil {
			if firstErr == nil {
				firstErr = leaseErr
			}
			continue
		}
		if !won {
			continue
		}
		processed++
		if err := w.ProcessLeased(ctx, item.Id); err != nil {
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return processed, firstErr
}

func (w *RecallPromotionRevocationWorker) ProcessLeased(ctx context.Context, recipientID int64) error {
	recipient, found, err := model.GetRecallRecipientByIDWithContext(ctx, recipientID)
	if err != nil {
		return err
	}
	if !found || recipient.PromotionRevocationLeaseOwner != w.owner || recipient.PromotionRevocationLeaseExpiresAt <= 0 {
		return ErrRecallRecipientLeaseLost
	}
	now := w.now().Unix()
	promotionID := ""
	if recipient.StripePromotionCodeId != nil {
		promotionID = strings.TrimSpace(*recipient.StripePromotionCodeId)
	}
	if promotionID == "" {
		return w.complete(ctx, recipient, now, "missing_promotion_code")
	}
	if recipient.PromotionExpiresAt > 0 && recipient.PromotionExpiresAt <= now {
		return w.complete(ctx, recipient, now, "")
	}
	promotion, err := w.stripe.client.GetPromotionCode(ctx, promotionID)
	if err != nil {
		if isRecallStripeMissing(err) {
			return w.complete(ctx, recipient, now, "")
		}
		return w.finishError(ctx, recipient, err, now)
	}
	if promotion == nil || strings.TrimSpace(promotion.ID) == "" {
		return w.complete(ctx, recipient, now, "")
	}
	if strings.TrimSpace(promotion.ID) != promotionID {
		return w.finishError(ctx, recipient, recallStripePermanent("revoke Stripe Promotion Code", "Stripe Promotion Code response does not match requested Promotion Code"), now)
	}
	if recallPromotionAlreadyTerminal(promotion, now) {
		return w.complete(ctx, recipient, now, "")
	}
	params := &stripe.PromotionCodeParams{Active: stripe.Bool(false)}
	params.Context = ctx
	params.SetIdempotencyKey(fmt.Sprintf("recall_promotion_revocation:%d:%d", recipient.Id, recipient.PromotionRevocationLeaseExpiresAt))
	updated, err := w.stripe.client.UpdatePromotionCode(ctx, promotionID, params)
	if err != nil {
		return w.finishError(ctx, recipient, err, now)
	}
	if updated != nil && strings.TrimSpace(updated.ID) != "" && strings.TrimSpace(updated.ID) != promotionID {
		return w.finishError(ctx, recipient, recallStripePermanent("revoke Stripe Promotion Code", "Stripe Promotion Code update response does not match requested Promotion Code"), now)
	}
	return w.complete(ctx, recipient, now, "")
}

func recallPromotionAlreadyTerminal(promotion *stripe.PromotionCode, now int64) bool {
	if promotion == nil {
		return true
	}
	if !promotion.Active {
		return true
	}
	if promotion.ExpiresAt > 0 && promotion.ExpiresAt <= now {
		return true
	}
	if promotion.MaxRedemptions > 0 && promotion.TimesRedeemed >= promotion.MaxRedemptions {
		return true
	}
	return false
}

func (w *RecallPromotionRevocationWorker) complete(ctx context.Context, recipient *model.RecallRecipient, now int64, errorCode string) error {
	won, err := model.CompleteRecallPromotionRevocation(ctx, recipient.Id, w.owner, recipient.PromotionRevocationLeaseExpiresAt, now, errorCode)
	if err != nil {
		return err
	}
	if !won {
		return ErrRecallRecipientLeaseLost
	}
	return nil
}

func (w *RecallPromotionRevocationWorker) finishError(ctx context.Context, recipient *model.RecallRecipient, err error, now int64) error {
	if errors.Is(err, ErrRecallRecipientLeaseLost) || errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrRecallRecipientLeaseLost
	}
	kind := ClassifyRecallStripeError(err)
	if kind == RecallStripeErrorPermanent {
		won, updateErr := model.FailRecallPromotionRevocation(ctx, recipient.Id, w.owner, recipient.PromotionRevocationLeaseExpiresAt, "stripe_permanent")
		if updateErr != nil {
			return updateErr
		}
		if !won {
			return ErrRecallRecipientLeaseLost
		}
		w.logError(ctx, recipient, RecallStripeErrorPermanent)
		return nil
	}
	retryAt := now + recallPromotionRevocationBackoffSeconds(recipient.PromotionRevocationAttemptCount)
	won, updateErr := model.DeferRecallPromotionRevocation(ctx, recipient.Id, w.owner, recipient.PromotionRevocationLeaseExpiresAt, retryAt, "stripe_retryable")
	if updateErr != nil {
		return updateErr
	}
	if !won {
		return ErrRecallRecipientLeaseLost
	}
	w.logError(ctx, recipient, RecallStripeErrorRetryable)
	return nil
}

func recallPromotionRevocationBackoffSeconds(attempts int) int64 {
	backoff := recallPromotionRevocationBaseBackoff
	for i := 0; i < attempts && backoff < recallPromotionRevocationMaxBackoff; i++ {
		backoff *= 2
	}
	if backoff > recallPromotionRevocationMaxBackoff {
		return recallPromotionRevocationMaxBackoff
	}
	return backoff
}

func (w *RecallPromotionRevocationWorker) logError(ctx context.Context, recipient *model.RecallRecipient, kind RecallStripeErrorKind) {
	logger.LogWarn(ctx, fmt.Sprintf(
		"recall promotion revocation error: recipient_id=%d campaign_id=%d user_id=%d error_class=%s",
		recipient.Id,
		recipient.CampaignId,
		recipient.UserId,
		kind,
	))
}
