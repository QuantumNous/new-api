package model

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var ErrSubscriptionQuotaInsufficient = errors.New("subscription quota insufficient")

// The subscription row serializes its accounting. READ COMMITTED prevents
// MySQL's missing-window reads from taking gap locks that deadlock inserts for
// unrelated subscriptions; policy reads still use shared current-read locks.
func subscriptionQuotaTransaction(fn func(*gorm.DB) error) error {
	if common.UsingMainDatabase(common.DatabaseTypeMySQL) {
		return DB.Transaction(fn, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	}
	return DB.Transaction(fn)
}

// SubscriptionQuotaWindow includes reservations as well as settled usage. The
// base window preserves the original allowance across resets; the other three
// windows are independent Beijing calendar periods.
type SubscriptionQuotaWindow struct {
	Id             int    `gorm:"primaryKey"`
	SubscriptionId int    `gorm:"not null;uniqueIndex:idx_subscription_quota_window,priority:1"`
	Generation     int64  `gorm:"type:bigint;not null;uniqueIndex:idx_subscription_quota_window,priority:2"`
	Kind           string `gorm:"type:varchar(8);not null;uniqueIndex:idx_subscription_quota_window,priority:3"`
	PeriodStart    int64  `gorm:"type:bigint;not null;uniqueIndex:idx_subscription_quota_window,priority:4"`
	Used           int64  `gorm:"type:bigint;not null;default:0"`
	UpdatedAt      int64  `gorm:"type:bigint;not null;index"`
}

type SubscriptionQuotaWindowUsage struct {
	Limit   int64 `json:"limit"`
	Used    int64 `json:"used"`
	ResetAt int64 `json:"reset_at"`
}

type SubscriptionQuotaWindows struct {
	Daily   SubscriptionQuotaWindowUsage `json:"daily"`
	Weekly  SubscriptionQuotaWindowUsage `json:"weekly"`
	Monthly SubscriptionQuotaWindowUsage `json:"monthly"`
}

type SubscriptionQuotaLimitError struct {
	Period  string
	ResetAt int64
}

func (err *SubscriptionQuotaLimitError) Error() string {
	return fmt.Sprintf("subscription quota insufficient: %s limit, reset_at=%d", err.Period, err.ResetAt)
}

func (err *SubscriptionQuotaLimitError) Unwrap() error { return ErrSubscriptionQuotaInsufficient }

type subscriptionQuotaPeriod struct {
	kind  string
	start int64
	end   int64
	limit int64
}

// A fixed UTC+8 zone keeps these future accounting periods independent of the
// host timezone and of whether a minimal Linux image installs tzdata.
var subscriptionQuotaLocation = time.FixedZone("Asia/Shanghai", 8*60*60)

func subscriptionQuotaPeriods(at int64, plan *SubscriptionPlan) [3]subscriptionQuotaPeriod {
	now := time.Unix(at, 0).In(subscriptionQuotaLocation)
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, subscriptionQuotaLocation)
	week := day.AddDate(0, 0, -(int(day.Weekday())+6)%7)
	month := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, subscriptionQuotaLocation)
	return [3]subscriptionQuotaPeriod{
		{"daily", day.Unix(), day.AddDate(0, 0, 1).Unix(), plan.DailyLimit},
		{"weekly", week.Unix(), week.AddDate(0, 0, 7).Unix(), plan.WeeklyLimit},
		{"monthly", month.Unix(), month.AddDate(0, 1, 0).Unix(), plan.MonthlyLimit},
	}
}

