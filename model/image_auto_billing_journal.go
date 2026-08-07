package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	ImageAutoBillingFundingWallet       = "wallet"
	ImageAutoBillingFundingSubscription = "subscription"

	ImageAutoBillingStatusReserved          = "reserved"
	ImageAutoBillingStatusSettlementPending = "settlement_pending"
	ImageAutoBillingStatusSettlementReview  = "settlement_manual_review"
	ImageAutoBillingStatusSettled           = "settled"
	ImageAutoBillingStatusRefundPending     = "refund_pending"
	ImageAutoBillingStatusRefunded          = "refunded"
)

var (
	ErrImageAutoBillingInsufficientWallet = errors.New("image-auto wallet quota insufficient")
	ErrImageAutoBillingInsufficientToken  = errors.New("image-auto token quota insufficient")
	ErrImageAutoBillingConflict           = errors.New("image-auto billing request conflicts with existing journal")
	ErrImageAutoBillingTerminalConflict   = errors.New("image-auto billing journal is already terminal")
)

// ImageAutoBillingJournal is the durable accounting state for one image-auto
// request. It intentionally stores only account identifiers and quota state.
type ImageAutoBillingJournal struct {
	Id                 int    `json:"id"`
	RequestId          string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId             int    `json:"user_id" gorm:"index;not null"`
	TokenId            int    `json:"token_id" gorm:"index;not null"`
	UserSubscriptionId int    `json:"user_subscription_id" gorm:"index"`
	FundingSource      string `json:"funding_source" gorm:"type:varchar(32);not null"`
	ReservedQuota      int    `json:"reserved_quota" gorm:"type:int;not null"`
	ActualQuota        int    `json:"actual_quota" gorm:"type:int;not null"`
	Status             string `json:"status" gorm:"type:varchar(32);index;not null"`
	RetryCount         int    `json:"retry_count" gorm:"type:int;not null"`
	LastError          string `json:"last_error" gorm:"type:text"`
	LastAttemptAt      int64  `json:"last_attempt_at" gorm:"type:bigint;index"`
	ReservedAt         int64  `json:"reserved_at" gorm:"type:bigint;index"`
	SettledAt          int64  `json:"settled_at" gorm:"type:bigint"`
	RefundedAt         int64  `json:"refunded_at" gorm:"type:bigint"`
	CreatedAt          int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt          int64  `json:"updated_at" gorm:"type:bigint;index"`

	SubscriptionAmountTotal     int64 `json:"-" gorm:"-"`
	SubscriptionAmountUsedAfter int64 `json:"-" gorm:"-"`
}

func (j *ImageAutoBillingJournal) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if j.ReservedAt == 0 {
		j.ReservedAt = now
	}
	j.CreatedAt = now
	j.UpdatedAt = now
	return nil
}

func (j *ImageAutoBillingJournal) BeforeUpdate(_ *gorm.DB) error {
	j.UpdatedAt = common.GetTimestamp()
	return nil
}

type ImageAutoBillingReserveParams struct {
	RequestId     string
	UserId        int
	TokenId       int
	ReservedQuota int
	FundingSource string
}

