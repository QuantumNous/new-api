package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type SubscriptionRenewalLifecycleResult struct {
	RenewalSource     string
	RenewalStatus     string
	CurrentPeriodEnd  int64
	ChangeVersion     int64
	CanCancel         bool
	CanResume         bool
	CancelAtPeriodEnd bool
}

type SubscriptionRenewalLifecyclePrecondition struct {
	ExpectedContractID       int64
	ExpectedChangeVersion    int64
	ExpectedCurrentPeriodEnd int64
	ExpectedRenewalSource    string
	ExpectedRenewalStatus    string
}

var cancelCurrentStripeRecurringSubscription = cancelCurrentStripeRecurringSubscriptionWithGuard
var resumeCurrentStripeRecurringSubscription = resumeCurrentStripeRecurringSubscriptionWithGuard

type currentStripeRenewalLifecycleMutationGuard struct {
	action       string
	precondition SubscriptionRenewalLifecyclePrecondition
	reservation  *model.SubscriptionProviderLifecycleReservation
}

func CancelCurrentSubscriptionRenewal(userID int, precondition SubscriptionRenewalLifecyclePrecondition) (*SubscriptionRenewalLifecycleResult, error) {
	return updateCurrentSubscriptionRenewal(userID, model.SubscriptionRenewalStatusEnabled, model.SubscriptionRenewalStatusCancelledByUser, precondition)
}

func ResumeCurrentSubscriptionRenewal(userID int, precondition SubscriptionRenewalLifecyclePrecondition) (*SubscriptionRenewalLifecycleResult, error) {
	return updateCurrentSubscriptionRenewal(userID, model.SubscriptionRenewalStatusCancelledByUser, model.SubscriptionRenewalStatusEnabled, precondition)
}

