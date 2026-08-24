package model

import (
	"fmt"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func CreateRegistrationLifecycleEventsTx(tx *gorm.DB, user *User) error {
	if tx == nil {
		return fmt.Errorf("registration lifecycle events require a transaction")
	}
	if user == nil || user.Id <= 0 {
		return fmt.Errorf("registration lifecycle events require a persisted user")
	}
	if user.CreatedAt <= 0 {
		return fmt.Errorf("registration lifecycle events require a persisted user creation timestamp")
	}

	userID := strconv.Itoa(user.Id)
	payload, err := common.Marshal(map[string]int{"user_id": user.Id})
	if err != nil {
		return err
	}
	for _, spec := range []struct {
		trigger     string
		availableAt int64
	}{
		{trigger: RecallLifecycleTriggerUserRegistered, availableAt: user.CreatedAt},
		{trigger: RecallLifecycleTriggerRegistrationUnused, availableAt: user.CreatedAt + int64(recallLifecycleRegistrationUnusedDelay.Seconds())},
	} {
		occurrence, err := NewRecallLifecycleUserOccurrence(spec.trigger, user.Id)
		if err != nil {
			return err
		}
		event := &RecallLifecycleEvent{
			EventType:         spec.trigger,
			OccurrenceKeyHash: occurrence.Hash,
			ScopeType:         QuotaLifecycleScopeUser,
			ScopeId:           userID,
			BusinessKey:       occurrence.Canonical,
			UserId:            user.Id,
			EventData:         string(payload),
			Disposition:       RecallLifecycleEventPending,
			OccurredAt:        user.CreatedAt,
			AvailableAt:       spec.availableAt,
			SchemaVersion:     1,
		}
		if err := insertRecallLifecycleEvent(tx, event).Error; err != nil {
			return err
		}
	}

	return insertInitialRegistrationWalletLifecycleStateTx(tx, user)
}

func insertInitialRegistrationWalletLifecycleStateTx(tx *gorm.DB, user *User) error {
	userID := strconv.Itoa(user.Id)
	cycleKey := "registration:" + userID
	payload, err := common.Marshal(map[string]any{
		"user_id":   user.Id,
		"cycle_key": cycleKey,
	})
	if err != nil {
		return err
	}
	state := &QuotaLifecycleState{
		UserId:       user.Id,
		ScopeType:    QuotaLifecycleScopeWallet,
		ScopeId:      userID,
		Cycle:        cycleKey,
		Balance:      int64(user.Quota),
		Threshold:    registrationLifecycleQuotaThreshold(user),
		Source:       cycleKey,
		SourceData:   string(payload),
		StateVersion: 1,
	}
	return insertQuotaLifecycleStateIfAbsent(tx, state).Error
}

func registrationLifecycleQuotaThreshold(user *User) int64 {
	if user != nil {
		threshold := user.GetSetting().QuotaWarningThreshold
		if threshold > 0 {
			return int64(threshold)
		}
	}
	return int64(common.QuotaRemindThreshold)
}

func insertQuotaLifecycleStateIfAbsent(tx *gorm.DB, state *QuotaLifecycleState) *gorm.DB {
	if tx.Dialector.Name() == "mysql" {
		return tx.Clauses(clause.OnConflict{
			DoUpdates: clause.Assignments(map[string]any{
				"id": gorm.Expr("id"),
			}),
		}).Create(state)
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "scope_type"}, {Name: "scope_id"}},
		DoNothing: true,
	}).Create(state)
}
