package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	SubscriptionEntitlementEndReasonRenewed          = "renewed"
	SubscriptionEntitlementEndReasonUpgraded         = "upgraded"
	SubscriptionEntitlementEndReasonExpired          = "expired"
	SubscriptionEntitlementEndReasonCancelled        = "cancelled"
	SubscriptionEntitlementEndReasonAdminInvalidated = "admin_invalidated"

	SubscriptionEntitlementStatusActive     = "active"
	SubscriptionEntitlementStatusHistorical = "historical"
)

var ErrSubscriptionEntitlementGrantConflict = errors.New("subscription entitlement grant conflict")

type GrantEntitlementInput struct {
	ContractId           int64
	UserId               int
	PlanId               int
	ProviderBindingId    int64
	GrantKey             string
	PaymentMode          string
	AmountTotal          int64
	MediaCreditsTotal    int64
	Window5hAmount       *int64
	WindowWeekAmount     *int64
	UpgradeGroup         *string
	PeriodStart          int64
	PeriodEnd            int64
	EndReasonForPrevious string
	Source               string
}

type GrantEntitlementResult struct {
	Entitlement *UserSubscription
	Applied     bool
}

func RotateCurrentEntitlement(input GrantEntitlementInput) (*GrantEntitlementResult, error) {
	input.normalize()
	if err := input.validate(); err != nil {
		return nil, err
	}

	var result *GrantEntitlementResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		applied, err := rotateCurrentEntitlementTx(tx, input)
		if err != nil {
			return err
		}
		result = applied
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func RotateCurrentEntitlementTx(tx *gorm.DB, input GrantEntitlementInput) (*GrantEntitlementResult, error) {
	return rotateCurrentEntitlementTx(tx, input)
}

func rotateCurrentEntitlementTx(tx *gorm.DB, input GrantEntitlementInput) (*GrantEntitlementResult, error) {
	if tx == nil {
		return nil, errors.New("tx is nil")
	}
	input.normalize()
	if err := input.validate(); err != nil {
		return nil, err
	}
	plan, err := getSubscriptionPlanByIdTx(tx, input.PlanId)
	if err != nil {
		return nil, err
	}
	input.applyPlanSnapshotDefaults(plan)

	if existing, found, err := findGrantEntitlementByKeyTx(tx, input.GrantKey); err != nil {
		return nil, err
	} else if found {
		if grantMatchesInput(existing, input) {
			return &GrantEntitlementResult{Entitlement: existing, Applied: false}, nil
		}
		return nil, ErrSubscriptionEntitlementGrantConflict
	}

	var contract UserSubscriptionContract
	if err := lockQuery(tx).Where("id = ? AND user_id = ?", input.ContractId, input.UserId).
		First(&contract).Error; err != nil {
		return nil, err
	}

	if existing, found, err := findGrantEntitlementByKeyTx(tx, input.GrantKey); err != nil {
		return nil, err
	} else if found {
		if grantMatchesInput(existing, input) {
			return &GrantEntitlementResult{Entitlement: existing, Applied: false}, nil
		}
		return nil, ErrSubscriptionEntitlementGrantConflict
	}

	if contract.CurrentEntitlementId > 0 {
		var old UserSubscription
		err := lockQuery(tx).Where("id = ? AND user_id = ? AND contract_id = ? AND current_slot = ?",
			contract.CurrentEntitlementId, input.UserId, input.ContractId, 1).
			First(&old).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if err == nil {
			updates := map[string]interface{}{
				"current_slot": nil,
				"end_reason":   input.EndReasonForPrevious,
				"updated_at":   common.GetTimestamp(),
			}
			if old.Status == SubscriptionEntitlementStatusActive {
				updates["status"] = SubscriptionEntitlementStatusHistorical
			}
			if err := tx.Model(&UserSubscription{}).Where("id = ?", old.Id).Updates(updates).Error; err != nil {
				return nil, err
			}
		}
	}

	currentSlot := 1
	grantKey := input.GrantKey
	sub := &UserSubscription{
		UserId:            input.UserId,
		PlanId:            plan.Id,
		ContractId:        input.ContractId,
		ProviderBindingId: input.ProviderBindingId,
		GrantKey:          &grantKey,
		CurrentSlot:       &currentSlot,
		AmountTotal:       input.AmountTotal,
		AmountUsed:        0,
		MediaCreditsTotal: input.MediaCreditsTotal,
		MediaCreditsUsed:  0,
		Window5hAmount:    input.Window5hAmount,
		WindowWeekAmount:  input.WindowWeekAmount,
		StartTime:         input.PeriodStart,
		EndTime:           input.PeriodEnd,
		AccessEndTime:     input.PeriodEnd,
		Status:            SubscriptionEntitlementStatusActive,
		Source:            input.Source,
		PaymentMode:       input.PaymentMode,
		UpgradeGroup:      *input.UpgradeGroup,
	}
	if err := tx.Create(sub).Error; err != nil {
		return nil, err
	}

	contractUpdates := map[string]interface{}{
		"current_plan_id":             plan.Id,
		"current_entitlement_id":      sub.Id,
		"current_provider_binding_id": input.ProviderBindingId,
		"current_period_start":        input.PeriodStart,
		"current_period_end":          input.PeriodEnd,
		"payment_mode":                input.PaymentMode,
		"status":                      SubscriptionContractStatusActive,
		"change_version":              contract.ChangeVersion + 1,
		"updated_at":                  common.GetTimestamp(),
	}
	if input.PaymentMode == SubscriptionPaymentModeStripeRecurring {
		contractUpdates["renewal_source"] = SubscriptionRenewalSourceProvider
		contractUpdates["renewal_status"] = SubscriptionRenewalStatusEnabled
	}
	if err := applyEntitlementGroupChangeTx(tx, &contract, *input.UpgradeGroup, input.UserId, contractUpdates); err != nil {
		return nil, err
	}
	if err := tx.Model(&UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(contractUpdates).Error; err != nil {
		return nil, err
	}
	return &GrantEntitlementResult{Entitlement: sub, Applied: true}, nil
}

func (input *GrantEntitlementInput) normalize() {
	input.GrantKey = strings.TrimSpace(input.GrantKey)
	input.PaymentMode = normalizeSubscriptionPaymentMode(input.PaymentMode)
	input.EndReasonForPrevious = normalizeSubscriptionEntitlementEndReason(input.EndReasonForPrevious)
	input.Source = strings.TrimSpace(input.Source)
	if input.Source == "" {
		input.Source = "subscription"
	}
	if input.UpgradeGroup != nil {
		value := strings.TrimSpace(*input.UpgradeGroup)
		input.UpgradeGroup = &value
	}
}

func (input *GrantEntitlementInput) applyPlanSnapshotDefaults(plan *SubscriptionPlan) {
	if input == nil || plan == nil {
		return
	}
	if input.Window5hAmount == nil {
		value := plan.Window5hAmount
		input.Window5hAmount = &value
	}
	if input.WindowWeekAmount == nil {
		value := plan.WindowWeekAmount
		input.WindowWeekAmount = &value
	}
	if input.UpgradeGroup == nil {
		value := strings.TrimSpace(plan.UpgradeGroup)
		input.UpgradeGroup = &value
	}
}

func (input GrantEntitlementInput) validate() error {
	if input.ContractId <= 0 {
		return errors.New("invalid contract id")
	}
	if input.UserId <= 0 {
		return errors.New("invalid user id")
	}
	if input.PlanId <= 0 {
		return errors.New("invalid plan id")
	}
	if input.GrantKey == "" {
		return errors.New("grant key is empty")
	}
	if input.PeriodEnd <= input.PeriodStart {
		return errors.New("period end must be after start")
	}
	if input.AmountTotal < 0 {
		return errors.New("amount total must be >= 0")
	}
	if input.MediaCreditsTotal < 0 {
		return errors.New("media credits total must be >= 0")
	}
	if input.Window5hAmount != nil && *input.Window5hAmount < 0 {
		return errors.New("window 5h amount must be >= 0")
	}
	if input.WindowWeekAmount != nil && *input.WindowWeekAmount < 0 {
		return errors.New("window week amount must be >= 0")
	}
	return nil
}

func normalizeSubscriptionEntitlementEndReason(reason string) string {
	switch strings.TrimSpace(reason) {
	case SubscriptionEntitlementEndReasonUpgraded,
		SubscriptionEntitlementEndReasonExpired,
		SubscriptionEntitlementEndReasonCancelled,
		SubscriptionEntitlementEndReasonAdminInvalidated:
		return strings.TrimSpace(reason)
	default:
		return SubscriptionEntitlementEndReasonRenewed
	}
}

func findGrantEntitlementByKeyTx(tx *gorm.DB, grantKey string) (*UserSubscription, bool, error) {
	var existing UserSubscription
	query := tx.Where("grant_key = ?", strings.TrimSpace(grantKey)).Limit(1).Find(&existing)
	if query.Error != nil {
		return nil, false, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, false, nil
	}
	return &existing, true, nil
}

func grantMatchesInput(existing *UserSubscription, input GrantEntitlementInput) bool {
	return existing != nil &&
		existing.ContractId == input.ContractId &&
		existing.UserId == input.UserId &&
		existing.PlanId == input.PlanId &&
		existing.ProviderBindingId == input.ProviderBindingId &&
		existing.AmountTotal == input.AmountTotal &&
		existing.MediaCreditsTotal == input.MediaCreditsTotal &&
		grantWindowAmountMatches(existing.Window5hAmount, input.Window5hAmount) &&
		grantWindowAmountMatches(existing.WindowWeekAmount, input.WindowWeekAmount) &&
		grantUpgradeGroupMatches(existing.UpgradeGroup, input.UpgradeGroup) &&
		existing.StartTime == input.PeriodStart &&
		existing.EndTime == input.PeriodEnd &&
		normalizeSubscriptionPaymentMode(existing.PaymentMode) == input.PaymentMode &&
		strings.TrimSpace(existing.Source) == input.Source
}

func grantWindowAmountMatches(existing *int64, input *int64) bool {
	if existing == nil {
		return true
	}
	return input != nil && *existing == *input
}

func grantUpgradeGroupMatches(existing string, input *string) bool {
	existing = strings.TrimSpace(existing)
	return input != nil && existing == strings.TrimSpace(*input)
}

func (o *SubscriptionOrder) BeforeCreate(tx *gorm.DB) error {
	if o == nil || tx == nil || strings.TrimSpace(o.PlanSnapshot) != "" || o.PlanId <= 0 {
		return nil
	}
	if !tx.Migrator().HasTable(&SubscriptionPlan{}) {
		return nil
	}
	var plan SubscriptionPlan
	if err := tx.Where("id = ?", o.PlanId).First(&plan).Error; err != nil {
		return err
	}
	plan.NormalizeDefaults()
	payload := struct {
		PlanID              int     `json:"plan_id"`
		Title               string  `json:"title"`
		PriceAmount         float64 `json:"price_amount"`
		Currency            string  `json:"currency"`
		DurationUnit        string  `json:"duration_unit"`
		DurationValue       int     `json:"duration_value"`
		TotalAmount         int64   `json:"total_amount"`
		Window5hAmount      int64   `json:"window_5h_amount"`
		WindowWeekAmount    int64   `json:"window_week_amount"`
		MediaCreditsMonthly int64   `json:"media_credits_monthly"`
		QuotaResetPeriod    string  `json:"quota_reset_period"`
		UpgradeGroup        string  `json:"upgrade_group"`
	}{
		PlanID:              plan.Id,
		Title:               plan.Title,
		PriceAmount:         plan.PriceAmount,
		Currency:            plan.Currency,
		DurationUnit:        plan.DurationUnit,
		DurationValue:       plan.DurationValue,
		TotalAmount:         plan.TotalAmount,
		Window5hAmount:      plan.Window5hAmount,
		WindowWeekAmount:    plan.WindowWeekAmount,
		MediaCreditsMonthly: plan.MediaCreditsMonthly,
		QuotaResetPeriod:    plan.QuotaResetPeriod,
		UpgradeGroup:        plan.UpgradeGroup,
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	o.PlanSnapshot = string(data)
	return nil
}

func applyEntitlementGroupChangeTx(tx *gorm.DB, contract *UserSubscriptionContract, upgradeGroup string, userId int, contractUpdates map[string]interface{}) error {
	upgradeGroup = strings.TrimSpace(upgradeGroup)
	if upgradeGroup == "" {
		return nil
	}
	currentGroup, err := getUserGroupByIdTx(tx, userId)
	if err != nil {
		return err
	}
	if strings.TrimSpace(contract.BaseUserGroup) == "" {
		contractUpdates["base_user_group"] = currentGroup
	}
	if currentGroup != upgradeGroup {
		if err := tx.Model(&User{}).Where("id = ?", userId).Update("group", upgradeGroup).Error; err != nil {
			return err
		}
	}
	return nil
}

func lockQuery(tx *gorm.DB) *gorm.DB {
	if common.UsingSQLite {
		return tx
	}
	return tx.Clauses(clause.Locking{Strength: "UPDATE"})
}

func contractAllowsEntitlementConsumption(status string) bool {
	switch normalizeSubscriptionContractStatus(status) {
	case SubscriptionContractStatusActive, SubscriptionContractStatusGrace, SubscriptionContractStatusNeedsAttention:
		return true
	default:
		return false
	}
}

func findContractCurrentEntitlementForUserTx(tx *gorm.DB, userId int, now int64, lock bool) (*UserSubscription, bool, string, error) {
	if tx == nil {
		tx = DB
	}
	var contract UserSubscriptionContract
	contractQuery := tx
	if lock {
		contractQuery = lockQuery(tx)
	}
	query := contractQuery.Where("user_id = ?", userId).Limit(1).Find(&contract)
	if query.Error != nil {
		return nil, false, "", query.Error
	}
	if query.RowsAffected == 0 {
		return nil, false, "", nil
	}
	if !contractAllowsEntitlementConsumption(contract.Status) || contract.CurrentEntitlementId <= 0 {
		return nil, true, contract.Status, nil
	}

	subQuery := tx
	if lock {
		subQuery = lockQuery(tx)
	}
	var sub UserSubscription
	entitlementQuery := subQuery.Where(
		"id = ? AND user_id = ? AND contract_id = ? AND current_slot = ? AND status = ? AND access_end_time > ?",
		contract.CurrentEntitlementId,
		userId,
		contract.Id,
		1,
		SubscriptionEntitlementStatusActive,
		now,
	).Limit(1).Find(&sub)
	if entitlementQuery.Error != nil {
		return nil, true, contract.Status, entitlementQuery.Error
	}
	if entitlementQuery.RowsAffected == 0 {
		return nil, true, contract.Status, nil
	}
	return &sub, true, contract.Status, nil
}

func getPreConsumableSubscriptionCandidatesTx(tx *gorm.DB, userId int, now int64) ([]UserSubscription, bool, string, error) {
	current, hasContract, contractStatus, err := findContractCurrentEntitlementForUserTx(tx, userId, now, true)
	if err != nil {
		return nil, hasContract, contractStatus, err
	}
	if hasContract {
		if current == nil {
			return nil, true, contractStatus, nil
		}
		return []UserSubscription{*current}, true, contractStatus, nil
	}
	var subs []UserSubscription
	if err := lockQuery(tx).
		Where("user_id = ? AND status = ? AND end_time > ?", userId, SubscriptionEntitlementStatusActive, now).
		Order("end_time asc, id asc").
		Find(&subs).Error; err != nil {
		return nil, false, "", err
	}
	return subs, false, "", nil
}

func hasActiveUserSubscriptionTx(tx *gorm.DB, userId int, now int64) (bool, error) {
	current, hasContract, _, err := findContractCurrentEntitlementForUserTx(tx, userId, now, false)
	if err != nil {
		return false, err
	}
	if hasContract {
		return current != nil, nil
	}
	var count int64
	if err := tx.Model(&UserSubscription{}).
		Where("user_id = ? AND status = ? AND end_time > ?", userId, SubscriptionEntitlementStatusActive, now).
		Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func noActiveSubscriptionError(hasContract bool) error {
	if hasContract {
		return errors.New("no active contract entitlement")
	}
	return errors.New("no active subscription")
}

func insufficientSubscriptionQuotaError(amount int64) error {
	return fmt.Errorf("subscription quota insufficient, need=%d", amount)
}

func isGraceContractCurrentEntitlementTx(tx *gorm.DB, sub *UserSubscription) (bool, error) {
	if tx == nil || sub == nil || sub.ContractId <= 0 {
		return false, nil
	}
	var count int64
	err := tx.Model(&UserSubscriptionContract{}).
		Where("id = ? AND user_id = ? AND status = ? AND current_entitlement_id = ?",
			sub.ContractId, sub.UserId, SubscriptionContractStatusGrace, sub.Id).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