func ReserveImageAutoBilling(params ImageAutoBillingReserveParams) (*ImageAutoBillingJournal, error) {
	params.RequestId = strings.TrimSpace(params.RequestId)
	if params.RequestId == "" || len(params.RequestId) > 64 {
		return nil, errors.New("invalid image-auto billing request id")
	}
	if params.UserId <= 0 || params.TokenId < 0 || params.ReservedQuota <= 0 {
		return nil, errors.New("invalid image-auto billing reserve parameters")
	}
	if params.FundingSource != ImageAutoBillingFundingWallet && params.FundingSource != ImageAutoBillingFundingSubscription {
		return nil, fmt.Errorf("unsupported image-auto funding source: %s", params.FundingSource)
	}

	var journal ImageAutoBillingJournal
	err := DB.Transaction(func(tx *gorm.DB) error {
		var existing ImageAutoBillingJournal
		query := lockForUpdate(tx).Where("request_id = ?", params.RequestId).Limit(1).Find(&existing)
		if query.Error != nil {
			return query.Error
		}
		if query.RowsAffected > 0 {
			if existing.UserId != params.UserId || existing.TokenId != params.TokenId ||
				existing.ReservedQuota != params.ReservedQuota || existing.FundingSource != params.FundingSource {
				return ErrImageAutoBillingConflict
			}
			journal = existing
			return nil
		}

		if params.TokenId > 0 {
			var token Token
			if err := lockForUpdate(tx).Where("id = ? AND user_id = ?", params.TokenId, params.UserId).First(&token).Error; err != nil {
				return err
			}
			if !token.UnlimitedQuota && token.RemainQuota < params.ReservedQuota {
				return ErrImageAutoBillingInsufficientToken
			}
		}

		switch params.FundingSource {
		case ImageAutoBillingFundingWallet:
			var user User
			if err := lockForUpdate(tx).Where("id = ?", params.UserId).First(&user).Error; err != nil {
				return err
			}
			if user.Quota < params.ReservedQuota {
				return ErrImageAutoBillingInsufficientWallet
			}
			if err := tx.Model(&User{}).Where("id = ?", params.UserId).
				Update("quota", gorm.Expr("quota - ?", params.ReservedQuota)).Error; err != nil {
				return err
			}
		case ImageAutoBillingFundingSubscription:
			result, err := PreConsumeUserSubscriptionTx(tx, params.RequestId, params.UserId, "image-auto", 0, int64(params.ReservedQuota))
			if err != nil {
				return err
			}
			journal.UserSubscriptionId = result.UserSubscriptionId
			journal.SubscriptionAmountTotal = result.AmountTotal
			journal.SubscriptionAmountUsedAfter = result.AmountUsedAfter
		}
		if params.TokenId > 0 {
			if err := tx.Model(&Token{}).Where("id = ?", params.TokenId).Updates(map[string]interface{}{
				"remain_quota":  gorm.Expr("remain_quota - ?", params.ReservedQuota),
				"used_quota":    gorm.Expr("used_quota + ?", params.ReservedQuota),
				"accessed_time": common.GetTimestamp(),
			}).Error; err != nil {
				return err
			}
		}

		journal.RequestId = params.RequestId
		journal.UserId = params.UserId
		journal.TokenId = params.TokenId
		journal.FundingSource = params.FundingSource
		journal.ReservedQuota = params.ReservedQuota
		journal.Status = ImageAutoBillingStatusReserved
		return tx.Create(&journal).Error
	})
	if err != nil {
		return nil, err
	}
	if err := RefreshImageAutoBillingQuotaCaches(journal.UserId, journal.TokenId); err != nil {
		common.SysLog("failed to refresh image-auto billing quota cache: " + err.Error())
	}
	return &journal, nil
}

func SettleImageAutoBilling(requestId string, actualQuota int) error {
	requestId = strings.TrimSpace(requestId)
	if requestId == "" || len(requestId) > 64 {
		return errors.New("invalid image-auto billing request id")
	}
	if actualQuota < 0 {
		return errors.New("image-auto actual quota cannot be negative")
	}
	if err := MarkImageAutoBillingSettlementPending(requestId, actualQuota); err != nil {
		return err
	}
	return ReconcileImageAutoBilling(requestId)
}

func RefundImageAutoBilling(requestId string) error {
	requestId = strings.TrimSpace(requestId)
	if requestId == "" || len(requestId) > 64 {
		return errors.New("invalid image-auto billing request id")
	}
	if err := markImageAutoRefundPending(requestId); err != nil {
		return err
	}
	return ReconcileImageAutoBilling(requestId)
}

