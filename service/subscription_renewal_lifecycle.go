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
		contractSnapshot, err := readRenewalLifecycleContractSnapshotTx(tx, userID)
		if err != nil {
			return err
		}
		if contractSnapshot.RenewalSource == model.SubscriptionRenewalSourceProvider {
			binding, _, err := lockStripeRenewalLifecycleBindingThenContractTx(tx, contractSnapshot)
			if err != nil {
				return err
			}
			currentStatus := model.SubscriptionRenewalStatusEnabled
			if binding.CancelAtPeriodEnd {
				currentStatus = model.SubscriptionRenewalStatusCancelledByUser
			}
			// Stripe already-at-target requests intentionally fail locally: an
			// opposite provider mutation may still be in flight. Wallet renewal is
			// fully local and row-locked, so its repeated actions remain idempotent.
			if currentStatus == toStatus {
				return errors.New("subscription renewal status already matches requested state")
			}
			if currentStatus != fromStatus {
				return errors.New("subscription renewal status cannot be changed")
			}
			stripeBinding = binding
			return nil
		}
		contract, err := loadRenewalLifecycleContractTx(tx, userID)
		if err != nil {
			return err
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
		update := tx.Model(&model.UserSubscriptionContract{}).
			Where("id = ? AND user_id = ? AND renewal_status = ?", contract.Id, userID, fromStatus).
			Update("renewal_status", toStatus)
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return errors.New("subscription renewal status cannot be changed")
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
		result := buildStripeSubscriptionRenewalLifecycleResult(binding)
		if result.RenewalStatus == "" {
			return nil, errors.New("current Stripe renewal state requires support")
		}
		return result, nil
	}
	return result, nil
}

func readRenewalLifecycleContractSnapshotTx(tx *gorm.DB, userID int) (*model.UserSubscriptionContract, error) {
	var contract model.UserSubscriptionContract
	if err := tx.Where("user_id = ?", userID).First(&contract).Error; err != nil {
		return nil, err
	}
	return &contract, nil
}

func lockStripeRenewalLifecycleBindingThenContractTx(tx *gorm.DB, contractSnapshot *model.UserSubscriptionContract) (*model.SubscriptionProviderBinding, *model.UserSubscriptionContract, error) {
	if tx == nil || contractSnapshot == nil {
		return nil, nil, errors.New("invalid Stripe renewal target")
	}
	if contractSnapshot.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return nil, nil, errors.New("current subscription is not Stripe recurring")
	}
	if contractSnapshot.CurrentProviderBindingId <= 0 {
		return nil, nil, errors.New("current Stripe subscription binding is required")
	}
	binding, err := lockStripeRenewalLifecycleBindingTx(tx, contractSnapshot.CurrentProviderBindingId, contractSnapshot.UserId)
	if err != nil {
		return nil, nil, err
	}
	contract, err := loadRenewalLifecycleContractByIDForConfirmationTx(tx, binding.ContractId, binding.UserId, false)
	if err != nil {
		return nil, nil, err
	}
	if contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return nil, nil, errors.New("current subscription is not Stripe recurring")
	}
	if contract.RenewalSource != model.SubscriptionRenewalSourceProvider {
		return nil, nil, errors.New("subscription renewal source changed")
	}
	if contract.Id != contractSnapshot.Id || contract.CurrentProviderBindingId != binding.Id {
		return nil, nil, errors.New("current active Stripe recurring contract binding mismatch")
	}
	if err := validateStripeRenewalLifecycleBindingForContractTx(tx, contract, binding, false, false); err != nil {
		return nil, nil, err
	}
	return binding, contract, nil
}

func lockStripeRenewalLifecycleBindingTx(tx *gorm.DB, bindingID int64, userID int) (*model.SubscriptionProviderBinding, error) {
	var binding model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", bindingID, userID).First(&binding).Error; err != nil {
		return nil, err
	}
	return &binding, nil
}

func loadRenewalLifecycleContractTx(tx *gorm.DB, userID int) (*model.UserSubscriptionContract, error) {
	return loadRenewalLifecycleContractForConfirmationTx(tx, userID, false)
}

