package service

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	SubscriptionMigrationClassificationNoActive                   = "no-active"
	SubscriptionMigrationClassificationOneVerifiedRecurring       = "one verified recurring"
	SubscriptionMigrationClassificationOneOnePeriodEntitlement    = "one one-period entitlement"
	SubscriptionMigrationClassificationMultipleActiveEntitlements = "multiple active entitlements"
	SubscriptionMigrationClassificationMultipleRecurringBindings  = "multiple recurring bindings"
	SubscriptionMigrationClassificationMissingBinding             = "missing binding"
	SubscriptionMigrationClassificationGroupAmbiguity             = "group ambiguity"
)

var ErrSubscriptionMigrationRequiresAdmin = errors.New("subscription migration requires administrator review")

type SubscriptionMigrationReport struct {
	Results []SubscriptionMigrationResult
	Counts  map[string]int
}

func (r SubscriptionMigrationReport) Count(classification string) int {
	if r.Counts == nil {
		return 0
	}
	return r.Counts[classification]
}

type SubscriptionMigrationResult struct {
	UserID         int
	Classification string
	Backfilled     bool
	Reason         string
}

func AuditLegacySubscriptions() (*SubscriptionMigrationReport, error) {
	report := &SubscriptionMigrationReport{Counts: map[string]int{}}
	var userIDs []int
	if err := model.DB.Model(&model.UserSubscription{}).Select("user_id").Group("user_id").Find(&userIDs).Error; err != nil {
		return nil, err
	}
	var bindingUserIDs []int
	if err := model.DB.Model(&model.SubscriptionProviderBinding{}).Select("user_id").Group("user_id").Find(&bindingUserIDs).Error; err != nil {
		return nil, err
	}
	seen := map[int]bool{}
	for _, userID := range append(userIDs, bindingUserIDs...) {
		if userID <= 0 || seen[userID] {
			continue
		}
		seen[userID] = true
		result, err := auditLegacySubscriptionForUser(userID)
		if err != nil {
			return nil, err
		}
		report.Results = append(report.Results, result)
		report.Counts[result.Classification]++
	}
	logSubscriptionMigrationReport(*report)
	return report, nil
}

func auditLegacySubscriptionForUser(userID int) (SubscriptionMigrationResult, error) {
	var result SubscriptionMigrationResult
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = auditLegacySubscriptionForUserTx(tx, userID)
		return err
	})
	return result, err
}

func AuditLegacySubscriptionForUser(userID int) (SubscriptionMigrationResult, error) {
	return auditLegacySubscriptionForUser(userID)
}

func IsLegacySubscriptionMigrationBlocking(classification string) bool {
	return legacySubscriptionMigrationBlocksWrite(classification)
}

func auditLegacySubscriptionForUserTx(tx *gorm.DB, userID int) (SubscriptionMigrationResult, error) {
	result := SubscriptionMigrationResult{UserID: userID}
	if userID <= 0 {
		result.Classification = SubscriptionMigrationClassificationNoActive
		result.Reason = "invalid user id"
		return result, nil
	}
	var existing model.UserSubscriptionContract
	existingQuery := subscriptionMigrationLock(tx).Where("user_id = ?", userID).Limit(1).Find(&existing)
	if existingQuery.Error != nil {
		return result, existingQuery.Error
	}
	hasExistingContract := existingQuery.RowsAffected > 0
	if hasExistingContract && existing.Status == model.SubscriptionContractStatusNeedsAttention {
		result.Classification = SubscriptionMigrationClassificationMultipleActiveEntitlements
		result.Reason = "contract already needs attention"
		return result, nil
	}

	now := common.GetTimestamp()
	var entitlements []model.UserSubscription
	if err := subscriptionMigrationLock(tx).
		Where("user_id = ? AND status = ? AND access_end_time > ?", userID, model.SubscriptionEntitlementStatusActive, now).
		Order("access_end_time desc, id desc").
		Find(&entitlements).Error; err != nil {
		return result, err
	}
	var bindings []model.SubscriptionProviderBinding
	if err := subscriptionMigrationLock(tx).
		Where("user_id = ? AND provider = ? AND provider_subscription_id <> ? AND ended_at = ?",
			userID, model.PaymentProviderStripe, "", 0).
		Order("current_period_end desc, id desc").
		Find(&bindings).Error; err != nil {
		return result, err
	}
	bindings = activeRecurringBindings(bindings)
	if hasExistingContract && isValidSingleSubscriptionAggregate(existing, entitlements, bindings) {
		result.Classification = SubscriptionMigrationClassificationNoActive
		result.Reason = "single-contract aggregate already valid"
		return result, nil
	}

	result.Classification = classifyLegacySubscription(entitlements, bindings)
	result.Reason = result.Classification
	if result.Classification == SubscriptionMigrationClassificationGroupAmbiguity ||
		result.Classification == SubscriptionMigrationClassificationMultipleActiveEntitlements ||
		result.Classification == SubscriptionMigrationClassificationMultipleRecurringBindings ||
		result.Classification == SubscriptionMigrationClassificationMissingBinding {
		return result, nil
	}
	if len(entitlements) == 0 {
		return result, nil
	}
	var reusableContract *model.UserSubscriptionContract
	if hasExistingContract {
		reusableContract = &existing
	}
	if err := backfillUniqueLegacySubscriptionTx(tx, userID, entitlements[0], bindings, reusableContract); err != nil {
		return result, err
	}
	result.Backfilled = true
	return result, nil
}

