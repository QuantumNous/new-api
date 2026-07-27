package service

import (
	"errors"
	"strings"

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
	var stripeBindingID int64
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		contract, err := loadRenewalLifecycleContractTx(tx, userID)
		if err != nil {
			return err
		}
		if contract.RenewalSource == model.SubscriptionRenewalSourceProvider {
			bindingID, err := validateStripeRenewalLifecycleTargetTx(tx, contract)
			if err != nil {
				return err
			}
			stripeBindingID = bindingID
			return nil
		}
		if contract.RenewalSource != model.SubscriptionRenewalSourceWallet {
			return errors.New("only wallet or provider recurring subscription renewal can be changed")
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
	if stripeBindingID > 0 {
		var binding *model.SubscriptionProviderBinding
		if toStatus == model.SubscriptionRenewalStatusCancelledByUser {
			binding, err = CancelStripeRecurringSubscription(userID, stripeBindingID)
		} else {
			binding, err = ResumeStripeRecurringSubscription(userID, stripeBindingID)
		}
		if err != nil {
			return nil, err
		}
		return buildStripeSubscriptionRenewalLifecycleResult(binding), nil
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
	if contract.RenewalSource == model.SubscriptionRenewalSourceProvider &&
		entitlement.ProviderBindingId != contract.CurrentProviderBindingId {
		return nil, errors.New("active current subscription entitlement binding mismatch")
	}
	return &contract, nil
}

func validateStripeRenewalLifecycleTargetTx(tx *gorm.DB, contract *model.UserSubscriptionContract) (int64, error) {
	if tx == nil || contract == nil {
		return 0, errors.New("invalid Stripe renewal target")
	}
	if contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return 0, errors.New("current subscription is not Stripe recurring")
	}
	if contract.CurrentProviderBindingId <= 0 {
		return 0, errors.New("current Stripe subscription binding is required")
	}
	var binding model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where("id = ?", contract.CurrentProviderBindingId).First(&binding).Error; err != nil {
		return 0, err
	}
	if binding.UserId != contract.UserId || binding.ContractId != contract.Id {
		return 0, errors.New("current active Stripe recurring contract binding mismatch")
	}
	if binding.Provider != model.PaymentProviderStripe {
		return 0, errors.New("recurring subscription is not managed by Stripe")
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" {
		return 0, errors.New("Stripe subscription binding is incomplete")
	}
	if isTerminalStripeSubscriptionStatus(binding.ProviderStatus) || binding.EndedAt > 0 {
		return 0, errors.New("current subscription is not active Stripe recurring")
	}
	var bindings []model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where(
		"user_id = ? AND provider = ? AND ended_at = ?",
		contract.UserId,
		model.PaymentProviderStripe,
		0,
	).Find(&bindings).Error; err != nil {
		return 0, err
	}
	nonTerminalRecurringBindings := 0
	for _, candidate := range bindings {
		if strings.TrimSpace(candidate.ProviderSubscriptionId) == "" || isTerminalStripeSubscriptionStatus(candidate.ProviderStatus) {
			continue
		}
		nonTerminalRecurringBindings++
	}
	if nonTerminalRecurringBindings > 1 {
		return 0, errors.New("multiple active Stripe recurring bindings require migration reconciliation")
	}
	return binding.Id, nil
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

func buildStripeSubscriptionRenewalLifecycleResult(binding *model.SubscriptionProviderBinding) *SubscriptionRenewalLifecycleResult {
	result := &SubscriptionRenewalLifecycleResult{
		RenewalSource:     model.SubscriptionRenewalSourceProvider,
		RenewalStatus:     model.SubscriptionRenewalStatusEnabled,
		CurrentPeriodEnd:  binding.CurrentPeriodEnd,
		CanCancel:         true,
		CancelAtPeriodEnd: binding.CancelAtPeriodEnd,
	}
	if binding.CancelAtPeriodEnd {
		result.RenewalStatus = model.SubscriptionRenewalStatusCancelledByUser
		result.CanCancel = false
		result.CanResume = true
	}
	return result
}