func loadRenewalLifecycleContractForConfirmationTx(tx *gorm.DB, userID int, allowNeedsAttention bool) (*model.UserSubscriptionContract, error) {
	var contract model.UserSubscriptionContract
	if err := subscriptionCommandLock(tx).Where("user_id = ?", userID).First(&contract).Error; err != nil {
		return nil, err
	}
	if err := validateRenewalLifecycleContractForConfirmationTx(tx, &contract, allowNeedsAttention); err != nil {
		return nil, err
	}
	return &contract, nil
}

func loadRenewalLifecycleContractByIDForConfirmationTx(tx *gorm.DB, contractID int64, userID int, allowNeedsAttention bool) (*model.UserSubscriptionContract, error) {
	if contractID <= 0 {
		return nil, errors.New("current subscription contract is required")
	}
	var contract model.UserSubscriptionContract
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", contractID, userID).First(&contract).Error; err != nil {
		return nil, err
	}
	if err := validateRenewalLifecycleContractForConfirmationTx(tx, &contract, allowNeedsAttention); err != nil {
		return nil, err
	}
	return &contract, nil
}

func validateRenewalLifecycleContractForConfirmationTx(tx *gorm.DB, contract *model.UserSubscriptionContract, allowNeedsAttention bool) error {
	if tx == nil || contract == nil {
		return errors.New("current subscription contract is required")
	}
	if contract.Status != model.SubscriptionContractStatusActive &&
		(!allowNeedsAttention || contract.Status != model.SubscriptionContractStatusNeedsAttention) {
		return errors.New("active subscription contract is required")
	}
	now, err := subscriptionLifecycleDBTimestampTx(tx)
	if err != nil {
		return err
	}
	if contract.CurrentPeriodEnd <= now {
		return errors.New("current subscription period has expired")
	}
	if contract.CurrentEntitlementId <= 0 {
		return errors.New("current subscription entitlement is required")
	}
	var entitlement model.UserSubscription
	entitlementQuery := subscriptionCommandLock(tx).Where(
		"id = ? AND user_id = ? AND contract_id = ?",
		contract.CurrentEntitlementId,
		contract.UserId,
		contract.Id,
	).Limit(1).Find(&entitlement)
	if entitlementQuery.Error != nil {
		return entitlementQuery.Error
	}
	if entitlementQuery.RowsAffected != 1 {
		return errors.New("active current subscription entitlement is required")
	}
	if entitlement.Status != model.SubscriptionEntitlementStatusActive ||
		entitlement.EndTime <= now ||
		entitlement.AccessEndTime <= now ||
		entitlement.CurrentSlot == nil ||
		*entitlement.CurrentSlot != 1 {
		return errors.New("active current subscription entitlement is required")
	}
	if contract.RenewalSource == model.SubscriptionRenewalSourceProvider &&
		entitlement.ProviderBindingId != contract.CurrentProviderBindingId {
		return errors.New("active current subscription entitlement binding mismatch")
	}
	return nil
}

func validateStripeRenewalLifecycleTargetTx(tx *gorm.DB, contract *model.UserSubscriptionContract) (*model.SubscriptionProviderBinding, error) {
	return validateStripeRenewalLifecycleTargetForConfirmationTx(tx, contract, false, false)
}

func validateStripeRenewalLifecycleTargetForConfirmationTx(tx *gorm.DB, contract *model.UserSubscriptionContract, allowNonTerminalDegraded bool, allowTerminal bool) (*model.SubscriptionProviderBinding, error) {
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
	if err := validateStripeRenewalLifecycleBindingForContractTx(tx, contract, &binding, allowNonTerminalDegraded, allowTerminal); err != nil {
		return nil, err
	}
	return &binding, nil
}