func updateCurrentSubscriptionRenewal(userID int, fromStatus string, toStatus string, precondition SubscriptionRenewalLifecyclePrecondition) (*SubscriptionRenewalLifecycleResult, error) {
	if userID <= 0 {
		return nil, errors.New("invalid user id")
	}
	if err := validateSubscriptionRenewalLifecyclePreconditionInput(precondition); err != nil {
		return nil, err
	}
	if strings.TrimSpace(precondition.ExpectedRenewalStatus) != fromStatus {
		return nil, errors.New("subscription renewal precondition conflict")
	}
	var result *SubscriptionRenewalLifecycleResult
	var stripeBinding *model.SubscriptionProviderBinding
	var stripeReservation *model.SubscriptionProviderLifecycleReservation
	var stripeChangeVersion int64
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		contractSnapshot, err := readRenewalLifecycleContractSnapshotTx(tx, userID)
		if err != nil {
			return err
		}
		if contractSnapshot.RenewalSource == model.SubscriptionRenewalSourceProvider {
			binding, contract, err := lockStripeRenewalLifecycleBindingThenContractTx(tx, contractSnapshot)
			if err != nil {
				return err
			}
			currentStatus := model.SubscriptionRenewalStatusEnabled
			if binding.CancelAtPeriodEnd {
				currentStatus = model.SubscriptionRenewalStatusCancelledByUser
			}
			if err := validateSubscriptionRenewalLifecyclePrecondition(contract, currentStatus, precondition); err != nil {
				return err
			}
			var replaceableDowngradeBinding *model.SubscriptionProviderBinding
			if toStatus == model.SubscriptionRenewalStatusCancelledByUser {
				replaceableDowngradeBinding = binding
			}
			if err := rejectUnresolvedRenewalPlanChangeTx(tx, userID, replaceableDowngradeBinding); err != nil {
				return err
			}
			token, err := common.GenerateRandomCharsKey(32)
			if err != nil {
				return err
			}
			action := model.SubscriptionProviderLifecycleActionResume
			if toStatus == model.SubscriptionRenewalStatusCancelledByUser {
				action = model.SubscriptionProviderLifecycleActionCancel
			}
			reservation, reservedBinding, err := model.ReserveSubscriptionProviderLifecycleExactTx(
				tx,
				binding,
				action,
				token,
				int64(stripeSubscriptionLifecycleReservationTTL/time.Second),
			)
			if err != nil {
				return err
			}
			update := tx.Model(&model.UserSubscriptionContract{}).
				Where("id = ? AND user_id = ? AND renewal_source = ? AND current_provider_binding_id = ? AND change_version = ?",
					contract.Id,
					userID,
					model.SubscriptionRenewalSourceProvider,
					binding.Id,
					precondition.ExpectedChangeVersion,
				).
				Update("change_version", gorm.Expr("change_version + ?", 1))
			if update.Error != nil {
				return update.Error
			}
			if update.RowsAffected != 1 {
				return errors.New("subscription renewal precondition conflict")
			}
			contract.ChangeVersion++
			stripeBinding = reservedBinding
			stripeReservation = reservation
			stripeChangeVersion = contract.ChangeVersion
			return nil
		}
		contract, err := loadRenewalLifecycleContractTx(tx, userID)
		if err != nil {
			return err
		}
		if contract.RenewalSource != model.SubscriptionRenewalSourceWallet {
			return errors.New("only wallet or provider recurring subscription renewal can be changed")
		}
		if err := validateSubscriptionRenewalLifecyclePrecondition(contract, contract.RenewalStatus, precondition); err != nil {
			return err
		}
		if err := rejectUnresolvedPlanChangeTx(tx, userID); err != nil {
			return err
		}
		update := tx.Model(&model.UserSubscriptionContract{}).
			Where("id = ? AND user_id = ? AND renewal_status = ? AND change_version = ?", contract.Id, userID, fromStatus, precondition.ExpectedChangeVersion).
			Updates(map[string]interface{}{
				"renewal_status": toStatus,
				"change_version": gorm.Expr("change_version + ?", 1),
			})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != 1 {
			return errors.New("subscription renewal status cannot be changed")
		}
		contract.RenewalStatus = toStatus
		contract.ChangeVersion++
		result = buildSubscriptionRenewalLifecycleResult(contract)
		return nil
	})
	if err != nil {
		return nil, err
	}
	if stripeBinding != nil {
		var binding *model.SubscriptionProviderBinding
		stripeMutationPrecondition := precondition
		stripeMutationPrecondition.ExpectedChangeVersion = stripeChangeVersion
		if toStatus == model.SubscriptionRenewalStatusCancelledByUser {
			binding, err = withCurrentStripeRenewalLifecycleMutationGuard(
				userID,
				stripeBinding.Id,
				model.SubscriptionProviderLifecycleActionCancel,
				stripeMutationPrecondition,
				stripeReservation,
				func(guard *currentStripeRenewalLifecycleMutationGuard) (*model.SubscriptionProviderBinding, error) {
					return cancelCurrentStripeRecurringSubscription(userID, stripeBinding.Id, guard)
				},
			)
		} else {
			binding, err = withCurrentStripeRenewalLifecycleMutationGuard(
				userID,
				stripeBinding.Id,
				model.SubscriptionProviderLifecycleActionResume,
				stripeMutationPrecondition,
				stripeReservation,
				func(guard *currentStripeRenewalLifecycleMutationGuard) (*model.SubscriptionProviderBinding, error) {
					return resumeCurrentStripeRecurringSubscription(userID, stripeBinding.Id, guard)
				},
			)
		}
		if err != nil {
			if confirmedResult, ok := confirmStripeRenewalMutationAfterError(stripeBinding, toStatus, err); ok {
				if versionErr := validateConfirmedStripeRenewalChangeVersion(stripeBinding, stripeChangeVersion); versionErr != nil {
					return nil, versionErr
				}
				confirmedResult.ChangeVersion = stripeChangeVersion
				return confirmedResult, nil
			}
			return nil, err
		}
		result := buildStripeSubscriptionRenewalLifecycleResult(binding)
		result.ChangeVersion = stripeChangeVersion
		if result.RenewalStatus == "" {
			return nil, releaseStripeRenewalLifecycleReservationAfterUnsupportedResult(stripeReservation, errors.New("current Stripe renewal state requires support"))
		}
		return result, nil
	}
	return result, nil
}

func validateSubscriptionRenewalLifecyclePreconditionInput(precondition SubscriptionRenewalLifecyclePrecondition) error {
	if precondition.ExpectedContractID <= 0 ||
		precondition.ExpectedChangeVersion < 0 ||
		precondition.ExpectedCurrentPeriodEnd <= 0 ||
		strings.TrimSpace(precondition.ExpectedRenewalSource) == "" ||
		strings.TrimSpace(precondition.ExpectedRenewalStatus) == "" {
		return errors.New("subscription renewal precondition is required")
	}
	return nil
}