func subscriptionMigrationLock(tx *gorm.DB) *gorm.DB {
	if common.UsingSQLite {
		return tx
	}
	return tx.Clauses(clause.Locking{Strength: "UPDATE"})
}

func activeRecurringBindings(bindings []model.SubscriptionProviderBinding) []model.SubscriptionProviderBinding {
	active := make([]model.SubscriptionProviderBinding, 0, len(bindings))
	for _, binding := range bindings {
		if isTerminalRecurringProviderStatusForMigration(binding.ProviderStatus) || binding.EndedAt > 0 {
			continue
		}
		active = append(active, binding)
	}
	return active
}

func classifyLegacySubscription(entitlements []model.UserSubscription, bindings []model.SubscriptionProviderBinding) string {
	if hasGroupAmbiguity(entitlements) {
		return SubscriptionMigrationClassificationGroupAmbiguity
	}
	if len(bindings) > 1 {
		return SubscriptionMigrationClassificationMultipleRecurringBindings
	}
	if len(entitlements) > 1 {
		return SubscriptionMigrationClassificationMultipleActiveEntitlements
	}
	if len(entitlements) == 0 {
		return SubscriptionMigrationClassificationNoActive
	}
	entitlement := entitlements[0]
	if entitlement.ProviderBindingId > 0 || entitlement.PaymentMode == model.SubscriptionPaymentModeStripeRecurring {
		if len(bindings) != 1 || entitlement.ProviderBindingId != bindings[0].Id {
			return SubscriptionMigrationClassificationMissingBinding
		}
		return SubscriptionMigrationClassificationOneVerifiedRecurring
	}
	if len(bindings) == 1 {
		return SubscriptionMigrationClassificationMissingBinding
	}
	return SubscriptionMigrationClassificationOneOnePeriodEntitlement
}

func hasGroupAmbiguity(entitlements []model.UserSubscription) bool {
	groups := map[string]bool{}
	for _, entitlement := range entitlements {
		group := strings.TrimSpace(entitlement.UpgradeGroup)
		if group != "" {
			groups[group] = true
		}
		if group != "" && strings.TrimSpace(entitlement.PrevUserGroup) == "" {
			return true
		}
	}
	return len(groups) > 1
}

func isValidSingleSubscriptionAggregate(contract model.UserSubscriptionContract, entitlements []model.UserSubscription, bindings []model.SubscriptionProviderBinding) bool {
	if contract.Status != model.SubscriptionContractStatusActive && contract.Status != model.SubscriptionContractStatusGrace {
		return false
	}
	if len(entitlements) != 1 {
		return false
	}
	entitlement := entitlements[0]
	if entitlement.Id != contract.CurrentEntitlementId || entitlement.ContractId != contract.Id ||
		entitlement.CurrentSlot == nil || *entitlement.CurrentSlot != 1 || entitlement.PlanId != contract.CurrentPlanId ||
		entitlement.PaymentMode != contract.PaymentMode {
		return false
	}
	if contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring {
		if len(bindings) != 1 {
			return false
		}
		binding := bindings[0]
		return binding.Id == contract.CurrentProviderBindingId && binding.ContractId == contract.Id &&
			binding.PlanId == contract.CurrentPlanId && entitlement.ProviderBindingId == binding.Id
	}
	return len(bindings) == 0 && contract.CurrentProviderBindingId == 0 && entitlement.ProviderBindingId == 0
}