// The caller holds the subscription row lock. Missing windows are only created
// if the complete reservation succeeds, in that same transaction.
func subscriptionReceiptWindowsTx(tx *gorm.DB, sub *UserSubscription, record *SubscriptionPreConsumeRecord, plan *SubscriptionPlan) ([]SubscriptionQuotaWindow, error) {
	windows := []SubscriptionQuotaWindow{{SubscriptionId: sub.Id, Generation: record.QuotaGeneration, Kind: "base"}}
	for _, period := range subscriptionQuotaPeriods(record.AccountedAt, plan) {
		windows = append(windows, SubscriptionQuotaWindow{SubscriptionId: sub.Id, Generation: record.PeriodGeneration, Kind: period.kind, PeriodStart: period.start})
	}
	for i := range windows {
		window := &windows[i]
		var stored SubscriptionQuotaWindow
		result := lockForUpdate(tx).Where("subscription_id = ? AND generation = ? AND kind = ? AND period_start = ?", window.SubscriptionId, window.Generation, window.Kind, window.PeriodStart).Limit(1).Find(&stored)
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected > 0 {
			*window = stored
		} else if window.Kind == "base" && window.Generation == max(sub.QuotaGeneration, 1) {
			window.Used = sub.AmountUsed
		}
	}
	return windows, nil
}

func applySubscriptionReceiptAmountTx(tx *gorm.DB, sub *UserSubscription, record *SubscriptionPreConsumeRecord, plan *SubscriptionPlan, target int64, reserve bool) error {
	if target < 0 || target > common.MaxQuota || record.AccountedAmount < 0 || record.AccountedAmount > common.MaxQuota {
		return errors.New("subscription quota is outside the supported range")
	}
	windows, err := subscriptionReceiptWindowsTx(tx, sub, record, plan)
	if err != nil {
		return err
	}
	delta := target - record.AccountedAmount
	periods := subscriptionQuotaPeriods(record.AccountedAt, plan)
	for i, window := range windows {
		if delta > 0 && window.Used > common.MaxWalletQuota-delta {
			return errors.New("subscription quota accounting overflow")
		}
		if window.Used+delta < 0 {
			return errors.New("subscription quota accounting underflow")
		}
		limit := sub.AmountTotal
		if i > 0 {
			limit = periods[i-1].limit
		}
		if reserve && delta > 0 && limit > 0 && window.Used+delta > limit {
			if i == 0 {
				return ErrSubscriptionQuotaInsufficient
			}
			return &SubscriptionQuotaLimitError{Period: periods[i-1].kind, ResetAt: periods[i-1].end}
		}
	}
	now := getDBTimestamp(tx)
	for i := range windows {
		windows[i].Used += delta
		windows[i].UpdatedAt = now
		if err := tx.Save(&windows[i]).Error; err != nil {
			return err
		}
	}
	if record.QuotaGeneration == max(sub.QuotaGeneration, 1) {
		sub.AmountUsed = windows[0].Used
		if err := tx.Save(sub).Error; err != nil {
			return err
		}
	}
	record.AccountedAmount = target
	return nil
}

// ReserveSubscriptionPreConsume raises a request's total reservation. A target
// amount makes retries idempotent, including retries after an ambiguous commit.
func ReserveSubscriptionPreConsume(requestID string, target int64) error {
	_, err := updateSubscriptionReceipt(requestID, target, "reserve")
	return err
}

func RollbackSubscriptionPreConsume(requestID string, target int64) error {
	_, err := updateSubscriptionReceipt(requestID, target, "rollback")
	return err
}

// SettleSubscriptionPreConsume records actual work even when it exceeds the
// admission estimate. It returns the applied difference; replaying the same
// target cannot charge twice.
func SettleSubscriptionPreConsume(requestID string, actual int64) (int64, error) {
	return updateSubscriptionReceipt(requestID, actual, "settle")
}

// FinalizeSubscriptionPreConsume settles the initial request only if no task
// settlement or refund has already completed. The returned difference is the
// amount the caller must apply to its token as well.
func FinalizeSubscriptionPreConsume(requestID string, actual int64) (int64, error) {
	return updateSubscriptionReceipt(requestID, actual, "finalize")
}