func rejectUnresolvedRenewalPlanChangeTx(tx *gorm.DB, userID int, replaceableDowngradeBinding *model.SubscriptionProviderBinding) error {
	kinds := []string{
		model.SubscriptionChangeIntentKindPurchase,
		model.SubscriptionChangeIntentKindRepurchase,
		model.SubscriptionChangeIntentKindUpgrade,
	}
	if replaceableDowngradeBinding == nil {
		kinds = append(kinds, model.SubscriptionChangeIntentKindDowngrade)
	}
	var count int64
	query := tx.Model(&model.SubscriptionChangeIntent{}).
		Where("user_id = ? AND kind IN ? AND status IN ?",
			userID,
			kinds,
			[]string{
				model.SubscriptionChangeIntentStatusCreated,
				model.SubscriptionChangeIntentStatusSyncing,
				model.SubscriptionChangeIntentStatusAwaitingPayment,
				model.SubscriptionChangeIntentStatusScheduled,
				model.SubscriptionChangeIntentStatusCompensationRequired,
			},
		).
		Count(&count)
	if query.Error != nil {
		return query.Error
	}
	if count > 0 {
		return ErrSubscriptionChangeInProgress
	}
	if replaceableDowngradeBinding == nil {
		return nil
	}
	if replaceableDowngradeBinding.Id <= 0 ||
		replaceableDowngradeBinding.UserId != userID ||
		replaceableDowngradeBinding.ContractId <= 0 {
		return ErrSubscriptionChangeInProgress
	}
	query = tx.Model(&model.SubscriptionChangeIntent{}).
		Where("user_id = ? AND kind = ?", userID, model.SubscriptionChangeIntentKindDowngrade).
		Where("status IN ? OR (status = ? AND (provider_binding_id <> ? OR contract_id <> ?))",
			[]string{
				model.SubscriptionChangeIntentStatusCreated,
				model.SubscriptionChangeIntentStatusSyncing,
				model.SubscriptionChangeIntentStatusAwaitingPayment,
				model.SubscriptionChangeIntentStatusCompensationRequired,
			},
			model.SubscriptionChangeIntentStatusScheduled,
			replaceableDowngradeBinding.Id,
			replaceableDowngradeBinding.ContractId,
		).
		Count(&count)
	if query.Error != nil {
		return query.Error
	}
	if count > 0 {
		return ErrSubscriptionChangeInProgress
	}
	return nil
}

func validateSubscriptionRenewalLifecyclePrecondition(contract *model.UserSubscriptionContract, currentStatus string, precondition SubscriptionRenewalLifecyclePrecondition) error {
	return validateSubscriptionRenewalLifecyclePreconditionWithStatuses(contract, currentStatus, precondition, []string{precondition.ExpectedRenewalStatus})
}

