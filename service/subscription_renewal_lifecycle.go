package service

import (
	"errors"
	"fmt"
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
	SyncPending       bool
}

var cancelCurrentStripeRecurringSubscription = CancelStripeRecurringSubscription
var resumeCurrentStripeRecurringSubscription = ResumeStripeRecurringSubscription

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
	var stripeBinding *model.SubscriptionProviderBinding
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		contract, err := loadRenewalLifecycleContractTx(tx, userID)
		if err != nil {
			return err
		}
		if contract.RenewalSource == model.SubscriptionRenewalSourceProvider {
			binding, err := validateStripeRenewalLifecycleTargetTx(tx, contract)
			if err != nil {
				return err
			}
			currentStatus := model.SubscriptionRenewalStatusEnabled
			if binding.CancelAtPeriodEnd {
				currentStatus = model.SubscriptionRenewalStatusCancelledByUser
			}
			if currentStatus == toStatus {
				return errors.New("subscription renewal status already matches requested state")
			}
			if currentStatus != fromStatus {
				return errors.New("subscription renewal status cannot be changed")
			}
			stripeBinding = binding
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
	if stripeBinding != nil {
		var binding *model.SubscriptionProviderBinding
		if toStatus == model.SubscriptionRenewalStatusCancelledByUser {
			binding, err = cancelCurrentStripeRecurringSubscription(userID, stripeBinding.Id)
		} else {
			binding, err = resumeCurrentStripeRecurringSubscription(userID, stripeBinding.Id)
		}
		if err != nil {
			if confirmedResult, ok := confirmStripeRenewalMutationAfterError(stripeBinding, toStatus, err); ok {
				return confirmedResult, nil
			}
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

func validateStripeRenewalLifecycleTargetTx(tx *gorm.DB, contract *model.UserSubscriptionContract) (*model.SubscriptionProviderBinding, error) {
	if tx == nil || contract == nil {
		return nil, errors.New("invalid Stripe renewal target")
	}
	if contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return nil, errors.New("current subscription is not Stripe recurring")
	}
	if contract.CurrentProviderBindingId <= 0 {
		return nil, errors.New("current Stripe subscription binding is required")
	}
	var binding model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where("id = ?", contract.CurrentProviderBindingId).First(&binding).Error; err != nil {
		return nil, err
	}
	if binding.UserId != contract.UserId || binding.ContractId != contract.Id {
		return nil, errors.New("current active Stripe recurring contract binding mismatch")
	}
	if binding.Provider != model.PaymentProviderStripe {
		return nil, errors.New("recurring subscription is not managed by Stripe")
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" {
		return nil, errors.New("Stripe subscription binding is incomplete")
	}
	if !isActionableStripeRenewalStatus(binding.ProviderStatus) || binding.EndedAt > 0 {
		return nil, errors.New("current subscription is not active Stripe recurring")
	}
	var bindings []model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where(
		"user_id = ? AND provider = ? AND ended_at = ?",
		contract.UserId,
		model.PaymentProviderStripe,
		0,
	).Find(&bindings).Error; err != nil {
		return nil, err
	}
	nonTerminalRecurringBindings := 0
	for _, candidate := range bindings {
		if strings.TrimSpace(candidate.ProviderSubscriptionId) == "" ||
			isTerminalStripeSubscriptionStatus(candidate.ProviderStatus) ||
			isIncompleteStripeSubscriptionStatus(candidate.ProviderStatus) {
			continue
		}
		nonTerminalRecurringBindings++
	}
	if nonTerminalRecurringBindings > 1 {
		return nil, errors.New("multiple active Stripe recurring bindings require migration reconciliation")
	}
	return &binding, nil
}

func confirmStripeRenewalMutationAfterError(
	binding *model.SubscriptionProviderBinding,
	toStatus string,
	mutationErr error,
) (*SubscriptionRenewalLifecycleResult, bool) {
	if binding == nil || mutationErr == nil {
		return nil, false
	}
	snapshot, err := stripeSubscriptionSnapshotGetter(binding.ProviderSubscriptionId)
	if err != nil || strings.TrimSpace(snapshot.ProviderSubscriptionId) != strings.TrimSpace(binding.ProviderSubscriptionId) {
		return nil, false
	}
	targetCancelAtPeriodEnd := toStatus == model.SubscriptionRenewalStatusCancelledByUser
	providerStatus := strings.ToLower(strings.TrimSpace(snapshot.ProviderStatus))
	terminal := isTerminalStripeSubscriptionStatus(providerStatus) || snapshot.EndedAt > 0
	if terminal {
		if !targetCancelAtPeriodEnd || providerStatus != "canceled" {
			return nil, false
		}
		result := &SubscriptionRenewalLifecycleResult{
			RenewalSource:    model.SubscriptionRenewalSourceProvider,
			RenewalStatus:    model.SubscriptionRenewalStatusCancelledByUser,
			CurrentPeriodEnd: snapshot.CurrentPeriodEnd,
			SyncPending:      true,
		}
		common.SysError(fmt.Sprintf(
			"Stripe renewal cancellation confirmed after local lifecycle failure: user_id=%d binding_id=%d err=%v",
			binding.UserId,
			binding.Id,
			mutationErr,
		))
		return result, true
	}
	if snapshot.CancelAtPeriodEnd != targetCancelAtPeriodEnd {
		return nil, false
	}
	confirmedBinding := *binding
	confirmedBinding.ProviderStatus = snapshot.ProviderStatus
	confirmedBinding.CancelAtPeriodEnd = snapshot.CancelAtPeriodEnd
	confirmedBinding.CurrentPeriodStart = snapshot.CurrentPeriodStart
	confirmedBinding.CurrentPeriodEnd = snapshot.CurrentPeriodEnd
	confirmedBinding.GracePeriodEnd = snapshot.GracePeriodEnd
	confirmedBinding.CanceledAt = snapshot.CanceledAt
	confirmedBinding.EndedAt = snapshot.EndedAt
	result := buildStripeSubscriptionRenewalLifecycleResult(&confirmedBinding)
	result.SyncPending = true
	common.SysError(fmt.Sprintf(
		"Stripe renewal mutation confirmed after local lifecycle failure: user_id=%d binding_id=%d cancel_at_period_end=%t err=%v",
		binding.UserId,
		binding.Id,
		snapshot.CancelAtPeriodEnd,
		mutationErr,
	))
	return result, true
}

func isIncompleteStripeSubscriptionStatus(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), "incomplete")
}

func isActionableStripeRenewalStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active", "trialing":
		return true
	default:
		return false
	}
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
		RenewalSource:    model.SubscriptionRenewalSourceProvider,
		CurrentPeriodEnd: binding.CurrentPeriodEnd,
	}
	providerStatus := strings.ToLower(strings.TrimSpace(binding.ProviderStatus))
	if providerStatus == "canceled" {
		result.RenewalStatus = model.SubscriptionRenewalStatusCancelledByUser
		return result
	}
	if !isActionableStripeRenewalStatus(providerStatus) {
		return result
	}
	result.RenewalStatus = model.SubscriptionRenewalStatusEnabled
	result.CanCancel = true
	result.CancelAtPeriodEnd = binding.CancelAtPeriodEnd
	if binding.CancelAtPeriodEnd {
		result.RenewalStatus = model.SubscriptionRenewalStatusCancelledByUser
		result.CanCancel = false
		result.CanResume = true
	}
	return result
}
