package model

import (
	"encoding/hex"
	"errors"
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	BillingAdjustmentPhaseSettle             = "settle"
	BillingAdjustmentPhaseRefund             = "refund"
	BillingAdjustmentPhasePreConsumeRollback = "preconsume_rollback"
	BillingAdjustmentPhaseReserveRollback    = "reserve_rollback"
	BillingAdjustmentPhaseExternalCredit     = "external_credit"
	BillingAdjustmentPhaseImageCompensation  = "image_compensation"
	BillingAdjustmentPhaseAdminOverride      = "admin_override"
	BillingAdjustmentPhaseDirect             = "direct"
	BillingAdjustmentPhaseTaskRefund         = "task_refund"
	BillingAdjustmentPhaseTaskRecalculate    = "task_recalculate"
	BillingAdjustmentPhasePostConsume        = "post_consume"
	BillingAdjustmentPhaseViolationFee       = "violation_fee"

	BillingAdjustmentLegWallet       = "wallet"
	BillingAdjustmentLegToken        = "token"
	BillingAdjustmentLegSubscription = "subscription"

	billingAdjustmentPending    = "pending"
	billingAdjustmentOwned      = "owned"
	billingAdjustmentProcessing = "processing"
	billingAdjustmentRetry      = "retry"
	billingAdjustmentDelivered  = "delivered"
	billingAdjustmentFailed     = "failed"

	billingAdjustmentLeaseSeconds = int64(30)
	billingAdjustmentRequestIDMax = 64
)

var ErrBillingAdjustmentBalanceBlocked = errors.New("billing adjustment is waiting for balance headroom")

// BillingAdjustmentOutbox durably records a post-dispatch quota adjustment.
// Delta is the signed balance change for wallet/token legs and the signed
// amount_used change for subscription legs.
type BillingAdjustmentOutbox struct {
	Id             int    `json:"id"`
	RequestID      string `json:"request_id" gorm:"type:varchar(64);uniqueIndex:idx_billing_adjustment_identity,priority:1"`
	Phase          string `json:"phase" gorm:"type:varchar(32);uniqueIndex:idx_billing_adjustment_identity,priority:2"`
	Leg            string `json:"leg" gorm:"type:varchar(32);uniqueIndex:idx_billing_adjustment_identity,priority:3"`
	UserID         int    `json:"user_id" gorm:"index"`
	TokenID        int    `json:"token_id" gorm:"index"`
	SubscriptionID int    `json:"subscription_id" gorm:"index"`
	Delta          int64  `json:"delta"`
	DBApplied      bool   `json:"db_applied"`
	CacheApplied   bool   `json:"cache_applied"`
	Status         string `json:"status" gorm:"type:varchar(20);index:idx_billing_adjustment_due,priority:1;index:idx_billing_adjustment_cleanup,priority:1"`
	Attempts       int    `json:"attempts"`
	NextAttemptAt  int64  `json:"next_attempt_at" gorm:"index:idx_billing_adjustment_due,priority:2"`
	LeaseToken     string `json:"lease_token" gorm:"type:varchar(64)"`
	LeaseUntil     int64  `json:"lease_until" gorm:"index"`
	LastError      string `json:"last_error" gorm:"type:text"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at" gorm:"index:idx_billing_adjustment_cleanup,priority:2"`
}

type BillingAdjustmentSpec struct {
	RequestID      string
	Phase          string
	Leg            string
	UserID         int
	TokenID        int
	SubscriptionID int
	Delta          int64
}

// NormalizeBillingAdjustmentRequestID keeps the compound unique index within
// the cross-database index budget. Provider request IDs, task IDs, and payment
// references can exceed the outbox key width, so oversized values use a stable
// SHA-256 identity while ordinary request IDs remain readable.
func NormalizeBillingAdjustmentRequestID(requestID string) string {
	if len(requestID) <= billingAdjustmentRequestIDMax {
		return requestID
	}
	return hex.EncodeToString(common.Sha256Raw([]byte(requestID)))
}