func validateSubscriptionRenewalLifecyclePreconditionWithStatuses(contract *model.UserSubscriptionContract, currentStatus string, precondition SubscriptionRenewalLifecyclePrecondition, allowedStatuses []string) error {
	if contract == nil || contract.Id <= 0 {
		return errors.New("current subscription contract is required")
	}
	if contract.Id != precondition.ExpectedContractID ||
		contract.ChangeVersion != precondition.ExpectedChangeVersion ||
		contract.CurrentPeriodEnd != precondition.ExpectedCurrentPeriodEnd ||
		strings.TrimSpace(contract.RenewalSource) != strings.TrimSpace(precondition.ExpectedRenewalSource) {
		return errors.New("subscription renewal precondition conflict")
	}
	trimmedCurrentStatus := strings.TrimSpace(currentStatus)
	for _, allowedStatus := range allowedStatuses {
		if trimmedCurrentStatus == strings.TrimSpace(allowedStatus) {
			return nil
		}
	}
	return errors.New("subscription renewal precondition conflict")
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

func validateConfirmedStripeRenewalChangeVersion(binding *model.SubscriptionProviderBinding, expectedChangeVersion int64) error {
	if binding == nil || binding.ContractId <= 0 || binding.UserId <= 0 || expectedChangeVersion < 0 {
		return errors.New("subscription renewal precondition conflict")
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var contract model.UserSubscriptionContract
		if err := subscriptionCommandLock(tx).
			Where("id = ? AND user_id = ?", binding.ContractId, binding.UserId).
			First(&contract).Error; err != nil {
			return err
		}
		if contract.ChangeVersion != expectedChangeVersion {
			return errors.New("subscription renewal precondition conflict")
		}
		return nil
	})
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
		ChangeVersion:    contract.ChangeVersion,
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

func withCurrentStripeRenewalLifecycleMutationGuard(
	userID int,
	bindingID int64,
	action string,
	precondition SubscriptionRenewalLifecyclePrecondition,
	reservation *model.SubscriptionProviderLifecycleReservation,
	mutate func(*currentStripeRenewalLifecycleMutationGuard) (*model.SubscriptionProviderBinding, error),
) (*model.SubscriptionProviderBinding, error) {
	if mutate == nil {
		return nil, errors.New("subscription renewal mutation is required")
	}
	if userID <= 0 || bindingID <= 0 {
		return nil, errors.New("invalid subscription renewal mutation target")
	}
	guard := &currentStripeRenewalLifecycleMutationGuard{
		action:       strings.TrimSpace(action),
		precondition: precondition,
		reservation:  reservation,
	}
	return mutate(guard)
}

func validateCurrentStripeRenewalLifecycleMutationGuard(binding *model.SubscriptionProviderBinding, reservation *model.SubscriptionProviderLifecycleReservation, allowReplaceableDowngrade bool, guard *currentStripeRenewalLifecycleMutationGuard) error {
	if reservation == nil {
		return nil
	}
	return validateCurrentStripeRenewalLifecycleMutationGuardForAction(binding, reservation.Action, allowReplaceableDowngrade, guard)
}

func currentStripeRenewalGuardReservation(guard *currentStripeRenewalLifecycleMutationGuard, action string) *model.SubscriptionProviderLifecycleReservation {
	if guard == nil || guard.reservation == nil {
		return nil
	}
	if strings.TrimSpace(guard.action) != strings.TrimSpace(action) ||
		strings.TrimSpace(guard.reservation.Action) != strings.TrimSpace(action) {
		return nil
	}
	return guard.reservation
}

func subscriptionRenewalReservationMatchesBinding(reservation *model.SubscriptionProviderLifecycleReservation, binding *model.SubscriptionProviderBinding) bool {
	return reservation != nil &&
		binding != nil &&
		reservation.BindingId == binding.Id &&
		reservation.UserId == binding.UserId &&
		reservation.ContractId == binding.ContractId &&
		strings.TrimSpace(reservation.ProviderSubscriptionId) == strings.TrimSpace(binding.ProviderSubscriptionId)
}

func validateCurrentStripeRenewalLifecycleMutationGuardForAction(binding *model.SubscriptionProviderBinding, action string, allowReplaceableDowngrade bool, guard *currentStripeRenewalLifecycleMutationGuard) error {
	return validateCurrentStripeRenewalLifecycleMutationGuardForActionWithStatuses(binding, action, allowReplaceableDowngrade, guard, nil)
}

func validateCurrentStripeRenewalLifecycleSatisfiedMutationGuardForAction(binding *model.SubscriptionProviderBinding, action string, allowReplaceableDowngrade bool, guard *currentStripeRenewalLifecycleMutationGuard) error {
	if guard == nil {
		return nil
	}
	targetStatus := targetRenewalStatusForProviderLifecycleAction(action)
	if targetStatus == "" {
		return errors.New("subscription renewal precondition conflict")
	}
	return validateCurrentStripeRenewalLifecycleMutationGuardForActionWithStatuses(
		binding,
		action,
		allowReplaceableDowngrade,
		guard,
		[]string{guard.precondition.ExpectedRenewalStatus, targetStatus},
	)
}

func targetRenewalStatusForProviderLifecycleAction(action string) string {
	switch strings.TrimSpace(action) {
	case model.SubscriptionProviderLifecycleActionCancel:
		return model.SubscriptionRenewalStatusCancelledByUser
	case model.SubscriptionProviderLifecycleActionResume:
		return model.SubscriptionRenewalStatusEnabled
	default:
		return ""
	}
}

func validateCurrentStripeRenewalLifecycleMutationGuardForActionWithStatuses(binding *model.SubscriptionProviderBinding, action string, allowReplaceableDowngrade bool, guard *currentStripeRenewalLifecycleMutationGuard, allowedStatuses []string) error {
	if binding == nil || guard == nil {
		return nil
	}
	if strings.TrimSpace(action) == "" || strings.TrimSpace(guard.action) != strings.TrimSpace(action) {
		return errors.New("subscription renewal precondition conflict")
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		freshBinding, err := lockStripeRenewalLifecycleBindingTx(tx, binding.Id, binding.UserId)
		if err != nil {
			return err
		}
		contract, err := loadRenewalLifecycleContractByIDForConfirmationTx(tx, freshBinding.ContractId, freshBinding.UserId, false)
		if err != nil {
			return err
		}
		if contract.RenewalSource != model.SubscriptionRenewalSourceProvider ||
			contract.CurrentProviderBindingId != freshBinding.Id {
			return errors.New("subscription renewal precondition conflict")
		}
		if err := validateStripeRenewalLifecycleBindingForContractTx(tx, contract, freshBinding, false, false); err != nil {
			return err
		}
		currentStatus := model.SubscriptionRenewalStatusEnabled
		if freshBinding.CancelAtPeriodEnd {
			currentStatus = model.SubscriptionRenewalStatusCancelledByUser
		}
		if guard.reservation != nil {
			if !subscriptionRenewalReservationMatchesBinding(guard.reservation, freshBinding) ||
				freshBinding.LifecycleActionSeq != guard.reservation.LifecycleActionSeq ||
				strings.TrimSpace(freshBinding.LifecycleReservationToken) != strings.TrimSpace(guard.reservation.Token) ||
				strings.TrimSpace(freshBinding.LifecycleReservationAction) != strings.TrimSpace(guard.reservation.Action) ||
				freshBinding.LifecycleReservationUntil != guard.reservation.ExpiresAt {
				return errors.New("subscription renewal reservation changed")
			}
			now, err := subscriptionLifecycleDBTimestampTx(tx)
			if err != nil {
				return err
			}
			if freshBinding.LifecycleReservationUntil <= now {
				return errors.New("subscription renewal reservation changed")
			}
		}
		if len(allowedStatuses) == 0 {
			allowedStatuses = []string{guard.precondition.ExpectedRenewalStatus}
		}
		if err := validateSubscriptionRenewalLifecycleMutationGuardPrecondition(contract, currentStatus, guard.precondition, allowedStatuses); err != nil {
			return err
		}
		var replaceableDowngradeBinding *model.SubscriptionProviderBinding
		if allowReplaceableDowngrade {
			replaceableDowngradeBinding = freshBinding
		}
		return rejectUnresolvedRenewalPlanChangeTx(tx, freshBinding.UserId, replaceableDowngradeBinding)
	})
}

