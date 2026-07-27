package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type SubscriptionRenewalLifecycleResult struct {
	RenewalSource     string
	RenewalStatus     string
	CurrentPeriodEnd  int64
	CanCancel         bool
	CanResume         bool
	CancelAtPeriodEnd bool
}

func CancelCurrentSubscriptionRenewal(userID int) (*SubscriptionRenewalLifecycleResult, error) {
	return updateCurrentSubscriptionRenewal(userID, model.SubscriptionRenewalStatusEnabled, model.SubscriptionRenewalStatusCancelledByUser)
}

func ResumeCurrentSubscriptionRenewal(userID int) (*SubscriptionRenewalLifecycleResult, error) {
	return updateCurrentSubscriptionRenewal(userID, model.SubscriptionRenewalStatusCancelledByUser, model.SubscriptionRenewalStatusEnabled)
}

func updateCurrentSubscriptionRenewal(userID int, fromStatus string, toStatus string) (*SubscriptionRenewalLifecycleResult, error) {
	if userID <= 0 {
		return nil, errors.New("invalid user id")
	}
	var result *SubscriptionRenewalLifecycleResult
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		contract, err := loadRenewalLifecycleContractTx(tx, userID)
		if err != nil {
			return err
		}
		if contract.RenewalStatus == toStatus {
			result = buildSubscriptionRenewalLifecycleResult(contract)
			return nil
		}
		if contract.RenewalStatus != fromStatus {
			return errors.New("subscription renewal status cannot be changed")
		}
		if err := tx.Model(&model.UserSubscriptionContract{}).
			Where("id = ? AND user_id = ? AND renewal_status = ?", contract.Id, userID, fromStatus).
			Update("renewal_status", toStatus).Error; err != nil {
			return err
		}
		contract.RenewalStatus = toStatus
		result = buildSubscriptionRenewalLifecycleResult(contract)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func loadRenewalLifecycleContractTx(tx *gorm.DB, userID int) (*model.UserSubscriptionContract, error) {
	var contract model.UserSubscriptionContract
	if err := subscriptionCommandLock(tx).Where("user_id = ?", userID).First(&contract).Error; err != nil {
		return nil, err
	}
	if contract.Status != model.SubscriptionContractStatusActive {
		return nil, errors.New("active subscription contract is required")
	}
	if contract.RenewalSource != model.SubscriptionRenewalSourceWallet {
		return nil, errors.New("only wallet subscription renewal can be changed")
	}
	if contract.CurrentPeriodEnd <= common.GetTimestamp() {
		return nil, errors.New("current subscription period has expired")
	}
	if contract.CurrentEntitlementId <= 0 {
		return nil, errors.New("current subscription entitlement is required")
	}
	var entitlement model.UserSubscription
	entitlementQuery := subscriptionCommandLock(tx).Where(
		"id = ? AND user_id = ? AND contract_id = ?",
		contract.CurrentEntitlementId,
		contract.UserId,
		contract.Id,
	).Limit(1).Find(&entitlement)
	if entitlementQuery.Error != nil {
		return nil, entitlementQuery.Error
	}
	if entitlementQuery.RowsAffected != 1 {
		return nil, errors.New("active current subscription entitlement is required")
	}
	if entitlement.Status != model.SubscriptionEntitlementStatusActive ||
		entitlement.EndTime <= common.GetTimestamp() ||
		entitlement.AccessEndTime <= common.GetTimestamp() ||
		entitlement.CurrentSlot == nil ||
		*entitlement.CurrentSlot != 1 {
		return nil, errors.New("active current subscription entitlement is required")
	}
	return &contract, nil
}

func buildSubscriptionRenewalLifecycleResult(contract *model.UserSubscriptionContract) *SubscriptionRenewalLifecycleResult {
	result := &SubscriptionRenewalLifecycleResult{
		RenewalSource:    contract.RenewalSource,
		RenewalStatus:    contract.RenewalStatus,
		CurrentPeriodEnd: contract.CurrentPeriodEnd,
	}
	switch contract.RenewalStatus {
	case model.SubscriptionRenewalStatusEnabled:
		result.CanCancel = true
	case model.SubscriptionRenewalStatusCancelledByUser:
		result.CanResume = true
		result.CancelAtPeriodEnd = true
	}
	return result
}
