package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

const (
	recallRecipientLeaseSeconds = int64(60)
	recallRecipientRetrySeconds = int64(30)
	recallRecipientScanPages    = 8
)

var (
	ErrRecallRecipientLeaseLost = errors.New("recall recipient lease was lost")
	errRecallCampaignInactive   = errors.New("recall campaign does not allow recipient work")
)

type RecallRecipientWorker struct {
	stripe      *RecallStripeService
	claims      *RecallClaimService
	now         func() time.Time
	owner       string
	scanGate    chan struct{}
	scanAfterID int64
}

func NewRecallRecipientWorker(stripeService *RecallStripeService, claims *RecallClaimService, owner string) *RecallRecipientWorker {
	if stripeService == nil {
		stripeService = NewRecallStripeService(nil)
	}
	if claims == nil {
		claims = NewRecallClaimService()
	}
	return &RecallRecipientWorker{
		stripe:   stripeService,
		claims:   claims,
		now:      time.Now,
		owner:    strings.TrimSpace(owner),
		scanGate: make(chan struct{}, 1),
	}
}

func (w *RecallRecipientWorker) RunBatch(ctx context.Context, limit int) (int, error) {
	if limit <= 0 || w == nil {
		return 0, nil
	}
	if w.owner == "" {
		return 0, fmt.Errorf("recall recipient worker owner is required")
	}
	select {
	case w.scanGate <- struct{}{}:
		defer func() { <-w.scanGate }()
	case <-ctx.Done():
		return 0, ctx.Err()
	}
	queryNow := w.now().Unix()
	processed := 0
	var firstErr error
	afterID := w.scanAfterID
	wrapped := afterID == 0
	excludedCampaigns := make(map[int64]struct{})
	for page := 0; page < recallRecipientScanPages && processed < limit; page++ {
		if err := ctx.Err(); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			break
		}
		pageLimit := limit - processed
		excludedCampaignIDs := make([]int64, 0, len(excludedCampaigns))
		for campaignID := range excludedCampaigns {
			excludedCampaignIDs = append(excludedCampaignIDs, campaignID)
		}
		items, err := model.ListDueRecallRecipientWorkItems(ctx, queryNow, afterID, pageLimit, excludedCampaignIDs)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			break
		}
		if len(items) == 0 {
			if !wrapped && afterID > 0 {
				afterID = 0
				w.scanAfterID = 0
				wrapped = true
				continue
			}
			break
		}
		afterID = items[len(items)-1].Id
		w.scanAfterID = afterID
		pageProcessed, blockedCampaigns, pageErr := w.processRecallRecipientWorkItems(ctx, items)
		processed += pageProcessed
		for campaignID := range blockedCampaigns {
			excludedCampaigns[campaignID] = struct{}{}
		}
		if firstErr == nil && pageErr != nil {
			firstErr = pageErr
		}
		if len(items) < pageLimit && !wrapped && afterID > 0 && processed < limit {
			afterID = 0
			w.scanAfterID = 0
			wrapped = true
			continue
		}
		if len(items) < pageLimit {
			break
		}
	}
	return processed, firstErr
}

func (w *RecallRecipientWorker) processRecallRecipientWorkItems(ctx context.Context, items []model.RecallRecipientWorkItem) (int, map[int64]struct{}, error) {
	limiters := make(map[int64]chan struct{}, len(items))
	for _, item := range items {
		if _, ok := limiters[item.CampaignId]; ok {
			continue
		}
		campaignLimit := item.WorkerConcurrency
		if campaignLimit < 1 {
			campaignLimit = 1
		}
		limiters[item.CampaignId] = make(chan struct{}, campaignLimit)
	}

	var processed atomic.Int64
	var firstErr error
	var errorMu sync.Mutex
	blockedCampaigns := make(map[int64]struct{})
	var blockedMu sync.Mutex
	recordError := func(err error) {
		if err == nil || errors.Is(err, ErrRecallRecipientLeaseLost) {
			return
		}
		errorMu.Lock()
		if firstErr == nil {
			firstErr = err
		}
		errorMu.Unlock()
	}
	var workers sync.WaitGroup
	for _, item := range items {
		item := item
		workers.Add(1)
		go func() {
			defer workers.Done()
			limiter := limiters[item.CampaignId]
			select {
			case limiter <- struct{}{}:
				defer func() { <-limiter }()
			case <-ctx.Done():
				recordError(ctx.Err())
				return
			}
			now := w.now().Unix()
			leaseUntil := now + recallRecipientLeaseSeconds
			won, leaseErr := model.TryLeaseRecallRecipientWithinCampaignCapacity(ctx, item.Id, w.owner, now, leaseUntil)
			if leaseErr != nil {
				recordError(leaseErr)
				return
			}
			if !won {
				blockedMu.Lock()
				blockedCampaigns[item.CampaignId] = struct{}{}
				blockedMu.Unlock()
				return
			}
			processed.Add(1)
			recordError(w.ProcessLeased(ctx, item.Id))
		}()
	}
	workers.Wait()
	return int(processed.Load()), blockedCampaigns, firstErr
}