func validateBillingAdjustmentSpec(spec BillingAdjustmentSpec) error {
	if spec.RequestID == "" {
		return errors.New("billing adjustment request id is required")
	}
	switch spec.Phase {
	case BillingAdjustmentPhaseSettle, BillingAdjustmentPhaseRefund,
		BillingAdjustmentPhasePreConsumeRollback, BillingAdjustmentPhaseReserveRollback,
		BillingAdjustmentPhaseExternalCredit, BillingAdjustmentPhaseImageCompensation,
		BillingAdjustmentPhaseAdminOverride, BillingAdjustmentPhaseDirect,
		BillingAdjustmentPhaseTaskRefund, BillingAdjustmentPhaseTaskRecalculate,
		BillingAdjustmentPhasePostConsume, BillingAdjustmentPhaseViolationFee:
	default:
		return fmt.Errorf("unsupported billing adjustment phase: %s", spec.Phase)
	}
	if spec.Delta == 0 || spec.Delta < int64(common.MinQuota) || spec.Delta > int64(common.MaxQuota) {
		return fmt.Errorf("billing adjustment delta is out of range: %d", spec.Delta)
	}
	switch spec.Leg {
	case BillingAdjustmentLegWallet:
		if spec.UserID <= 0 || spec.TokenID != 0 || spec.SubscriptionID != 0 {
			return errors.New("wallet billing adjustment requires only user id")
		}
	case BillingAdjustmentLegToken:
		if spec.TokenID <= 0 || spec.SubscriptionID != 0 {
			return errors.New("token billing adjustment requires token id")
		}
	case BillingAdjustmentLegSubscription:
		if spec.SubscriptionID <= 0 || spec.TokenID != 0 {
			return errors.New("subscription billing adjustment requires subscription id")
		}
	default:
		return fmt.Errorf("unsupported billing adjustment leg: %s", spec.Leg)
	}
	return nil
}

// EnqueueBillingAdjustmentTx inserts an adjustment as part of a caller-owned
// business transaction. dbApplied is true only when that same transaction has
// already committed the durable quota mutation and needs cache reconciliation.
func EnqueueBillingAdjustmentTx(tx *gorm.DB, spec BillingAdjustmentSpec, dbApplied bool) (*BillingAdjustmentOutbox, error) {
	if tx == nil {
		return nil, errors.New("billing adjustment transaction is required")
	}
	spec.RequestID = NormalizeBillingAdjustmentRequestID(spec.RequestID)
	if err := validateBillingAdjustmentSpec(spec); err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	candidate := BillingAdjustmentOutbox{
		RequestID:      spec.RequestID,
		Phase:          spec.Phase,
		Leg:            spec.Leg,
		UserID:         spec.UserID,
		TokenID:        spec.TokenID,
		SubscriptionID: spec.SubscriptionID,
		Delta:          spec.Delta,
		DBApplied:      dbApplied,
		Status:         billingAdjustmentPending,
		NextAttemptAt:  now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&candidate).Error; err != nil {
		return nil, err
	}

	var stored BillingAdjustmentOutbox
	if err := tx.Where("request_id = ? AND phase = ? AND leg = ?", spec.RequestID, spec.Phase, spec.Leg).First(&stored).Error; err != nil {
		return nil, err
	}
	if stored.UserID != spec.UserID || stored.TokenID != spec.TokenID ||
		stored.SubscriptionID != spec.SubscriptionID || stored.Delta != spec.Delta ||
		(dbApplied && !stored.DBApplied) {
		return nil, fmt.Errorf("billing adjustment idempotency conflict for request %s phase %s leg %s", spec.RequestID, spec.Phase, spec.Leg)
	}
	return &stored, nil
}

// EnqueueBillingAdjustments inserts all required legs in one transaction.
// Reusing the same request/phase/leg is idempotent only when the target and
// signed delta are identical.
func EnqueueBillingAdjustments(specs []BillingAdjustmentSpec) ([]BillingAdjustmentOutbox, error) {
	if len(specs) == 0 {
		return nil, nil
	}
	for _, spec := range specs {
		if err := validateBillingAdjustmentSpec(spec); err != nil {
			return nil, err
		}
	}

	rows := make([]BillingAdjustmentOutbox, 0, len(specs))
	err := DB.Transaction(func(tx *gorm.DB) error {
		for _, spec := range specs {
			stored, err := EnqueueBillingAdjustmentTx(tx, spec, false)
			if err != nil {
				return err
			}
			rows = append(rows, *stored)
		}
		return nil
	})
	return rows, err
}