func updateSubscriptionReceipt(requestID string, target int64, operation string) (int64, error) {
	reserve, refund := operation == "reserve", operation == "refund"
	reservation := reserve || operation == "rollback"
	if requestID == "" {
		return 0, errors.New("requestId is empty")
	}
	var delta int64
	err := subscriptionQuotaTransaction(func(tx *gorm.DB) error {
		var snapshot SubscriptionPreConsumeRecord
		if err := tx.Where("request_id = ?", requestID).First(&snapshot).Error; err != nil {
			return err
		}
		var sub UserSubscription
		if err := lockForUpdate(tx).First(&sub, snapshot.UserSubscriptionId).Error; err != nil {
			return err
		}
		var record SubscriptionPreConsumeRecord
		if err := lockForUpdate(tx).First(&record, snapshot.Id).Error; err != nil {
			return err
		}
		if operation == "finalize" && (record.SettledAt > 0 || record.Status == "refunded") {
			return nil
		}
		if operation == "finalize" && target == record.AccountedAmount {
			record.SettledAt = getDBTimestamp(tx)
			return tx.Save(&record).Error
		}
		if record.Status == "refunded" {
			if target == 0 {
				return nil
			}
			return errors.New("subscription pre-consume already refunded")
		}
		if record.AccountedAt == 0 {
			if !refund {
				return errors.New("legacy subscription receipt has no period accounting")
			}
			// Old records have no period provenance. Never subtract a pre-reset
			// refund from a newly issued allowance.
			if sub.QuotaResetAt == 0 || record.CreatedAt > sub.QuotaResetAt {
				if err := postConsumeUserSubscriptionDeltaTx(tx, &sub, -record.PreConsumed); err != nil {
					return err
				}
			}
			record.Status = "refunded"
			return tx.Save(&record).Error
		}
		var plan SubscriptionPlan
		if err := lockForShare(tx).First(&plan, sub.PlanId).Error; err != nil {
			return err
		}
		if err := maybeResetUserSubscriptionWithPlanTx(tx, &sub, &plan, getDBTimestamp(tx)); err != nil {
			return err
		}
		if reservation && record.SettledAt > 0 {
			return errors.New("subscription receipt is already settled")
		}
		if reserve && target <= record.AccountedAmount {
			return nil
		}
		if operation == "rollback" && target >= record.AccountedAmount {
			return nil
		}
		delta = target - record.AccountedAmount
		if err := applySubscriptionReceiptAmountTx(tx, &sub, &record, &plan, target, reserve); err != nil {
			return err
		}
		if !reservation {
			record.SettledAt = getDBTimestamp(tx)
		}
		if refund {
			record.Status = "refunded"
		}
		return tx.Save(&record).Error
	})
	return delta, err
}

func postConsumeUserSubscriptionDeltaTx(tx *gorm.DB, sub *UserSubscription, delta int64) error {
	if delta > 0 && sub.AmountUsed > common.MaxWalletQuota-delta {
		return errors.New("subscription quota accounting overflow")
	}
	newUsed := max(sub.AmountUsed+delta, 0)
	if sub.AmountTotal > 0 && newUsed > sub.AmountTotal {
		return ErrSubscriptionQuotaInsufficient
	}
	sub.AmountUsed = newUsed
	if err := tx.Save(sub).Error; err != nil {
		return err
	}
	return tx.Model(&SubscriptionQuotaWindow{}).Where("subscription_id = ? AND generation = ? AND kind = ?", sub.Id, max(sub.QuotaGeneration, 1), "base").Updates(map[string]any{"used": newUsed, "updated_at": getDBTimestamp(tx)}).Error
}