func (w *RecallRecipientWorker) ProcessLeased(ctx context.Context, recipientID int64) error {
	for {
		recipient, err := model.GetRecallRecipientForLeaseWithContext(ctx, recipientID, w.owner)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRecallRecipientLeaseLost
			}
			return err
		}
		if _, err := w.loadRunnableCampaign(ctx, recipient.CampaignId); err != nil {
			return w.finishRecipientError(ctx, recipient, err)
		}

		var stepErr error
		switch recipient.State {
		case model.RecallRecipientQueued:
			stepErr = w.ensureRecipientCustomer(ctx, recipient)
		case model.RecallRecipientCustomerReady:
			stepErr = w.ensureRecipientPromotion(ctx, recipient)
		case model.RecallRecipientCodeReady:
			stepErr = w.scheduleStageOne(ctx, recipient)
		default:
			_ = model.ReleaseRecallRecipientLease(recipient.Id, w.owner, recipient.LeaseExpiresAt)
			return nil
		}
		if stepErr != nil {
			return w.finishRecipientError(ctx, recipient, stepErr)
		}
		if recipient.State == model.RecallRecipientCodeReady {
			return nil
		}

		now := w.now().Unix()
		won, err := model.TryLeaseRecallRecipientWithinCampaignCapacity(ctx, recipient.Id, w.owner, now, now+recallRecipientLeaseSeconds)
		if err != nil {
			return err
		}
		if !won {
			return ErrRecallRecipientLeaseLost
		}
	}
}

func (w *RecallRecipientWorker) ensureRecipientCustomer(ctx context.Context, recipient *model.RecallRecipient) error {
	if recipient.UserId == 0 {
		won, err := model.AdvanceRecallRecipientLease(ctx, recipient.Id, w.owner, recipient.LeaseExpiresAt,
			[]string{model.RecallRecipientQueued}, model.RecallRecipientCustomerReady,
			map[string]any{"last_error_code": "", "last_error_message": ""})
		if err != nil {
			return err
		}
		if !won {
			return ErrRecallRecipientLeaseLost
		}
		return nil
	}
	user, err := model.GetUserByIdWithContext(ctx, recipient.UserId)
	if err != nil {
		return recallStripePermanent("load recall user", "user %d is unavailable", recipient.UserId)
	}
	guardedStripe := w.guardedStripeForRecipient(recipient)
	var customer *stripe.Customer
	for attempt := 0; attempt < 5; attempt++ {
		customer, err = guardedStripe.EnsureCustomer(ctx, *user)
		if err != nil {
			return err
		}
		customerID := strings.TrimSpace(customer.ID)
		won, writeErr := model.SetUserStripeCustomerIfEmptyOrMatchesWithContext(ctx, user.Id, user.StripeCustomer, customerID)
		if writeErr != nil {
			return writeErr
		}
		if won || strings.TrimSpace(user.StripeCustomer) == customerID {
			break
		}
		user, err = model.GetUserByIdWithContext(ctx, recipient.UserId)
		if err != nil {
			return err
		}
		customer = nil
	}
	if customer == nil {
		return &RecallStripeError{Kind: RecallStripeErrorRetryable, Op: "resolve Stripe Customer winner", Err: errors.New("customer write contention")}
	}
	persisted, err := model.PersistRecallRecipientStripeCustomer(ctx, recipient.Id, customer.ID)
	if err != nil {
		return err
	}
	if !persisted {
		return &RecallStripeError{Kind: RecallStripeErrorRetryable, Op: "persist Stripe Customer", Err: errors.New("recipient customer conflict")}
	}
	if _, err := guardedStripe.syncCustomerEmail(ctx, *user, customer); err != nil {
		return err
	}
	won, err := model.AdvanceRecallRecipientLease(ctx, recipient.Id, w.owner, recipient.LeaseExpiresAt,
		[]string{model.RecallRecipientQueued}, model.RecallRecipientCustomerReady,
		map[string]any{"last_error_code": "", "last_error_message": ""})
	if err != nil {
		return err
	}
	if !won {
		return ErrRecallRecipientLeaseLost
	}
	return nil
}