func validateStripeRenewalLifecycleBindingForContractTx(tx *gorm.DB, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding, allowNonTerminalDegraded bool, allowTerminal bool) error {
	if tx == nil || contract == nil || binding == nil {
		return errors.New("invalid Stripe renewal target")
	}
	if binding.UserId != contract.UserId || binding.ContractId != contract.Id {
		return errors.New("current active Stripe recurring contract binding mismatch")
	}
	if binding.Provider != model.PaymentProviderStripe {
		return errors.New("recurring subscription is not managed by Stripe")
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" {
		return errors.New("Stripe subscription binding is incomplete")
	}
	terminal := binding.EndedAt > 0 || isTerminalStripeSubscriptionStatus(binding.ProviderStatus)
	if (!allowTerminal && terminal) ||
		isIncompleteStripeSubscriptionStatus(binding.ProviderStatus) ||
		(!allowNonTerminalDegraded && !isActionableStripeRenewalStatus(binding.ProviderStatus)) {
		return errors.New("current subscription is not active Stripe recurring")
	}
	var bindings []model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where(
		"user_id = ? AND provider = ? AND ended_at = ?",
		contract.UserId,
		model.PaymentProviderStripe,
		0,
	).Find(&bindings).Error; err != nil {
		return err
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
		return errors.New("multiple active Stripe recurring bindings require migration reconciliation")
	}
	return nil
}

func confirmStripeRenewalMutationAfterError(
	binding *model.SubscriptionProviderBinding,
	toStatus string,
	mutationErr error,
) (*SubscriptionRenewalLifecycleResult, bool) {
	if binding == nil || mutationErr == nil {
		return nil, false
	}
	action := model.SubscriptionProviderLifecycleActionResume
	if toStatus == model.SubscriptionRenewalStatusCancelledByUser {
		action = model.SubscriptionProviderLifecycleActionCancel
	}
	var lifecycleMutationErr *stripeSubscriptionLifecycleMutationError
	if !errors.As(mutationErr, &lifecycleMutationErr) || lifecycleMutationErr.reservation == nil {
		return nil, false
	}
	reservation := lifecycleMutationErr.reservation
	if reservation.Action != action {
		return nil, false
	}
	snapshot, err := stripeSubscriptionSnapshotGetter(binding.ProviderSubscriptionId)
	if err != nil || strings.TrimSpace(snapshot.ProviderSubscriptionId) != strings.TrimSpace(binding.ProviderSubscriptionId) {
		return nil, false
	}
	targetCancelAtPeriodEnd := toStatus == model.SubscriptionRenewalStatusCancelledByUser
	providerStatus := strings.ToLower(strings.TrimSpace(snapshot.ProviderStatus))
	terminal := isTerminalStripeSubscriptionStatus(providerStatus) || snapshot.EndedAt > 0
	if !terminal && !isActionableStripeRenewalStatus(providerStatus) {
		return nil, false
	}
	currentBinding, current := currentStripeRenewalMutationTarget(binding, reservation)
	if !current && terminal && action == model.SubscriptionProviderLifecycleActionCancel {
		currentBinding, current = terminalStripeRenewalMutationTarget(binding, reservation)
	}
	if !current {
		return nil, false
	}
	if terminal {
		if action != model.SubscriptionProviderLifecycleActionCancel {
			return nil, false
		}
		if providerStatus != "canceled" {
			return nil, false
		}
		if currentBinding.LifecycleReservationUntil == 0 &&
			strings.EqualFold(currentBinding.ProviderStatus, "canceled") {
			result := buildStripeTerminalCancellationRenewalLifecycleResult(currentBinding)
			if result.RenewalStatus == "" {
				return nil, false
			}
			return result, true
		}
		updated, applyErr := model.ApplyProviderSubscriptionTerminationWithReservation(reservation, snapshot)
		if applyErr != nil {
			return nil, false
		}
		result := buildStripeTerminalCancellationRenewalLifecycleResult(updated)
		if result.RenewalStatus == "" {
			return nil, false
		}
		return result, true
	}
	if snapshot.CancelAtPeriodEnd != targetCancelAtPeriodEnd {
		return nil, false
	}
	if currentBinding.LifecycleReservationUntil == 0 {
		if currentBinding.CancelAtPeriodEnd != targetCancelAtPeriodEnd {
			return nil, false
		}
		result := buildStripeSubscriptionRenewalLifecycleResult(currentBinding)
		if result.RenewalStatus == "" {
			return nil, false
		}
		common.SysError(fmt.Sprintf(
			"Stripe renewal mutation confirmed from consumed local lifecycle state: user_id=%d binding_id=%d cancel_at_period_end=%t err=%v",
			binding.UserId,
			binding.Id,
			snapshot.CancelAtPeriodEnd,
			mutationErr,
		))
		return result, true
	}
	updated, applyErr := model.ApplyProviderSubscriptionLifecycleSnapshotStrictWithReservation(reservation, snapshot)
	if applyErr != nil {
		return nil, false
	}
	result := buildStripeSubscriptionRenewalLifecycleResult(updated)
	if result.RenewalStatus == "" {
		return nil, false
	}
	common.SysError(fmt.Sprintf(
		"Stripe renewal mutation persisted after local lifecycle failure: user_id=%d binding_id=%d cancel_at_period_end=%t err=%v",
		binding.UserId,
		binding.Id,
		snapshot.CancelAtPeriodEnd,
		mutationErr,
	))
	return result, true
}

