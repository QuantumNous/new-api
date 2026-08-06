package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	QuotaLifecycleScopeUser         = "user"
	QuotaLifecycleScopeToken        = "token"
	QuotaLifecycleScopeWallet       = "wallet"
	QuotaLifecycleScopeSubscription = "subscription"
)

const (
	lifecycleQuotaMaxInt64 = int64(^uint64(0) >> 1)
	lifecycleQuotaMinInt64 = -lifecycleQuotaMaxInt64 - 1
)

var ErrLifecycleQuotaBalanceOverflow = errors.New("quota lifecycle balance arithmetic overflow")

type QuotaLifecycleState struct {
	Id           int64  `json:"id" gorm:"primaryKey"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_quota_lifecycle_scope,priority:1;index"`
	ScopeType    string `json:"scope_type" gorm:"type:varchar(32);not null;uniqueIndex:idx_quota_lifecycle_scope,priority:2"`
	ScopeId      string `json:"scope_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_quota_lifecycle_scope,priority:3"`
	Cycle        string `json:"cycle" gorm:"type:varchar(64);not null;index"`
	Balance      int64  `json:"balance" gorm:"not null;default:0"`
	Threshold    int64  `json:"threshold" gorm:"not null;default:0"`
	Source       string `json:"source" gorm:"type:varchar(64);not null"`
	SourceData   string `json:"source_data" gorm:"type:text;not null"`
	StateVersion int64  `json:"state_version" gorm:"not null;default:1"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt    int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type LifecycleQuotaMutation struct {
	UserID          int
	ScopeType       string
	ScopeID         int64
	Delta           int64
	RequireAtLeast  int64
	Cause           string
	SourceRef       string
	Threshold       int64
	NextCycleKey    string
	NextCycleSource string
	OccurredAt      int64
}

type LifecycleQuotaMutationResult struct {
	Applied         bool
	PreviousBalance int64
	CurrentBalance  int64
	CycleKey        string
}

type lifecycleAuthoritativeBalance struct {
	Balance           int64
	SubscriptionTotal int64
	SubscriptionUsed  int64
	Unlimited         bool
}

func ApplyLifecycleQuotaMutation(tx *gorm.DB, mutation LifecycleQuotaMutation) (LifecycleQuotaMutationResult, error) {
	if tx == nil {
		return LifecycleQuotaMutationResult{}, errors.New("quota lifecycle mutation requires transaction")
	}
	if mutation.UserID <= 0 {
		return LifecycleQuotaMutationResult{}, errors.New("quota lifecycle mutation requires user id")
	}
	scopeType := strings.TrimSpace(mutation.ScopeType)
	scopeID := strconv.FormatInt(mutation.ScopeID, 10)
	if mutation.ScopeID <= 0 {
		return LifecycleQuotaMutationResult{}, errors.New("quota lifecycle mutation requires scope id")
	}
	if err := validateLifecycleQuotaScope(mutation.UserID, scopeType, mutation.ScopeID); err != nil {
		return LifecycleQuotaMutationResult{}, err
	}
	cause := strings.TrimSpace(mutation.Cause)
	if cause == "" {
		return LifecycleQuotaMutationResult{}, errors.New("quota lifecycle mutation requires cause")
	}
	if strings.TrimSpace(mutation.NextCycleKey) != "" && !lifecycleQuotaCauseAllowsCycleRotation(cause) {
		return LifecycleQuotaMutationResult{}, fmt.Errorf("quota lifecycle cause %q cannot rotate cycle", cause)
	}

	authoritative, err := lockLifecycleQuotaAuthoritativeBalance(tx, mutation.UserID, scopeType, mutation.ScopeID)
	if err != nil {
		return LifecycleQuotaMutationResult{}, err
	}
	previous := authoritative.Balance
	result := LifecycleQuotaMutationResult{
		Applied:         true,
		PreviousBalance: previous,
		CurrentBalance:  previous,
	}
	if mutation.RequireAtLeast > 0 && !authoritative.Unlimited && previous < mutation.RequireAtLeast {
		result.Applied = false
		return result, nil
	}

	threshold, err := effectiveLifecycleQuotaThreshold(tx, mutation.UserID, mutation.Threshold)
	if err != nil {
		return LifecycleQuotaMutationResult{}, err
	}
	state, err := lockOrCreateLifecycleQuotaState(tx, mutation.UserID, scopeType, scopeID, previous, threshold)
	if err != nil {
		return LifecycleQuotaMutationResult{}, err
	}
	cycle := state.Cycle
	if nextCycle := strings.TrimSpace(mutation.NextCycleKey); nextCycle != "" {
		cycle = nextCycle
		state.Cycle = nextCycle
		state.Source = strings.TrimSpace(mutation.NextCycleSource)
		if state.Source == "" {
			state.Source = nextCycle
		}
	}
	result.CycleKey = cycle

	current, err := checkedLifecycleQuotaAdd(previous, mutation.Delta)
	if err != nil {
		return LifecycleQuotaMutationResult{}, err
	}
	current, err = updateLifecycleQuotaAuthoritativeBalance(tx, mutation.UserID, scopeType, mutation.ScopeID, authoritative, current, mutation.Delta)
	if err != nil {
		return LifecycleQuotaMutationResult{}, err
	}
	result.CurrentBalance = current

	if err := insertLifecycleQuotaCrossingEvents(tx, mutation, scopeType, scopeID, cycle, previous, current, threshold); err != nil {
		return LifecycleQuotaMutationResult{}, err
	}

	state.Balance = current
	state.Threshold = threshold
	state.StateVersion++
	sourceData, err := common.Marshal(map[string]any{
		"user_id":          mutation.UserID,
		"scope_type":       scopeType,
		"scope_id":         scopeID,
		"cause":            cause,
		"source_ref":       strings.TrimSpace(mutation.SourceRef),
		"previous_balance": previous,
		"current_balance":  current,
		"cycle_key":        cycle,
	})
	if err != nil {
		return LifecycleQuotaMutationResult{}, err
	}
	state.SourceData = string(sourceData)
	if strings.TrimSpace(state.Source) == "" {
		state.Source = state.Cycle
	}
	if err := tx.Save(&state).Error; err != nil {
		return LifecycleQuotaMutationResult{}, err
	}
	return result, nil
}

func validateLifecycleQuotaScope(userID int, scopeType string, scopeID int64) error {
	switch scopeType {
	case QuotaLifecycleScopeWallet:
		if scopeID != int64(userID) {
			return errors.New("wallet quota lifecycle scope id must equal user id")
		}
	case QuotaLifecycleScopeSubscription:
		if scopeID <= 0 {
			return errors.New("subscription quota lifecycle scope id is invalid")
		}
	default:
		return fmt.Errorf("unsupported quota lifecycle scope %q", scopeType)
	}
	return nil
}

func lifecycleQuotaCauseAllowsCycleRotation(cause string) bool {
	switch strings.TrimSpace(cause) {
	case "topup_success", "subscription_purchase", "subscription_renewal":
		return true
	default:
		return false
	}
}

func lockLifecycleQuotaAuthoritativeBalance(tx *gorm.DB, userID int, scopeType string, scopeID int64) (lifecycleAuthoritativeBalance, error) {
	switch scopeType {
	case QuotaLifecycleScopeWallet:
		var user User
		if err := lockQuery(tx).Where("id = ?", userID).First(&user).Error; err != nil {
			return lifecycleAuthoritativeBalance{}, err
		}
		return lifecycleAuthoritativeBalance{Balance: int64(user.Quota)}, nil
	case QuotaLifecycleScopeSubscription:
		var sub UserSubscription
		if err := lockQuery(tx).
			Where("id = ? AND user_id = ?", scopeID, userID).
			First(&sub).Error; err != nil {
			return lifecycleAuthoritativeBalance{}, err
		}
		if sub.AmountTotal == 0 {
			return lifecycleAuthoritativeBalance{
				Balance:           0,
				SubscriptionTotal: sub.AmountTotal,
				SubscriptionUsed:  sub.AmountUsed,
				Unlimited:         true,
			}, nil
		}
		balance, err := checkedLifecycleQuotaSub(sub.AmountTotal, sub.AmountUsed)
		if err != nil {
			return lifecycleAuthoritativeBalance{}, err
		}
		return lifecycleAuthoritativeBalance{
			Balance:           balance,
			SubscriptionTotal: sub.AmountTotal,
			SubscriptionUsed:  sub.AmountUsed,
		}, nil
	default:
		return lifecycleAuthoritativeBalance{}, fmt.Errorf("unsupported quota lifecycle scope %q", scopeType)
	}
}

func updateLifecycleQuotaAuthoritativeBalance(tx *gorm.DB, userID int, scopeType string, scopeID int64, authoritative lifecycleAuthoritativeBalance, current int64, delta int64) (int64, error) {
	previous := authoritative.Balance
	switch scopeType {
	case QuotaLifecycleScopeWallet:
		res := tx.Model(&User{}).
			Where("id = ? AND quota = ?", userID, previous).
			Update("quota", current)
		if res.Error != nil {
			return previous, res.Error
		}
		if res.RowsAffected != 1 {
			return previous, errors.New("quota lifecycle wallet balance changed concurrently")
		}
		return current, nil
	case QuotaLifecycleScopeSubscription:
		var sub UserSubscription
		if err := tx.Where("id = ? AND user_id = ?", scopeID, userID).First(&sub).Error; err != nil {
			return previous, err
		}
		expectedUsed := authoritative.SubscriptionUsed
		if authoritative.SubscriptionTotal != sub.AmountTotal || expectedUsed != sub.AmountUsed {
			return previous, errors.New("quota lifecycle subscription balance changed concurrently")
		}
		newUsed := int64(0)
		actualCurrent := int64(0)
		if authoritative.Unlimited {
			var err error
			newUsed, err = checkedLifecycleQuotaSub(sub.AmountUsed, delta)
			if err != nil {
				return previous, err
			}
			if newUsed < 0 {
				newUsed = 0
			}
		} else {
			var err error
			newUsed, err = checkedLifecycleQuotaSub(sub.AmountTotal, current)
			if err != nil {
				return previous, err
			}
			if newUsed < 0 {
				newUsed = 0
			}
			if sub.AmountTotal > 0 && newUsed > sub.AmountTotal {
				return previous, fmt.Errorf("subscription used exceeds total, used=%d total=%d", newUsed, sub.AmountTotal)
			}
			actualCurrent = sub.AmountTotal - newUsed
		}
		if newUsed == sub.AmountUsed {
			return actualCurrent, nil
		}
		res := tx.Model(&UserSubscription{}).
			Where("id = ? AND user_id = ? AND amount_used = ?", scopeID, userID, sub.AmountUsed).
			Update("amount_used", newUsed)
		if res.Error != nil {
			return previous, res.Error
		}
		if res.RowsAffected != 1 {
			return previous, errors.New("quota lifecycle subscription balance changed concurrently")
		}
		return actualCurrent, nil
	default:
		return previous, fmt.Errorf("unsupported quota lifecycle scope %q", scopeType)
	}
}

func checkedLifecycleQuotaAdd(left int64, right int64) (int64, error) {
	if (right > 0 && left > lifecycleQuotaMaxInt64-right) ||
		(right < 0 && left < lifecycleQuotaMinInt64-right) {
		return 0, ErrLifecycleQuotaBalanceOverflow
	}
	return left + right, nil
}

func checkedLifecycleQuotaSub(left int64, right int64) (int64, error) {
	if (right > 0 && left < lifecycleQuotaMinInt64+right) ||
		(right < 0 && left > lifecycleQuotaMaxInt64+right) {
		return 0, ErrLifecycleQuotaBalanceOverflow
	}
	return left - right, nil
}

func checkedLifecycleQuotaNeg(value int64) (int64, error) {
	return checkedLifecycleQuotaSub(0, value)
}

func effectiveLifecycleQuotaThreshold(tx *gorm.DB, userID int, explicit int64) (int64, error) {
	if explicit > 0 {
		return explicit, nil
	}
	var user User
	if err := tx.Where("id = ?", userID).First(&user).Error; err != nil {
		return 0, err
	}
	if threshold := user.GetSetting().QuotaWarningThreshold; threshold > 0 {
		return int64(threshold), nil
	}
	return int64(common.QuotaRemindThreshold), nil
}

func lockOrCreateLifecycleQuotaState(tx *gorm.DB, userID int, scopeType string, scopeID string, balance int64, threshold int64) (QuotaLifecycleState, error) {
	var state QuotaLifecycleState
	err := lockQuery(tx).
		Where("user_id = ? AND scope_type = ? AND scope_id = ?", userID, scopeType, scopeID).
		First(&state).Error
	if err == nil {
		return state, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return QuotaLifecycleState{}, err
	}
	cycle := fmt.Sprintf("baseline:%s:%s", scopeType, scopeID)
	sourceData, err := common.Marshal(map[string]any{
		"user_id":    userID,
		"scope_type": scopeType,
		"scope_id":   scopeID,
		"cycle_key":  cycle,
		"balance":    balance,
	})
	if err != nil {
		return QuotaLifecycleState{}, err
	}
	state = QuotaLifecycleState{
		UserId:       userID,
		ScopeType:    scopeType,
		ScopeId:      scopeID,
		Cycle:        cycle,
		Balance:      balance,
		Threshold:    threshold,
		Source:       cycle,
		SourceData:   string(sourceData),
		StateVersion: 1,
	}
	if err := insertQuotaLifecycleStateIfAbsent(tx, &state).Error; err != nil {
		return QuotaLifecycleState{}, err
	}
	if err := lockQuery(tx).
		Where("user_id = ? AND scope_type = ? AND scope_id = ?", userID, scopeType, scopeID).
		First(&state).Error; err != nil {
		return QuotaLifecycleState{}, err
	}
	return state, nil
}

func insertLifecycleQuotaCrossingEvents(tx *gorm.DB, mutation LifecycleQuotaMutation, scopeType string, scopeID string, cycle string, previous int64, current int64, threshold int64) error {
	eventType := ""
	if previous > 0 && current <= 0 {
		eventType = RecallLifecycleTriggerQuotaExhaustedUnpaid
	} else if previous >= threshold && current > 0 && current < threshold {
		eventType = RecallLifecycleTriggerQuotaLow
	}
	if eventType == "" {
		return nil
	}
	occurredAt := mutation.OccurredAt
	if occurredAt <= 0 {
		occurredAt = getDBTimestampTx(tx)
	}
	payload, err := common.Marshal(map[string]any{
		"user_id":          mutation.UserID,
		"scope_type":       scopeType,
		"scope_id":         scopeID,
		"cycle_key":        cycle,
		"previous_balance": previous,
		"current_balance":  current,
		"threshold":        threshold,
		"cause":            strings.TrimSpace(mutation.Cause),
		"source_ref":       strings.TrimSpace(mutation.SourceRef),
	})
	if err != nil {
		return err
	}
	occurrence, err := NewRecallLifecycleQuotaOccurrence(eventType, scopeType, scopeID, cycle, mutation.UserID)
	if err != nil {
		return err
	}
	event := &RecallLifecycleEvent{
		EventType:         eventType,
		OccurrenceKeyHash: occurrence.Hash,
		ScopeType:         scopeType,
		ScopeId:           scopeID,
		BusinessKey:       occurrence.Canonical,
		UserId:            mutation.UserID,
		EventData:         string(payload),
		Disposition:       RecallLifecycleEventPending,
		OccurredAt:        occurredAt,
		AvailableAt:       occurredAt,
		SchemaVersion:     1,
	}
	return insertRecallLifecycleEvent(tx, event).Error
}