func MarkImageAutoBillingSettlementPending(requestId string, actualQuota int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var journal ImageAutoBillingJournal
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&journal).Error; err != nil {
			return err
		}
		switch journal.Status {
		case ImageAutoBillingStatusSettled:
			if journal.ActualQuota == actualQuota {
				return nil
			}
			return ErrImageAutoBillingConflict
		case ImageAutoBillingStatusSettlementPending:
			if journal.ActualQuota == actualQuota {
				return nil
			}
			return ErrImageAutoBillingConflict
		case ImageAutoBillingStatusReserved, ImageAutoBillingStatusSettlementReview:
			now := getDBTimestampTx(tx)
			return tx.Model(&ImageAutoBillingJournal{}).
				Where("id = ? AND status = ?", journal.Id, journal.Status).
				Updates(map[string]interface{}{
					"actual_quota": actualQuota,
					"status":       ImageAutoBillingStatusSettlementPending,
					"last_error":   "",
					"updated_at":   now,
				}).Error
		default:
			return ErrImageAutoBillingTerminalConflict
		}
	})
}

// MarkImageAutoBillingSettlementReview preserves the full reservation when a
// successful metered response cannot be priced deterministically. The normal
// reconciler ignores this state until an operator supplies a verified target.
func MarkImageAutoBillingSettlementReview(requestId string, cause error) error {
	requestId = strings.TrimSpace(requestId)
	if requestId == "" || len(requestId) > 64 {
		return errors.New("invalid image-auto billing request id")
	}
	message := "image-auto actual quota requires manual review"
	if cause != nil && strings.TrimSpace(cause.Error()) != "" {
		message = cause.Error()
	}
	if len(message) > 2048 {
		message = message[:2048]
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var journal ImageAutoBillingJournal
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&journal).Error; err != nil {
			return err
		}
		switch journal.Status {
		case ImageAutoBillingStatusSettlementReview:
			return nil
		case ImageAutoBillingStatusReserved:
			now := getDBTimestampTx(tx)
			result := tx.Model(&ImageAutoBillingJournal{}).
				Where("id = ? AND status = ?", journal.Id, ImageAutoBillingStatusReserved).
				Updates(map[string]interface{}{
					"status":          ImageAutoBillingStatusSettlementReview,
					"last_error":      message,
					"last_attempt_at": now,
					"updated_at":      now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrImageAutoBillingConflict
			}
			return nil
		default:
			return ErrImageAutoBillingTerminalConflict
		}
	})
}

// RenewImageAutoBillingLease records that the request owning a reservation is
// still alive. Pending and terminal states are never delayed by a heartbeat.
func RenewImageAutoBillingLease(requestId string) error {
	requestId = strings.TrimSpace(requestId)
	if requestId == "" || len(requestId) > 64 {
		return errors.New("invalid image-auto billing request id")
	}
	now := GetDBTimestamp()
	return DB.Model(&ImageAutoBillingJournal{}).
		Where("request_id = ? AND status = ?", requestId, ImageAutoBillingStatusReserved).
		Updates(map[string]interface{}{"updated_at": now}).Error
}

func markImageAutoRefundPending(requestId string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var journal ImageAutoBillingJournal
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&journal).Error; err != nil {
			return err
		}
		switch journal.Status {
		case ImageAutoBillingStatusRefunded, ImageAutoBillingStatusRefundPending:
			return nil
		case ImageAutoBillingStatusReserved:
			now := getDBTimestampTx(tx)
			result := tx.Model(&ImageAutoBillingJournal{}).
				Where("id = ? AND status = ?", journal.Id, ImageAutoBillingStatusReserved).
				Updates(map[string]interface{}{
					"status":     ImageAutoBillingStatusRefundPending,
					"last_error": "",
					"updated_at": now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrImageAutoBillingConflict
			}
			return nil
		default:
			return ErrImageAutoBillingTerminalConflict
		}
	})
}