// PopulateSubscriptionQuotaWindows batches reads for both admin and self lists.
// Policies are read from SQL so changes affect existing subscriptions without a
// stale process cache restoring the old limit.
func PopulateSubscriptionQuotaWindows(subs []UserSubscription) error {
	if len(subs) == 0 {
		return nil
	}
	ids, planIDs := make([]int, 0, len(subs)), make([]int, 0, len(subs))
	for _, sub := range subs {
		ids = append(ids, sub.Id)
		planIDs = append(planIDs, sub.PlanId)
	}
	var plans []SubscriptionPlan
	if err := DB.Where("id IN ?", planIDs).Find(&plans).Error; err != nil {
		return err
	}
	byPlan := make(map[int]SubscriptionPlan, len(plans))
	for _, plan := range plans {
		byPlan[plan.Id] = plan
	}
	now := GetDBTimestamp()
	periods := subscriptionQuotaPeriods(now, &SubscriptionPlan{})
	starts := []int64{periods[0].start, periods[1].start, periods[2].start}
	var rows []SubscriptionQuotaWindow
	if err := DB.Where("subscription_id IN ? AND period_start IN ? AND kind <> ?", ids, starts, "base").Find(&rows).Error; err != nil {
		return err
	}
	type windowKey struct {
		sub        int
		generation int64
		kind       string
		start      int64
	}
	usage := make(map[windowKey]int64, len(rows))
	for _, row := range rows {
		usage[windowKey{row.SubscriptionId, row.Generation, row.Kind, row.PeriodStart}] = row.Used
	}
	for i := range subs {
		sub := &subs[i]
		plan := byPlan[sub.PlanId]
		windows := &SubscriptionQuotaWindows{}
		views := []*SubscriptionQuotaWindowUsage{&windows.Daily, &windows.Weekly, &windows.Monthly}
		for j, period := range subscriptionQuotaPeriods(now, &plan) {
			*views[j] = SubscriptionQuotaWindowUsage{Limit: period.limit, Used: usage[windowKey{sub.Id, max(sub.PeriodGeneration, 1), period.kind, period.start}], ResetAt: period.end}
		}
		sub.QuotaWindows = windows
	}
	return nil
}

func cleanupSubscriptionQuotaLedger(cutoff int64) (int64, error) {
	var removed int64
	// Advance past retained rows as well as deleted rows. A full batch of
	// task references must not starve later receipts or windows.
	for cursor := 0; ; {
		var records []SubscriptionPreConsumeRecord
		if err := DB.Where("id > ? AND accounted_at > 0 AND settled_at > 0 AND updated_at < ?", cursor, cutoff).Order("id").Limit(500).Find(&records).Error; err != nil {
			return removed, err
		}
		if len(records) == 0 {
			break
		}
		cursor = records[len(records)-1].Id
		for _, record := range records {
			err := DB.Transaction(func(tx *gorm.DB) error {
				var sub UserSubscription
				err := lockForUpdate(tx).First(&sub, record.UserSubscriptionId).Error
				if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				references := tx.Model(&Task{}).Select("subscription_receipt_id").Where("subscription_receipt_id <> ?", "")
				res := tx.Where("id = ? AND settled_at > 0 AND updated_at < ? AND request_id NOT IN (?)", record.Id, cutoff, references).Delete(&SubscriptionPreConsumeRecord{})
				removed += res.RowsAffected
				return res.Error
			})
			if err != nil {
				return removed, err
			}
		}
	}
	for cursor := 0; ; {
		var windows []SubscriptionQuotaWindow
		if err := DB.Where("id > ? AND updated_at < ?", cursor, cutoff).Order("id").Limit(500).Find(&windows).Error; err != nil {
			return removed, err
		}
		if len(windows) == 0 {
			break
		}
		cursor = windows[len(windows)-1].Id
		for _, window := range windows {
			err := DB.Transaction(func(tx *gorm.DB) error {
				var sub UserSubscription
				err := lockForUpdate(tx).First(&sub, window.SubscriptionId).Error
				if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				query := tx.Model(&SubscriptionPreConsumeRecord{}).Where("user_subscription_id = ? AND accounted_at > 0", window.SubscriptionId)
				if window.Kind == "base" {
					query = query.Where("quota_generation = ?", window.Generation)
				} else {
					for _, period := range subscriptionQuotaPeriods(window.PeriodStart, &SubscriptionPlan{}) {
						if period.kind == window.Kind {
							query = query.Where("period_generation = ? AND accounted_at >= ? AND accounted_at < ?", window.Generation, period.start, period.end)
						}
					}
				}
				var count int64
				if err := query.Count(&count).Error; err != nil {
					return err
				}
				if count != 0 {
					return nil
				}
				return tx.Where("id = ? AND updated_at < ?", window.Id, cutoff).Delete(&SubscriptionQuotaWindow{}).Error
			})
			if err != nil {
				return removed, err
			}
		}
	}
	return removed, nil
}