func (w *RecallRecipientWorker) ensureRecipientPromotion(ctx context.Context, recipient *model.RecallRecipient) error {
	if recipient.PromotionCode == "" {
		code, err := w.stripe.GenerateRecipientPromotionCode()
		if err != nil {
			return err
		}
		won, err := model.PrepareRecallRecipientPromotion(ctx, recipient.Id, w.owner, recipient.LeaseExpiresAt, code)
		if err != nil {
			return err
		}
		if !won {
			return ErrRecallRecipientLeaseLost
		}
		refreshed, err := model.GetRecallRecipientForLeaseWithContext(ctx, recipient.Id, w.owner)
		if err != nil {
			return ErrRecallRecipientLeaseLost
		}
		recipient = refreshed
	}
	campaign, err := w.loadRunnableCampaign(ctx, recipient.CampaignId)
	if err != nil {
		return err
	}
	discount := RecallDiscountConfig{}
	if err := common.Unmarshal([]byte(campaign.DiscountConfig), &discount); err != nil {
		return recallStripePermanent("decode recall discount", "campaign %d discount is invalid", campaign.Id)
	}
	user := &model.User{}
	if recipient.UserId > 0 {
		user, err = model.GetUserByIdWithContext(ctx, recipient.UserId)
		if err != nil {
			return recallStripePermanent("load recall user", "user %d is unavailable", recipient.UserId)
		}
	}
	coupon := &stripe.Coupon{ID: strings.TrimSpace(campaign.StripeCouponId), RedeemBy: discount.CouponRedeemBy, Valid: true}
	guardedStripe := w.guardedStripe(recipient.CampaignId)
	promotion, err := guardedStripe.CreateRecipientPromotion(ctx, *campaign, *recipient, *user, coupon, discount)
	if err != nil {
		return err
	}
	if promotion == nil || strings.TrimSpace(promotion.ID) == "" || strings.TrimSpace(promotion.Code) == "" {
		return recallStripePermanent("persist Stripe Promotion Code", "Stripe returned an unavailable Promotion Code")
	}
	persisted, err := model.PersistRecallRecipientPromotion(ctx, recipient.Id, promotion.ID, promotion.Code)
	if err != nil {
		return err
	}
	if !persisted {
		refreshed, loadErr := model.GetRecallRecipientForLeaseWithContext(ctx, recipient.Id, w.owner)
		if loadErr != nil {
			return ErrRecallRecipientLeaseLost
		}
		if _, reconcileErr := guardedStripe.CreateRecipientPromotion(ctx, *campaign, *refreshed, *user, coupon, discount); reconcileErr != nil {
			return reconcileErr
		}
	}
	won, err := model.AdvanceRecallRecipientLease(ctx, recipient.Id, w.owner, recipient.LeaseExpiresAt,
		[]string{model.RecallRecipientCustomerReady}, model.RecallRecipientCodeReady,
		map[string]any{"last_error_code": "", "last_error_message": ""})
	if err != nil {
		return err
	}
	if !won {
		return ErrRecallRecipientLeaseLost
	}
	return nil
}