// ReconcileImageAutoBilling applies a previously persisted pending target.
// Terminal and still-reserved journals are no-ops.
func ReconcileImageAutoBilling(requestId string) error {
	requestId = strings.TrimSpace(requestId)
	if requestId == "" {
		return errors.New("image-auto billing request id is empty")
	}
	changed := false
	reconcileTransition := false
	userId := 0
	tokenId := 0
	pendingStatus := ""
	err := DB.Transaction(func(tx *gorm.DB) error {
		var journal ImageAutoBillingJournal
		if err := lockForUpdate(tx).Where("request_id = ?", requestId).First(&journal).Error; err != nil {
			return err
		}
		pendingStatus = journal.Status
		if journal.Status == ImageAutoBillingStatusReserved {
			leaseRenewedAt := journal.UpdatedAt
			if leaseRenewedAt == 0 {
				leaseRenewedAt = journal.ReservedAt
			}
			if leaseRenewedAt == 0 {
				leaseRenewedAt = journal.CreatedAt
			}
			now := getDBTimestampTx(tx)
			if leaseRenewedAt > now-ImageAutoBillingLeaseSeconds() {
				return nil
			}
			// A stale lease only proves that the gateway stopped renewing it. It
			// does not prove that the upstream image request was never dispatched.
			// Preserve the reserve for explicit settlement review instead of
			// granting an automatic refund after possibly successful work.
			result := tx.Model(&ImageAutoBillingJournal{}).
				Where("id = ? AND status = ?", journal.Id, ImageAutoBillingStatusReserved).
				Updates(map[string]interface{}{
					"status":     ImageAutoBillingStatusSettlementReview,
					"last_error": "image-auto request lease expired before durable settlement; manual review required",
					"updated_at": now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 1 {
				reconcileTransition = true
			}
			return nil
		}
		if journal.Status == ImageAutoBillingStatusRefundPending {
			token, err := findImageAutoBillingToken(lockForUpdate(tx), journal.UserId, journal.TokenId)
			if err != nil {
				return err
			}
			if token != nil {
				if token.UsedQuota < journal.ReservedQuota {
					return errors.New("image-auto token used quota is inconsistent with refund")
				}
			}
			switch journal.FundingSource {
			case ImageAutoBillingFundingWallet:
				var user User
				if err := lockForUpdate(tx).Where("id = ?", journal.UserId).First(&user).Error; err != nil {
					return err
				}
				if err := tx.Model(&User{}).Where("id = ?", journal.UserId).
					Update("quota", gorm.Expr("quota + ?", journal.ReservedQuota)).Error; err != nil {
					return err
				}
			case ImageAutoBillingFundingSubscription:
				if err := RefundSubscriptionPreConsumeTx(tx, journal.RequestId); err != nil {
					return err
				}
			default:
				return fmt.Errorf("unsupported image-auto funding source: %s", journal.FundingSource)
			}
			if token != nil {
				if err := tx.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]interface{}{
					"remain_quota":  gorm.Expr("remain_quota + ?", journal.ReservedQuota),
					"used_quota":    gorm.Expr("used_quota - ?", journal.ReservedQuota),
					"accessed_time": common.GetTimestamp(),
				}).Error; err != nil {
					return err
				}
			}
			now := getDBTimestampTx(tx)
			result := tx.Model(&ImageAutoBillingJournal{}).
				Where("id = ? AND status = ?", journal.Id, ImageAutoBillingStatusRefundPending).
				Updates(map[string]interface{}{
					"actual_quota":    0,
					"status":          ImageAutoBillingStatusRefunded,
					"last_error":      "",
					"last_attempt_at": now,
					"refunded_at":     now,
					"updated_at":      now,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return ErrImageAutoBillingConflict
			}
			changed = true
			userId = journal.UserId
			tokenId = journal.TokenId
			return nil
		}
		if journal.Status != ImageAutoBillingStatusSettlementPending {
			return nil
		}

		delta := journal.ActualQuota - journal.ReservedQuota
		token, err := findImageAutoBillingToken(lockForUpdate(tx), journal.UserId, journal.TokenId)
		if err != nil {
			return err
		}
		if token != nil {
			if delta > 0 && !token.UnlimitedQuota && token.RemainQuota < delta {
				return ErrImageAutoBillingInsufficientToken
			}
			if delta < 0 && token.UsedQuota < -delta {
				return errors.New("image-auto token used quota is inconsistent with reserve")
			}
		}

		switch journal.FundingSource {
		case ImageAutoBillingFundingWallet:
			var user User
			if err := lockForUpdate(tx).Where("id = ?", journal.UserId).First(&user).Error; err != nil {
				return err
			}
			if delta > 0 && user.Quota < delta {
				return ErrImageAutoBillingInsufficientWallet
			}
			if delta != 0 {
				if err := tx.Model(&User{}).Where("id = ?", journal.UserId).
					Update("quota", gorm.Expr("quota - ?", delta)).Error; err != nil {
					return err
				}
			}
		case ImageAutoBillingFundingSubscription:
			if err := PostConsumeUserSubscriptionDeltaTx(tx, journal.UserSubscriptionId, int64(delta)); err != nil {
				return err
			}
		default:
			return fmt.Errorf("unsupported image-auto funding source: %s", journal.FundingSource)
		}

		if delta != 0 && token != nil {
			if err := tx.Model(&Token{}).Where("id = ?", token.Id).Updates(map[string]interface{}{
				"remain_quota":  gorm.Expr("remain_quota - ?", delta),
				"used_quota":    gorm.Expr("used_quota + ?", delta),
				"accessed_time": common.GetTimestamp(),
			}).Error; err != nil {
				return err
			}
		}

		now := getDBTimestampTx(tx)
		result := tx.Model(&ImageAutoBillingJournal{}).
			Where("id = ? AND status = ?", journal.Id, ImageAutoBillingStatusSettlementPending).
			Updates(map[string]interface{}{
				"status":          ImageAutoBillingStatusSettled,
				"last_error":      "",
				"last_attempt_at": now,
				"settled_at":      now,
				"updated_at":      now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrImageAutoBillingConflict
		}
		changed = true
		userId = journal.UserId
		tokenId = journal.TokenId
		return nil
	})
	if err != nil {
		if pendingStatus == ImageAutoBillingStatusSettlementPending || pendingStatus == ImageAutoBillingStatusRefundPending {
			recordImageAutoBillingFailure(requestId, pendingStatus, err)
		}
		return err
	}
	if reconcileTransition {
		return ReconcileImageAutoBilling(requestId)
	}
	if changed {
		if err := RefreshImageAutoBillingQuotaCaches(userId, tokenId); err != nil {
			common.SysLog("failed to refresh image-auto billing quota cache after settlement: " + err.Error())
		}
	}
	return nil
}

func ImageAutoBillingLeaseSeconds() int64 {
	seconds := common.GetEnvOrDefault("IMAGE_AUTO_BILLING_LEASE_SECONDS", 900)
	if seconds < 900 {
		seconds = 900
	}
	if seconds > 7*24*60*60 {
		seconds = 7 * 24 * 60 * 60
	}
	return int64(seconds)
}

type ImageAutoBillingReconcileResult struct {
	Found     int
	Processed int
	Failed    int
}

// ReconcileImageAutoBillingBatch discovers retryable journals. Individual
// requests are locked again by ReconcileImageAutoBilling, so concurrent
// scanners on multiple instances cannot apply quota twice.
func ReconcileImageAutoBillingBatch(limit int) (ImageAutoBillingReconcileResult, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	cutoff := GetDBTimestamp() - ImageAutoBillingLeaseSeconds()
	var journals []ImageAutoBillingJournal
	err := DB.Model(&ImageAutoBillingJournal{}).
		Select("request_id").
		Where("status IN ?", []string{ImageAutoBillingStatusSettlementPending, ImageAutoBillingStatusRefundPending}).
		Or("status = ? AND updated_at <= ?", ImageAutoBillingStatusReserved, cutoff).
		Order("updated_at asc, id asc").
		Limit(limit).
		Find(&journals).Error
	result := ImageAutoBillingReconcileResult{Found: len(journals)}
	if err != nil {
		return result, err
	}

	failures := make([]error, 0)
	for _, journal := range journals {
		if err := ReconcileImageAutoBilling(journal.RequestId); err != nil {
			result.Failed++
			failures = append(failures, fmt.Errorf("%s: %w", journal.RequestId, err))
			continue
		}
		result.Processed++
	}
	return result, errors.Join(failures...)
}

// RefreshOpenImageAutoBillingQuotaCaches repairs the DB-commit/cache-update
// crash window before a new process accepts requests.
func RefreshOpenImageAutoBillingQuotaCaches() error {
	var journals []ImageAutoBillingJournal
	if err := DB.Model(&ImageAutoBillingJournal{}).
		Select("user_id", "token_id").
		Where("status IN ?", []string{
			ImageAutoBillingStatusReserved,
			ImageAutoBillingStatusSettlementPending,
			ImageAutoBillingStatusSettlementReview,
			ImageAutoBillingStatusRefundPending,
		}).
		Group("user_id, token_id").
		Find(&journals).Error; err != nil {
		return err
	}
	failures := make([]error, 0)
	for _, journal := range journals {
		if err := RefreshImageAutoBillingQuotaCaches(journal.UserId, journal.TokenId); err != nil {
			failures = append(failures, fmt.Errorf("user %d token %d: %w", journal.UserId, journal.TokenId, err))
		}
	}
	return errors.Join(failures...)
}

// ListImageAutoBillingReviewJournals returns journals parked in
// settlement_manual_review, oldest first, for the admin review exit.
func ListImageAutoBillingReviewJournals(limit int) ([]ImageAutoBillingJournal, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	var journals []ImageAutoBillingJournal
	err := DB.Model(&ImageAutoBillingJournal{}).
		Where("status = ?", ImageAutoBillingStatusSettlementReview).
		Order("updated_at asc, id asc").
		Limit(limit).
		Find(&journals).Error
	return journals, err
}

func GetImageAutoBillingJournalByRequestId(requestId string) (*ImageAutoBillingJournal, error) {
	requestId = strings.TrimSpace(requestId)
	if requestId == "" || len(requestId) > 64 {
		return nil, nil
	}
	var journal ImageAutoBillingJournal
	result := DB.Where("request_id = ?", requestId).Limit(1).Find(&journal)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &journal, nil
}

func GetImageAutoBillingJournalForOwner(userId, tokenId int, requestId string) (*ImageAutoBillingJournal, error) {
	requestId = strings.TrimSpace(requestId)
	if userId <= 0 || tokenId < 0 || requestId == "" {
		return nil, nil
	}
	var journal ImageAutoBillingJournal
	result := DB.Where("user_id = ? AND token_id = ? AND request_id = ?", userId, tokenId, requestId).
		Limit(1).
		Find(&journal)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &journal, nil
}

func recordImageAutoBillingFailure(requestId, status string, attemptErr error) {
	if attemptErr == nil {
		return
	}
	message := attemptErr.Error()
	if len(message) > 2048 {
		message = message[:2048]
	}
	now := common.GetTimestamp()
	_ = DB.Model(&ImageAutoBillingJournal{}).
		Where("request_id = ? AND status = ?", requestId, status).
		Updates(map[string]interface{}{
			"retry_count":     gorm.Expr("retry_count + ?", 1),
			"last_error":      message,
			"last_attempt_at": now,
			"updated_at":      now,
		}).Error
}

func findImageAutoBillingToken(db *gorm.DB, userId, tokenId int) (*Token, error) {
	if tokenId <= 0 {
		return nil, nil
	}
	var token Token
	if err := db.Where("id = ?", tokenId).First(&token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if token.UserId != userId {
		return nil, fmt.Errorf("image-auto token %d belongs to user %d, not user %d", tokenId, token.UserId, userId)
	}
	return &token, nil
}

// RefreshImageAutoBillingQuotaCaches invalidates quota caches after a committed
// ledger transaction. Each invalidation atomically advances a Redis generation
// and deletes the hash, so an older database snapshot cannot overwrite a newer
// debit from this or another application instance. The token key is loaded by
// id and is never stored in the durable journal.
func RefreshImageAutoBillingQuotaCaches(userId, tokenId int) error {
	if !common.RedisEnabled {
		return nil
	}
	if err := invalidateUserCache(userId); err != nil {
		return err
	}
	token, err := findImageAutoBillingToken(DB, userId, tokenId)
	if err != nil {
		return err
	}
	if token == nil {
		if tokenId > 0 {
			common.SysLog(fmt.Sprintf("skipping image-auto quota cache refresh for deleted token %d", tokenId))
		}
		return nil
	}
	return cacheDeleteToken(token.Key)
}