func backfillUniqueLegacySubscriptionTx(tx *gorm.DB, userID int, entitlement model.UserSubscription, bindings []model.SubscriptionProviderBinding, existing *model.UserSubscriptionContract) error {
	paymentMode := model.SubscriptionPaymentModeBalanceOnePeriod
	var bindingID int64
	if len(bindings) == 1 {
		paymentMode = model.SubscriptionPaymentModeStripeRecurring
		bindingID = bindings[0].Id
	}
	contract := model.UserSubscriptionContract{
		UserId:                   userID,
		Status:                   model.SubscriptionContractStatusActive,
		PaymentMode:              paymentMode,
		CurrentPlanId:            entitlement.PlanId,
		CurrentEntitlementId:     entitlement.Id,
		CurrentProviderBindingId: bindingID,
		CurrentPeriodStart:       entitlement.StartTime,
		CurrentPeriodEnd:         entitlement.EndTime,
		BaseUserGroup:            strings.TrimSpace(entitlement.PrevUserGroup),
	}
	if bindingID > 0 {
		contract.CurrentPeriodStart = bindings[0].CurrentPeriodStart
		contract.CurrentPeriodEnd = bindings[0].CurrentPeriodEnd
		contract.GracePeriodEnd = bindings[0].GracePeriodEnd
	}
	if existing == nil {
		if err := tx.Create(&contract).Error; err != nil {
			return err
		}
	} else {
		contract.Id = existing.Id
		if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ? AND user_id = ?", contract.Id, userID).
			Updates(map[string]interface{}{
				"status":                      contract.Status,
				"payment_mode":                contract.PaymentMode,
				"current_plan_id":             contract.CurrentPlanId,
				"current_entitlement_id":      contract.CurrentEntitlementId,
				"current_provider_binding_id": contract.CurrentProviderBindingId,
				"current_period_start":        contract.CurrentPeriodStart,
				"current_period_end":          contract.CurrentPeriodEnd,
				"grace_period_end":            contract.GracePeriodEnd,
				"base_user_group":             contract.BaseUserGroup,
				"updated_at":                  common.GetTimestamp(),
			}).Error; err != nil {
			return err
		}
	}
	if err := tx.Model(&model.UserSubscription{}).
		Where("contract_id = ? AND id <> ? AND current_slot = ?", contract.Id, entitlement.Id, 1).
		Update("current_slot", nil).Error; err != nil {
		return err
	}
	currentSlot := 1
	if err := tx.Model(&model.UserSubscription{}).Where("id = ? AND user_id = ?", entitlement.Id, userID).
		Updates(map[string]interface{}{
			"contract_id":         contract.Id,
			"provider_binding_id": bindingID,
			"current_slot":        currentSlot,
			"payment_mode":        paymentMode,
			"updated_at":          common.GetTimestamp(),
		}).Error; err != nil {
		return err
	}
	if bindingID > 0 {
		if err := tx.Model(&model.SubscriptionProviderBinding{}).Where("id = ? AND user_id = ?", bindingID, userID).
			Updates(map[string]interface{}{
				"contract_id": contract.Id,
				"updated_at":  common.GetTimestamp(),
			}).Error; err != nil {
			return err
		}
	}
	return nil
}

func legacySubscriptionMigrationBlocksWrite(classification string) bool {
	switch classification {
	case SubscriptionMigrationClassificationMultipleActiveEntitlements,
		SubscriptionMigrationClassificationMultipleRecurringBindings,
		SubscriptionMigrationClassificationMissingBinding,
		SubscriptionMigrationClassificationGroupAmbiguity:
		return true
	default:
		return false
	}
}

func isTerminalRecurringProviderStatusForMigration(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "canceled", "incomplete_expired", "unpaid":
		return true
	default:
		return false
	}
}

func logSubscriptionMigrationReport(report SubscriptionMigrationReport) {
	if len(report.Counts) == 0 {
		common.SysLog("subscription migration audit classification_counts=none")
		return
	}
	keys := make([]string, 0, len(report.Counts))
	for key := range report.Counts {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%d", strings.ReplaceAll(key, " ", "_"), report.Counts[key]))
	}
	common.SysLog("subscription migration audit classification_counts=" + strings.Join(parts, ","))
}