func (w *RecallRecipientWorker) scheduleStageOne(ctx context.Context, recipient *model.RecallRecipient) error {
	campaign, err := w.loadRunnableCampaign(ctx, recipient.CampaignId)
	if err != nil {
		return err
	}
	stages := make([]RecallEmailStage, 0)
	if err := common.Unmarshal([]byte(campaign.EmailSequenceConfig), &stages); err != nil {
		return recallStripePermanent("decode recall email sequence", "campaign %d email sequence is invalid", campaign.Id)
	}
	var stage *RecallEmailStage
	for i := range stages {
		if stages[i].StageNo == 1 {
			stage = &stages[i]
			break
		}
	}
	if stage == nil {
		return recallStripePermanent("schedule recall stage one", "campaign %d has no stage one", campaign.Id)
	}
	templateJSON, err := common.Marshal(stage.Templates)
	if err != nil {
		return err
	}
	scheduledAt := recipient.CreatedAt + stage.DelaySeconds
	if scheduledAt <= 0 {
		scheduledAt = w.now().Unix() + stage.DelaySeconds
	}
	won, err := model.ScheduleRecallStageOneAndAdvance(ctx, recipient.Id, w.owner, recipient.LeaseExpiresAt, model.RecallMessage{
		StageNo:          1,
		TemplateVersion:  stage.TemplateVersion,
		TemplateSnapshot: string(templateJSON),
		ScheduledAt:      scheduledAt,
		State:            model.RecallMessageScheduled,
	})
	if err != nil {
		return err
	}
	if !won {
		return ErrRecallRecipientLeaseLost
	}
	return nil
}

func (w *RecallRecipientWorker) guardedStripe(campaignID int64) *RecallStripeService {
	return w.stripe.withExternalCallGuard(func(ctx context.Context) error {
		_, err := w.loadRunnableCampaign(ctx, campaignID)
		return err
	})
}

func (w *RecallRecipientWorker) guardedStripeForRecipient(recipient *model.RecallRecipient) *RecallStripeService {
	return w.stripe.withExternalCallGuard(func(ctx context.Context) error {
		if _, err := w.loadRunnableCampaign(ctx, recipient.CampaignId); err != nil {
			return err
		}
		leased, err := model.GetRecallRecipientForLeaseWithContext(ctx, recipient.Id, w.owner)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRecallRecipientLeaseLost
			}
			return err
		}
		if leased.LeaseExpiresAt != recipient.LeaseExpiresAt {
			return ErrRecallRecipientLeaseLost
		}
		return nil
	})
}

func (w *RecallRecipientWorker) loadRunnableCampaign(ctx context.Context, campaignID int64) (*model.RecallCampaign, error) {
	if !operation_setting.IsRecallCampaignEnabled() {
		return nil, errRecallCampaignInactive
	}
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	switch campaign.Status {
	case model.RecallCampaignScheduled, model.RecallCampaignRunning, model.RecallCampaignCompleted:
		return campaign, nil
	default:
		return nil, errRecallCampaignInactive
	}
}

func (w *RecallRecipientWorker) finishRecipientError(ctx context.Context, recipient *model.RecallRecipient, err error) error {
	if errors.Is(err, ErrRecallRecipientLeaseLost) {
		return ErrRecallRecipientLeaseLost
	}
	if errors.Is(err, errRecallCampaignInactive) {
		return model.ReleaseRecallRecipientLease(recipient.Id, w.owner, recipient.LeaseExpiresAt)
	}
	kind := ClassifyRecallStripeError(err)
	if kind == RecallStripeErrorPermanent {
		won, updateErr := model.AdvanceRecallRecipientLease(ctx, recipient.Id, w.owner, recipient.LeaseExpiresAt,
			[]string{recipient.State}, model.RecallRecipientFailed,
			map[string]any{"last_error_code": "stripe_permanent", "last_error_message": ""})
		if updateErr != nil {
			return updateErr
		}
		if !won {
			return ErrRecallRecipientLeaseLost
		}
		w.logRecipientError(ctx, recipient, RecallStripeErrorPermanent)
		return nil
	}
	retryAt := w.now().Unix() + recallRecipientRetrySeconds
	won, updateErr := model.DeferRecallRecipientLease(ctx, recipient.Id, w.owner, recipient.LeaseExpiresAt, retryAt, "stripe_retryable")
	if updateErr != nil {
		return updateErr
	}
	if !won {
		return ErrRecallRecipientLeaseLost
	}
	w.logRecipientError(ctx, recipient, RecallStripeErrorRetryable)
	return nil
}

func (w *RecallRecipientWorker) logRecipientError(ctx context.Context, recipient *model.RecallRecipient, kind RecallStripeErrorKind) {
	logger.LogWarn(ctx, fmt.Sprintf(
		"recall recipient provisioning error: recipient_id=%d campaign_id=%d user_id=%d error_class=%s",
		recipient.Id,
		recipient.CampaignId,
		recipient.UserId,
		kind,
	))
}