func enqueueOwnedImmediateBillingAdjustment(spec BillingAdjustmentSpec) (*BillingAdjustmentOutbox, error) {
	spec.RequestID = NormalizeBillingAdjustmentRequestID(spec.RequestID)
	if err := validateBillingAdjustmentSpec(spec); err != nil {
		return nil, err
	}

	ownerToken := common.GetUUID()
	now := common.GetTimestamp()
	candidate := BillingAdjustmentOutbox{
		RequestID:      spec.RequestID,
		Phase:          spec.Phase,
		Leg:            spec.Leg,
		UserID:         spec.UserID,
		TokenID:        spec.TokenID,
		SubscriptionID: spec.SubscriptionID,
		Delta:          spec.Delta,
		Status:         billingAdjustmentOwned,
		LeaseToken:     ownerToken,
		LeaseUntil:     now + billingAdjustmentLeaseSeconds,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	var stored BillingAdjustmentOutbox
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&candidate).Error; err != nil {
			return err
		}
		if err := tx.Where("request_id = ? AND phase = ? AND leg = ?", spec.RequestID, spec.Phase, spec.Leg).First(&stored).Error; err != nil {
			return err
		}
		if stored.UserID != spec.UserID || stored.TokenID != spec.TokenID ||
			stored.SubscriptionID != spec.SubscriptionID || stored.Delta != spec.Delta {
			return fmt.Errorf("billing adjustment idempotency conflict for request %s phase %s leg %s", spec.RequestID, spec.Phase, spec.Leg)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if stored.DBApplied || stored.Status == billingAdjustmentDelivered {
		return &stored, nil
	}
	if stored.Status != billingAdjustmentOwned || stored.LeaseToken != ownerToken {
		return nil, fmt.Errorf("billing adjustment request %s is already owned or finished with status %s", spec.RequestID, stored.Status)
	}
	return &stored, nil
}

func cancelOwnedUnappliedBillingAdjustment(row *BillingAdjustmentOutbox, cause error) error {
	if row == nil || row.Id == 0 || row.LeaseToken == "" {
		return errors.New("owned billing adjustment is required")
	}
	message := "billing adjustment canceled before DB apply"
	if cause != nil {
		message = cause.Error()
	}
	now := common.GetTimestamp()
	result := DB.Model(&BillingAdjustmentOutbox{}).
		Where("id = ? AND status = ? AND lease_token = ? AND db_applied = ?", row.Id, billingAdjustmentOwned, row.LeaseToken, false).
		Updates(map[string]interface{}{
			"status":          billingAdjustmentFailed,
			"lease_token":     "",
			"lease_until":     0,
			"next_attempt_at": 0,
			"last_error":      message,
			"updated_at":      now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ApplyImmediateBillingAdjustment gives pre-dispatch debits fail-closed
// semantics while retaining a durable, replay-safe cache phase. Positive
// credits are accepted once escrowed in the outbox even when the hard balance
// ceiling or a temporary dependency prevents immediate delivery.
func ApplyImmediateBillingAdjustment(spec BillingAdjustmentSpec) error {
	failClosedDebit := (spec.Leg == BillingAdjustmentLegWallet || spec.Leg == BillingAdjustmentLegToken) && spec.Delta < 0
	if spec.Leg == BillingAdjustmentLegSubscription && spec.Delta > 0 {
		failClosedDebit = true
	}
	if !failClosedDebit {
		rows, err := EnqueueBillingAdjustments([]BillingAdjustmentSpec{spec})
		if err != nil {
			return err
		}
		if len(rows) != 1 {
			return errors.New("billing adjustment enqueue returned no row")
		}
		// A credit/refund is acknowledged once its durable claim exists. The
		// drainer will keep retrying balance-headroom and dependency failures.
		_ = ProcessBillingAdjustmentOutbox(rows[0].Id)
		return nil
	}

	row, err := enqueueOwnedImmediateBillingAdjustment(spec)
	if err != nil {
		return err
	}
	if row.DBApplied || row.Status == billingAdjustmentDelivered {
		return nil
	}
	processErr := processOwnedImmediateBillingAdjustment(row)
	if row.DBApplied {
		return nil
	}
	if cancelErr := cancelOwnedUnappliedBillingAdjustment(row, processErr); cancelErr != nil {
		var stored BillingAdjustmentOutbox
		if loadErr := DB.First(&stored, row.Id).Error; loadErr == nil && stored.DBApplied {
			return nil
		}
		return fmt.Errorf("billing adjustment failed: %v; cancel owned row: %w", processErr, cancelErr)
	}
	if processErr != nil {
		return processErr
	}
	return errors.New("billing adjustment was not applied")
}

func claimBillingAdjustmentOutbox(id int, now int64) (*BillingAdjustmentOutbox, bool, error) {
	var row BillingAdjustmentOutbox
	if err := DB.First(&row, id).Error; err != nil {
		return nil, false, err
	}
	if row.Status == billingAdjustmentDelivered || row.Status == billingAdjustmentFailed {
		return &row, false, nil
	}
	leaseToken := common.GetUUID()
	leaseUntil := now + billingAdjustmentLeaseSeconds
	result := DB.Model(&BillingAdjustmentOutbox{}).
		Where("id = ? AND ((status IN ? AND next_attempt_at <= ?) OR (status = ? AND lease_until < ?))",
			id,
			[]string{billingAdjustmentPending, billingAdjustmentRetry},
			now,
			billingAdjustmentProcessing,
			now,
		).
		Updates(map[string]interface{}{
			"status":      billingAdjustmentProcessing,
			"lease_token": leaseToken,
			"lease_until": leaseUntil,
			"updated_at":  now,
		})
	if result.Error != nil {
		return nil, false, result.Error
	}
	if result.RowsAffected != 1 {
		return &row, false, nil
	}
	row.Status = billingAdjustmentProcessing
	row.LeaseToken = leaseToken
	row.LeaseUntil = leaseUntil
	row.UpdatedAt = now
	return &row, true, nil
}

func billingAdjustmentRetryDelay(attempts int) int64 {
	if attempts < 1 {
		attempts = 1
	}
	delay := int64(1 << min(attempts-1, 10))
	if delay > 300 {
		return 300
	}
	return delay
}

func markBillingAdjustmentRetry(row *BillingAdjustmentOutbox, processErr error) error {
	if row == nil || row.Id == 0 || row.LeaseToken == "" {
		return errors.New("claimed billing adjustment is required")
	}
	attempts := row.Attempts + 1
	nextAttemptAt := common.GetTimestamp() + billingAdjustmentRetryDelay(attempts)
	if errors.Is(processErr, ErrBillingAdjustmentBalanceBlocked) {
		// A refund/credit above the hard quota ceiling or a post-settlement
		// supplement without current funds is an escrowed balance claim, not a
		// lossy terminal failure. Keep it durable until later usage/top-up creates
		// room. Cache-pending and not-yet-applied financial claims also remain
		// durable: abandoning either side would lose money or strand a pinned
		// reconciliation ledger.
		attempts = row.Attempts
		nextAttemptAt = common.GetTimestamp() + 300
	}
	now := common.GetTimestamp()
	result := DB.Model(&BillingAdjustmentOutbox{}).
		Where("id = ? AND status = ? AND lease_token = ?", row.Id, billingAdjustmentProcessing, row.LeaseToken).
		Updates(map[string]interface{}{
			"status":          billingAdjustmentRetry,
			"attempts":        attempts,
			"next_attempt_at": nextAttemptAt,
			"lease_token":     "",
			"lease_until":     0,
			"last_error":      processErr.Error(),
			"updated_at":      now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func pendingImageWalletReservationQuota(tx *gorm.DB, userID int) (int64, error) {
	var reserved int64
	err := outstandingImageReservationQuery(tx).
		Where("reservations.user_id = ?", userID).
		Select("COALESCE(SUM(reservations.wallet_reserved), 0)").
		Scan(&reserved).Error
	return reserved, err
}

func pendingImageTokenReservationQuota(tx *gorm.DB, tokenID int) (int64, error) {
	var reserved int64
	err := outstandingImageReservationQuery(tx).
		Where("reservations.token_id = ?", tokenID).
		Select("COALESCE(SUM(reservations.token_reserved), 0)").
		Scan(&reserved).Error
	return reserved, err
}

func outstandingImageReservationQuery(tx *gorm.DB) *gorm.DB {
	return tx.Table("image_billing_reservations AS reservations").
		Joins(
			"LEFT JOIN tasks AS reservation_tasks ON reservation_tasks.task_id = reservations.task_id AND reservation_tasks.platform = ?",
			constant.TaskPlatformOpenAIImage,
		).
		Where(
			"reservations.status = ? OR (reservations.status = ? AND (reservation_tasks.id IS NULL OR reservation_tasks.status NOT IN ?))",
			ImageBillingReservationPreparing,
			ImageBillingReservationActive,
			[]TaskStatus{TaskStatusSuccess, TaskStatusFailure},
		)
}

// billingAdjustmentNextQuotaAllowed keeps new credits inside the quota
// ceiling, while allowing a debit to drain legacy balances that were written
// above the current int32 ceiling before quota saturation was enforced.
// Refusing those debits would leave every post-consume settlement escrowed
// forever even though subtracting a bounded charge is safe.
func billingAdjustmentNextQuotaAllowed(currentQuota, nextQuota, delta int64) bool {
	if nextQuota < int64(common.MinQuota) {
		return false
	}
	if nextQuota <= int64(common.MaxQuota) {
		return true
	}
	return currentQuota > int64(common.MaxQuota) &&
		currentQuota <= int64(common.MaxLegacyQuota) &&
		nextQuota <= int64(common.MaxLegacyQuota) &&
		delta < 0 && nextQuota < currentQuota
}

func checkedQuotaAdd(current, delta int64) (int64, bool) {
	if delta > 0 && current > math.MaxInt64-delta {
		return 0, false
	}
	if delta < 0 && current < math.MinInt64-delta {
		return 0, false
	}
	return current + delta, true
}

func checkedQuotaSubtract(current, delta int64) (int64, bool) {
	if delta > 0 && current < math.MinInt64+delta {
		return 0, false
	}
	if delta < 0 && current > math.MaxInt64+delta {
		return 0, false
	}
	return current - delta, true
}

func quotaValueFitsInt(value int64) bool {
	return int64(int(value)) == value
}

func applyBillingAdjustmentDatabaseClaim(row *BillingAdjustmentOutbox, expectedStatus string, releaseOwner bool) error {
	if row == nil || row.Id == 0 || row.LeaseToken == "" {
		return errors.New("claimed billing adjustment is required")
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var stored BillingAdjustmentOutbox
		if err := lockForUpdate(tx).Where("id = ?", row.Id).First(&stored).Error; err != nil {
			return err
		}
		if stored.Status != expectedStatus || stored.LeaseToken != row.LeaseToken {
			return fmt.Errorf("billing adjustment claim lost for id %d", row.Id)
		}
		if stored.DBApplied {
			return nil
		}
		if stored.Delta == 0 || stored.Delta < int64(common.MinQuota) || stored.Delta > int64(common.MaxQuota) {
			return fmt.Errorf("billing adjustment delta is out of range: %d", stored.Delta)
		}

		switch stored.Leg {
		case BillingAdjustmentLegWallet:
			var user User
			if err := lockForUpdate(tx.Unscoped()).Select("id", "quota").Where("id = ?", stored.UserID).First(&user).Error; err != nil {
				return err
			}
			nextQuota, ok := checkedQuotaAdd(int64(user.Quota), stored.Delta)
			if !ok || !quotaValueFitsInt(nextQuota) ||
				!billingAdjustmentNextQuotaAllowed(int64(user.Quota), nextQuota, stored.Delta) {
				return fmt.Errorf("%w: wallet current=%d delta=%d", ErrBillingAdjustmentBalanceBlocked, user.Quota, stored.Delta)
			}
			if stored.Delta > 0 {
				reserved, err := pendingImageWalletReservationQuota(tx, stored.UserID)
				if err != nil {
					return err
				}
				if reserved < 0 || reserved > int64(common.MaxQuota) || nextQuota > int64(common.MaxQuota)-reserved {
					return fmt.Errorf("%w: wallet current=%d delta=%d image_reserved=%d", ErrBillingAdjustmentBalanceBlocked, user.Quota, stored.Delta, reserved)
				}
			}
			if stored.Delta < 0 && nextQuota < 0 {
				return fmt.Errorf("%w: user quota is not enough", ErrBillingAdjustmentBalanceBlocked)
			}
			result := tx.Unscoped().Model(&User{}).Where("id = ?", stored.UserID).Update("quota", int(nextQuota))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return gorm.ErrRecordNotFound
			}

		case BillingAdjustmentLegToken:
			var token Token
			if err := lockForUpdate(tx.Unscoped()).Where("id = ?", stored.TokenID).First(&token).Error; err != nil {
				return err
			}
			nextRemain, remainOK := checkedQuotaAdd(int64(token.RemainQuota), stored.Delta)
			nextUsed, usedOK := checkedQuotaSubtract(int64(token.UsedQuota), stored.Delta)
			usedDeltaOK := stored.Delta != math.MinInt64
			usedDelta := int64(0)
			if usedDeltaOK {
				usedDelta = -stored.Delta
			}
			if !remainOK || !usedOK || !quotaValueFitsInt(nextRemain) || !quotaValueFitsInt(nextUsed) ||
				!usedDeltaOK ||
				!billingAdjustmentNextQuotaAllowed(int64(token.RemainQuota), nextRemain, stored.Delta) ||
				nextUsed < 0 || !billingAdjustmentNextQuotaAllowed(int64(token.UsedQuota), nextUsed, usedDelta) {
				return fmt.Errorf("%w: token remain=%d used=%d delta=%d", ErrBillingAdjustmentBalanceBlocked, token.RemainQuota, token.UsedQuota, stored.Delta)
			}
			if stored.Delta > 0 {
				reserved, err := pendingImageTokenReservationQuota(tx, stored.TokenID)
				if err != nil {
					return err
				}
				if reserved < 0 || reserved > int64(common.MaxQuota) ||
					nextRemain > int64(common.MaxQuota)-reserved || nextUsed < reserved {
					return fmt.Errorf("%w: token remain=%d used=%d delta=%d image_reserved=%d", ErrBillingAdjustmentBalanceBlocked, token.RemainQuota, token.UsedQuota, stored.Delta, reserved)
				}
			}
			if stored.Delta < 0 && !token.UnlimitedQuota && nextRemain < 0 {
				return fmt.Errorf("%w: token quota is not enough", ErrBillingAdjustmentBalanceBlocked)
			}
			result := tx.Unscoped().Model(&Token{}).Where("id = ?", stored.TokenID).Updates(map[string]interface{}{
				"remain_quota":  int(nextRemain),
				"used_quota":    int(nextUsed),
				"accessed_time": common.GetTimestamp(),
			})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return gorm.ErrRecordNotFound
			}

		case BillingAdjustmentLegSubscription:
			if err := postConsumeUserSubscriptionDeltaTx(tx, stored.SubscriptionID, stored.Delta); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported billing adjustment leg: %s", stored.Leg)
		}

		now := common.GetTimestamp()
		updates := map[string]interface{}{
			"db_applied": true,
			"updated_at": now,
		}
		if releaseOwner {
			updates["status"] = billingAdjustmentProcessing
		}
		result := tx.Model(&BillingAdjustmentOutbox{}).
			Where("id = ? AND db_applied = ? AND status = ? AND lease_token = ?", stored.Id, false, expectedStatus, row.LeaseToken).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
	if err != nil {
		return err
	}
	row.DBApplied = true
	if releaseOwner {
		row.Status = billingAdjustmentProcessing
	}
	return nil
}

func applyBillingAdjustmentDatabase(row *BillingAdjustmentOutbox) error {
	return applyBillingAdjustmentDatabaseClaim(row, billingAdjustmentProcessing, false)
}

func applyOwnedBillingAdjustmentDatabase(row *BillingAdjustmentOutbox) error {
	return applyBillingAdjustmentDatabaseClaim(row, billingAdjustmentOwned, true)
}

func billingAdjustmentCacheOperationKey(row *BillingAdjustmentOutbox) string {
	identity := fmt.Sprintf("%d:%d:%s:%s:%s", row.Id, row.CreatedAt, row.RequestID, row.Phase, row.Leg)
	return "billing:quota-cache-operation:" + hex.EncodeToString(common.Sha256Raw([]byte(identity)))
}

func billingAdjustmentUsesLegacyDebitCachePolicy(row *BillingAdjustmentOutbox) (bool, error) {
	if row == nil || row.Delta >= 0 {
		return false, nil
	}
	switch row.Leg {
	case BillingAdjustmentLegWallet:
		var user User
		if err := DB.Unscoped().Select("quota").Where("id = ?", row.UserID).First(&user).Error; err != nil {
			return false, err
		}
		return int64(user.Quota) > int64(common.MaxQuota), nil
	case BillingAdjustmentLegToken:
		var token Token
		if err := DB.Unscoped().Select("remain_quota").Where("id = ?", row.TokenID).First(&token).Error; err != nil {
			return false, err
		}
		return int64(token.RemainQuota) > int64(common.MaxQuota), nil
	default:
		return false, nil
	}
}

func applyBillingAdjustmentCache(row *BillingAdjustmentOutbox, tokenKey string) error {
	if row.CacheApplied {
		return nil
	}
	if !common.RedisEnabled || row.Leg == BillingAdjustmentLegSubscription {
		return nil
	}
	operationKey := billingAdjustmentCacheOperationKey(row)
	allowLegacyDebit, err := billingAdjustmentUsesLegacyDebitCachePolicy(row)
	if err != nil {
		return err
	}
	switch row.Leg {
	case BillingAdjustmentLegWallet:
		return applyUserQuotaCacheDeltaOnceWithLegacyPolicy(row.UserID, row.Delta, operationKey, allowLegacyDebit)
	case BillingAdjustmentLegToken:
		return applyTokenQuotaCacheDeltaOnceWithLegacyPolicy(tokenKey, row.Delta, operationKey, allowLegacyDebit)
	default:
		return fmt.Errorf("unsupported billing adjustment cache leg: %s", row.Leg)
	}
}

func clearBillingAdjustmentCacheOperationMarker(row *BillingAdjustmentOutbox) {
	if row == nil || !common.RedisEnabled || row.Leg == BillingAdjustmentLegSubscription {
		return
	}
	if err := common.RedisDelKey(billingAdjustmentCacheOperationKey(row)); err != nil {
		common.SysLog(fmt.Sprintf("billing adjustment operation marker cleanup queued: id=%d err=%v", row.Id, err))
	}
}

func markBillingAdjustmentDelivered(row *BillingAdjustmentOutbox) error {
	now := common.GetTimestamp()
	result := DB.Model(&BillingAdjustmentOutbox{}).
		Where("id = ? AND status = ? AND lease_token = ? AND db_applied = ?", row.Id, billingAdjustmentProcessing, row.LeaseToken, true).
		Updates(map[string]interface{}{
			"cache_applied":   true,
			"status":          billingAdjustmentDelivered,
			"lease_token":     "",
			"lease_until":     0,
			"last_error":      "",
			"next_attempt_at": 0,
			"updated_at":      now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return gorm.ErrRecordNotFound
	}
	row.CacheApplied = true
	row.Status = billingAdjustmentDelivered
	clearBillingAdjustmentCacheOperationMarker(row)
	return nil
}

func markBillingAdjustmentCacheReconciled(row *BillingAdjustmentOutbox) error {
	now := common.GetTimestamp()
	result := DB.Model(&BillingAdjustmentOutbox{}).
		Where("id = ? AND db_applied = ? AND cache_applied = ? AND status <> ?", row.Id, true, false, billingAdjustmentFailed).
		Updates(map[string]interface{}{
			"cache_applied":   true,
			"status":          billingAdjustmentDelivered,
			"lease_token":     "",
			"lease_until":     0,
			"last_error":      "",
			"next_attempt_at": 0,
			"updated_at":      now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		var stored BillingAdjustmentOutbox
		if err := DB.First(&stored, row.Id).Error; err != nil {
			return err
		}
		if stored.CacheApplied && stored.Status == billingAdjustmentDelivered {
			row.CacheApplied = true
			row.Status = billingAdjustmentDelivered
			clearBillingAdjustmentCacheOperationMarker(row)
			return nil
		}
		return gorm.ErrRecordNotFound
	}
	row.CacheApplied = true
	row.Status = billingAdjustmentDelivered
	clearBillingAdjustmentCacheOperationMarker(row)
	return nil
}

func reconcileBillingAdjustmentCacheRowsLocked(leg string, identityColumn string, identityValue interface{}, tokenKey string) error {
	var rows []BillingAdjustmentOutbox
	if err := DB.Where(
		"leg = ? AND "+identityColumn+" = ? AND db_applied = ? AND cache_applied = ? AND status <> ?",
		leg,
		identityValue,
		true,
		false,
		billingAdjustmentFailed,
	).Order("id ASC").Find(&rows).Error; err != nil {
		return err
	}
	for i := range rows {
		if err := applyBillingAdjustmentCache(&rows[i], tokenKey); err != nil {
			return fmt.Errorf("reconcile billing adjustment cache id %d: %w", rows[i].Id, err)
		}
		if err := markBillingAdjustmentCacheReconciled(&rows[i]); err != nil {
			return fmt.Errorf("mark billing adjustment cache reconciled id %d: %w", rows[i].Id, err)
		}
	}
	return nil
}

func reconcileUserBillingAdjustmentCacheLocked(userId int) error {
	return reconcileBillingAdjustmentCacheRowsLocked(BillingAdjustmentLegWallet, "user_id", userId, "")
}

func reconcileTokenBillingAdjustmentCacheLocked(tokenId int, tokenKey string) error {
	return reconcileBillingAdjustmentCacheRowsLocked(BillingAdjustmentLegToken, "token_id", tokenId, tokenKey)
}

func processOwnedImmediateBillingAdjustment(row *BillingAdjustmentOutbox) error {
	if row == nil || row.Status != billingAdjustmentOwned || row.LeaseToken == "" {
		return errors.New("owned billing adjustment is required")
	}
	process := func(tokenKey string) error {
		if err := applyOwnedBillingAdjustmentDatabase(row); err != nil {
			return err
		}
		if err := applyBillingAdjustmentCache(row, tokenKey); err != nil {
			return err
		}
		return markBillingAdjustmentDelivered(row)
	}

	var err error
	switch row.Leg {
	case BillingAdjustmentLegWallet:
		err = withUserQuotaCacheLock(row.UserID, func() error { return process("") })
	case BillingAdjustmentLegToken:
		var token Token
		if loadErr := DB.Unscoped().Where("id = ?", row.TokenID).First(&token).Error; loadErr != nil {
			return loadErr
		}
		err = withTokenQuotaCacheLock(token.Key, func() error { return process(token.Key) })
	case BillingAdjustmentLegSubscription:
		err = process("")
	default:
		return fmt.Errorf("unsupported billing adjustment leg: %s", row.Leg)
	}
	if err == nil || !row.DBApplied {
		return err
	}
	if markErr := markBillingAdjustmentRetry(row, err); markErr != nil {
		return fmt.Errorf("process owned billing adjustment: %v; persist retry: %w", err, markErr)
	}
	return err
}

func processClaimedBillingAdjustment(row *BillingAdjustmentOutbox) error {
	if row == nil {
		return errors.New("billing adjustment is required")
	}
	process := func(tokenKey string) error {
		if err := applyBillingAdjustmentDatabase(row); err != nil {
			return err
		}
		if err := applyBillingAdjustmentCache(row, tokenKey); err != nil {
			return err
		}
		return markBillingAdjustmentDelivered(row)
	}

	switch row.Leg {
	case BillingAdjustmentLegWallet:
		return withUserQuotaCacheLock(row.UserID, func() error { return process("") })
	case BillingAdjustmentLegToken:
		var token Token
		if err := DB.Unscoped().Where("id = ?", row.TokenID).First(&token).Error; err != nil {
			return err
		}
		return withTokenQuotaCacheLock(token.Key, func() error { return process(token.Key) })
	case BillingAdjustmentLegSubscription:
		return process("")
	default:
		return fmt.Errorf("unsupported billing adjustment leg: %s", row.Leg)
	}
}

// ProcessBillingAdjustmentOutbox attempts one durable adjustment. A failure is
// persisted with backoff so another node or the master drainer can retry it.
func ProcessBillingAdjustmentOutbox(id int) error {
	row, claimed, err := claimBillingAdjustmentOutbox(id, common.GetTimestamp())
	if err != nil || !claimed {
		return err
	}
	if err := processClaimedBillingAdjustment(row); err != nil {
		if markErr := markBillingAdjustmentRetry(row, err); markErr != nil {
			return fmt.Errorf("process billing adjustment: %v; persist retry: %w", err, markErr)
		}
		return err
	}
	return nil
}

func HasDueBillingAdjustmentOutbox(now int64) bool {
	var count int64
	err := DB.Model(&BillingAdjustmentOutbox{}).
		Where("status IN ? AND next_attempt_at <= ?", []string{billingAdjustmentPending, billingAdjustmentRetry}, now).
		Or("status = ? AND lease_until < ?", billingAdjustmentProcessing, now).
		Limit(1).
		Count(&count).Error
	return err == nil && count > 0
}

// CleanupTerminalBillingAdjustmentOutbox removes old terminal rows in bounded
// batches. Active states are never eligible because they may still own or
// retry a durable balance mutation.
func CleanupTerminalBillingAdjustmentOutbox(shortRetentionCutoff int64, longRetentionCutoff int64, limit int) (int64, error) {
	if shortRetentionCutoff <= 0 || longRetentionCutoff <= 0 || shortRetentionCutoff < longRetentionCutoff {
		return 0, errors.New("billing adjustment cleanup cutoffs are invalid")
	}
	if limit <= 0 {
		limit = 500
	}
	shortRetentionPhases := []string{
		BillingAdjustmentPhaseDirect,
		BillingAdjustmentPhaseSettle,
		BillingAdjustmentPhaseRefund,
		BillingAdjustmentPhasePreConsumeRollback,
		BillingAdjustmentPhaseReserveRollback,
		BillingAdjustmentPhasePostConsume,
		BillingAdjustmentPhaseViolationFee,
	}

	var ids []int
	if err := DB.Model(&BillingAdjustmentOutbox{}).
		Where("status IN ? AND updated_at > 0", []string{billingAdjustmentDelivered, billingAdjustmentFailed}).
		Where("(phase IN ? AND updated_at < ?) OR (phase NOT IN ? AND updated_at < ?)", shortRetentionPhases, shortRetentionCutoff, shortRetentionPhases, longRetentionCutoff).
		Order("id ASC").
		Limit(limit).
		Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	if len(ids) == 0 {
		return 0, nil
	}

	result := DB.Where("id IN ? AND status IN ? AND updated_at > 0", ids, []string{billingAdjustmentDelivered, billingAdjustmentFailed}).
		Where("(phase IN ? AND updated_at < ?) OR (phase NOT IN ? AND updated_at < ?)", shortRetentionPhases, shortRetentionCutoff, shortRetentionPhases, longRetentionCutoff).
		Delete(&BillingAdjustmentOutbox{})
	return result.RowsAffected, result.Error
}

func DrainDueBillingAdjustmentOutbox(limit int) (processed int, failed int, firstErr error) {
	if limit <= 0 {
		limit = 100
	}
	now := common.GetTimestamp()
	var rows []BillingAdjustmentOutbox
	if err := DB.Where("(status IN ? AND next_attempt_at <= ?) OR (status = ? AND lease_until < ?)",
		[]string{billingAdjustmentPending, billingAdjustmentRetry}, now,
		billingAdjustmentProcessing, now,
	).Order("id ASC").Limit(limit).Find(&rows).Error; err != nil {
		return 0, 0, err
	}
	for i := range rows {
		if err := ProcessBillingAdjustmentOutbox(rows[i].Id); err != nil {
			failed++
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		processed++
	}
	return processed, failed, firstErr
}