func terminalStripeRenewalMutationTarget(binding *model.SubscriptionProviderBinding, reservation *model.SubscriptionProviderLifecycleReservation) (*model.SubscriptionProviderBinding, bool) {
	if binding == nil ||
		reservation == nil ||
		reservation.Action != model.SubscriptionProviderLifecycleActionCancel {
		return nil, false
	}
	var fresh model.SubscriptionProviderBinding
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", binding.Id, binding.UserId).First(&fresh).Error; err != nil {
			return err
		}
		if err := validateTerminalStripeRenewalBindingContractTx(tx, binding, &fresh); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, false
	}
	reservationMatches := fresh.LifecycleActionSeq == reservation.LifecycleActionSeq &&
		strings.TrimSpace(fresh.LifecycleReservationToken) == strings.TrimSpace(reservation.Token) &&
		strings.TrimSpace(fresh.LifecycleReservationAction) == strings.TrimSpace(reservation.Action) &&
		fresh.LifecycleReservationUntil == 0
	reservationClearedByPassiveTerminalApply := strings.TrimSpace(fresh.LifecycleReservationToken) == "" &&
		strings.TrimSpace(fresh.LifecycleReservationAction) == "" &&
		fresh.LifecycleReservationUntil == 0
	if fresh.Id != binding.Id ||
		strings.TrimSpace(fresh.ProviderSubscriptionId) != strings.TrimSpace(binding.ProviderSubscriptionId) ||
		(!reservationMatches && !reservationClearedByPassiveTerminalApply) ||
		!strings.EqualFold(fresh.ProviderStatus, "canceled") {
		return nil, false
	}
	return &fresh, true
}

func currentStripeRenewalMutationTarget(binding *model.SubscriptionProviderBinding, reservation *model.SubscriptionProviderLifecycleReservation) (*model.SubscriptionProviderBinding, bool) {
	if binding == nil {
		return nil, false
	}
	var currentBinding model.SubscriptionProviderBinding
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		allowNeedsAttention := reservation != nil && reservation.Action == model.SubscriptionProviderLifecycleActionCancel
		allowTerminal := allowNeedsAttention
		if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", binding.Id, binding.UserId).First(&currentBinding).Error; err != nil {
			return err
		}
		contract, err := loadRenewalLifecycleContractByIDForConfirmationTx(tx, currentBinding.ContractId, binding.UserId, allowNeedsAttention)
		if err != nil {
			if allowTerminal {
				return loadTerminalStripeRenewalMutationTargetTx(tx, binding, reservation, &currentBinding)
			}
			return err
		}
		if contract.RenewalSource != model.SubscriptionRenewalSourceProvider || contract.CurrentProviderBindingId != binding.Id {
			return errors.New("subscription renewal target changed")
		}
		if currentBinding.UserId != contract.UserId ||
			currentBinding.ContractId != contract.Id ||
			currentBinding.Provider != model.PaymentProviderStripe ||
			strings.TrimSpace(currentBinding.ProviderSubscriptionId) == "" ||
			(!allowTerminal && (currentBinding.EndedAt > 0 || isTerminalStripeSubscriptionStatus(currentBinding.ProviderStatus))) ||
			isIncompleteStripeSubscriptionStatus(currentBinding.ProviderStatus) ||
			(!allowNeedsAttention && !isActionableStripeRenewalStatus(currentBinding.ProviderStatus)) {
			return errors.New("current subscription is not active Stripe recurring")
		}
		if currentBinding.Id != binding.Id ||
			strings.TrimSpace(currentBinding.ProviderSubscriptionId) != strings.TrimSpace(binding.ProviderSubscriptionId) {
			return errors.New("subscription renewal target changed")
		}
		if reservation != nil {
			if currentBinding.LifecycleActionSeq != reservation.LifecycleActionSeq ||
				currentBinding.LifecycleReservationToken != reservation.Token ||
				currentBinding.LifecycleReservationAction != reservation.Action ||
				(currentBinding.LifecycleReservationUntil != reservation.ExpiresAt && currentBinding.LifecycleReservationUntil != 0) {
				return errors.New("subscription renewal reservation changed")
			}
		} else if currentBinding.LifecycleActionSeq != binding.LifecycleActionSeq {
			return errors.New("subscription renewal target changed")
		}
		return nil
	})
	if err != nil {
		return nil, false
	}
	return &currentBinding, true
}