func validateSubscriptionRenewalLifecycleMutationGuardPrecondition(contract *model.UserSubscriptionContract, currentStatus string, precondition SubscriptionRenewalLifecyclePrecondition, allowedStatuses []string) error {
	return validateSubscriptionRenewalLifecyclePreconditionWithStatuses(contract, currentStatus, precondition, allowedStatuses)
}

func releaseStripeRenewalLifecycleReservationAfterGuardConflict(reservation *model.SubscriptionProviderLifecycleReservation, guardErr error) error {
	if guardErr == nil {
		return nil
	}
	if reservation == nil {
		return guardErr
	}
	if releaseErr := model.ReleaseSubscriptionProviderLifecycleReservation(reservation); releaseErr != nil {
		return fmt.Errorf("%w; failed to release lifecycle reservation: %v", guardErr, releaseErr)
	}
	return guardErr
}

func abandonStripeRenewalLifecycleReservationAfterGuardConflict(reservation *model.SubscriptionProviderLifecycleReservation, guardErr error) error {
	if guardErr == nil {
		return nil
	}
	if reservation == nil {
		return guardErr
	}
	if releaseErr := model.AbandonSubscriptionProviderLifecycleReservationBeforeProviderCall(reservation); releaseErr != nil {
		return fmt.Errorf("%w; failed to release lifecycle reservation: %v", guardErr, releaseErr)
	}
	return guardErr
}

func releaseStripeRenewalLifecycleReservationAfterUnsupportedResult(reservation *model.SubscriptionProviderLifecycleReservation, resultErr error) error {
	if resultErr == nil || reservation == nil {
		return resultErr
	}
	if err := model.ReleaseSubscriptionProviderLifecycleReservation(reservation); err != nil {
		return fmt.Errorf("%w; failed to release lifecycle reservation: %v", resultErr, err)
	}
	return resultErr
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