func loadTerminalStripeRenewalMutationTargetTx(tx *gorm.DB, binding *model.SubscriptionProviderBinding, reservation *model.SubscriptionProviderLifecycleReservation, currentBinding *model.SubscriptionProviderBinding) error {
	if tx == nil || binding == nil || reservation == nil || currentBinding == nil {
		return errors.New("invalid terminal Stripe renewal target")
	}
	var terminalBinding model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", binding.Id, binding.UserId).First(&terminalBinding).Error; err != nil {
		return err
	}
	if terminalBinding.Provider != model.PaymentProviderStripe ||
		strings.TrimSpace(terminalBinding.ProviderSubscriptionId) != strings.TrimSpace(binding.ProviderSubscriptionId) ||
		(terminalBinding.EndedAt <= 0 && !isTerminalStripeSubscriptionStatus(terminalBinding.ProviderStatus)) {
		return errors.New("subscription renewal target changed")
	}
	if err := validateTerminalStripeRenewalBindingContractTx(tx, binding, &terminalBinding); err != nil {
		return err
	}
	if terminalBinding.LifecycleActionSeq != reservation.LifecycleActionSeq ||
		terminalBinding.LifecycleReservationToken != reservation.Token ||
		terminalBinding.LifecycleReservationAction != reservation.Action ||
		(terminalBinding.LifecycleReservationUntil != reservation.ExpiresAt && terminalBinding.LifecycleReservationUntil != 0) {
		return errors.New("subscription renewal reservation changed")
	}
	*currentBinding = terminalBinding
	return nil
}

func validateTerminalStripeRenewalBindingContractTx(tx *gorm.DB, original *model.SubscriptionProviderBinding, fresh *model.SubscriptionProviderBinding) error {
	if tx == nil || original == nil || fresh == nil || fresh.ContractId <= 0 || fresh.ContractId != original.ContractId {
		return errors.New("subscription renewal target changed")
	}
	var contract model.UserSubscriptionContract
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", fresh.ContractId, fresh.UserId).First(&contract).Error; err != nil {
		return err
	}
	if contract.Id != original.ContractId || contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return errors.New("subscription renewal target changed")
	}
	if contract.CurrentProviderBindingId == fresh.Id {
		return nil
	}
	if contract.Status == model.SubscriptionContractStatusEnded && contract.CurrentProviderBindingId == 0 {
		return nil
	}
	return errors.New("subscription renewal target changed")
}

func isIncompleteStripeSubscriptionStatus(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), "incomplete")
}

func isActionableStripeRenewalStatus(status string) bool {
	// Unified self-service renewal deliberately fails closed for degraded
	// provider states. The lower-level past_due termination path remains for
	// explicit administrative and compatibility flows, not wallet controls.
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
	if binding.EndedAt > 0 || isTerminalStripeSubscriptionStatus(providerStatus) || !isActionableStripeRenewalStatus(providerStatus) {
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

func buildStripeTerminalCancellationRenewalLifecycleResult(binding *model.SubscriptionProviderBinding) *SubscriptionRenewalLifecycleResult {
	result := &SubscriptionRenewalLifecycleResult{
		RenewalSource:    model.SubscriptionRenewalSourceProvider,
		CurrentPeriodEnd: binding.CurrentPeriodEnd,
	}
	if binding.EndedAt <= 0 || !strings.EqualFold(strings.TrimSpace(binding.ProviderStatus), "canceled") {
		return result
	}
	result.RenewalStatus = model.SubscriptionRenewalStatusCancelledByUser
	result.CancelAtPeriodEnd = true
	return result
}
