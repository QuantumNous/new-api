package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ---- Shared types ----

type SubscriptionPlanDTO struct {
	Plan     SubscriptionPlanPublicDTO `json:"plan"`
	TierRank *int                      `json:"tier_rank"`
	Relation string                    `json:"relation"`
}

type AdminSubscriptionPlanDTO struct {
	Plan model.SubscriptionPlan `json:"plan"`
}

type SubscriptionPlanPublicDTO struct {
	Id                      int      `json:"id"`
	Title                   string   `json:"title"`
	Subtitle                string   `json:"subtitle"`
	PriceAmount             float64  `json:"price_amount"`
	Currency                string   `json:"currency"`
	DurationUnit            string   `json:"duration_unit"`
	DurationValue           int      `json:"duration_value"`
	CustomSeconds           int64    `json:"custom_seconds"`
	Enabled                 bool     `json:"enabled"`
	SortOrder               int      `json:"sort_order"`
	TierRank                *int     `json:"tier_rank"`
	AllowBalancePay         *bool    `json:"allow_balance_pay"`
	PaymentModes            []string `json:"payment_modes"`
	MaxPurchasePerUser      int      `json:"max_purchase_per_user"`
	UpgradeGroup            string   `json:"upgrade_group"`
	TotalAmount             int64    `json:"total_amount"`
	MediaCreditsMonthly     int64    `json:"media_credits_monthly"`
	QuotaResetPeriod        string   `json:"quota_reset_period"`
	QuotaResetCustomSeconds int64    `json:"quota_reset_custom_seconds"`
	CreatedAt               int64    `json:"created_at"`
	UpdatedAt               int64    `json:"updated_at"`
}

type BillingPreferenceRequest struct {
	BillingPreference string `json:"billing_preference"`
}

type SubscriptionBalancePayRequest struct {
	PlanId    int    `json:"plan_id"`
	RequestId string `json:"request_id"`
}

type ChangeSubscriptionPlanRequest struct {
	PlanId      int    `json:"plan_id"`
	PaymentMode string `json:"payment_mode"`
	RequestId   string `json:"request_id"`
}

type RecurringSubscriptionDTO struct {
	BindingId          int64  `json:"binding_id"`
	Provider           string `json:"provider"`
	PlanId             int    `json:"plan_id"`
	ProviderStatus     string `json:"provider_status"`
	CancelAtPeriodEnd  bool   `json:"cancel_at_period_end"`
	CurrentPeriodStart int64  `json:"current_period_start"`
	CurrentPeriodEnd   int64  `json:"current_period_end"`
	GracePeriodEnd     int64  `json:"grace_period_end"`
	CanCancel          bool   `json:"can_cancel"`
	CanResume          bool   `json:"can_resume"`
	RequiresSupport    bool   `json:"requires_support"`
	Terminal           bool   `json:"-"`
}

type SubscriptionSelfResponse struct {
	BillingPreference      string                                     `json:"billing_preference"`
	BillingOrder           []string                                   `json:"billing_order"`
	CurrentSubscription    *SubscriptionSelfCurrentSubscriptionDTO    `json:"current_subscription,omitempty"`
	Contract               *SubscriptionSelfContractDTO               `json:"contract,omitempty"`
	CurrentEntitlement     *SubscriptionSelfEntitlementDTO            `json:"current_entitlement,omitempty"`
	CurrentPeriod          SubscriptionCurrentPeriodDTO               `json:"current_period"`
	Quota                  SubscriptionQuotaDTO                       `json:"quota"`
	MonthlyBucket          SubscriptionUsageWindowDTO                 `json:"monthly_bucket"`
	MediaCredits           SubscriptionUsageWindowDTO                 `json:"media_credits"`
	RemainingDays          int64                                      `json:"remaining_days"`
	RenewalSource          string                                     `json:"renewal_source"`
	RenewalStatus          string                                     `json:"renewal_status"`
	PendingChange          *SubscriptionSelfPendingChangeDTO          `json:"pending_change,omitempty"`
	Capabilities           SubscriptionCapabilitiesDTO                `json:"capabilities"`
	Migration              SubscriptionMigrationDTO                   `json:"migration"`
	Subscriptions          []SubscriptionSelfSummaryDTO               `json:"subscriptions"`
	AllSubscriptions       []SubscriptionSelfSummaryDTO               `json:"all_subscriptions"`
	RecurringSubscriptions []SubscriptionSelfRecurringSubscriptionDTO `json:"recurring_subscriptions"`
}

type SubscriptionSelfSubscriptionDTO struct {
	Id                int    `json:"id"`
	UserId            int    `json:"user_id"`
	PlanId            int    `json:"plan_id"`
	ContractId        int64  `json:"contract_id"`
	CurrentSlot       *int   `json:"current_slot"`
	AmountTotal       int64  `json:"amount_total"`
	AmountUsed        int64  `json:"amount_used"`
	MediaCreditsTotal int64  `json:"media_credits_total"`
	MediaCreditsUsed  int64  `json:"media_credits_used"`
	StartTime         int64  `json:"start_time"`
	EndTime           int64  `json:"end_time"`
	AccessEndTime     int64  `json:"access_end_time"`
	EndReason         string `json:"end_reason"`
	Status            string `json:"status"`
	Source            string `json:"source"`
	PaymentMode       string `json:"payment_mode"`
	LastResetTime     int64  `json:"last_reset_time"`
	NextResetTime     int64  `json:"next_reset_time"`
	UpgradeGroup      string `json:"upgrade_group"`
	PrevUserGroup     string `json:"prev_user_group"`
	CreatedAt         int64  `json:"created_at"`
	UpdatedAt         int64  `json:"updated_at"`
}

type SubscriptionSelfPlanDTO struct {
	Id                      int      `json:"id"`
	Title                   string   `json:"title"`
	Subtitle                string   `json:"subtitle"`
	PriceAmount             float64  `json:"price_amount"`
	Currency                string   `json:"currency"`
	PixPriceBRL             *float64 `json:"pix_price_brl"`
	UpiPriceINR             *float64 `json:"upi_price_inr"`
	DurationUnit            string   `json:"duration_unit"`
	DurationValue           int      `json:"duration_value"`
	CustomSeconds           int64    `json:"custom_seconds"`
	Enabled                 bool     `json:"enabled"`
	SortOrder               int      `json:"sort_order"`
	TierRank                *int     `json:"tier_rank"`
	AllowBalancePay         *bool    `json:"allow_balance_pay"`
	MaxPurchasePerUser      int      `json:"max_purchase_per_user"`
	UpgradeGroup            string   `json:"upgrade_group"`
	TotalAmount             int64    `json:"total_amount"`
	MediaCreditsMonthly     int64    `json:"media_credits_monthly"`
	QuotaResetPeriod        string   `json:"quota_reset_period"`
	QuotaResetCustomSeconds int64    `json:"quota_reset_custom_seconds"`
	ModelCount              int      `json:"model_count"`
	Rpm                     int      `json:"rpm"`
	Concurrency             int      `json:"concurrency"`
	FeatureLines            string   `json:"feature_lines"`
	CreatedAt               int64    `json:"created_at"`
	UpdatedAt               int64    `json:"updated_at"`
}

type SubscriptionSelfSummaryDTO struct {
	Subscription *SubscriptionSelfSubscriptionDTO `json:"subscription"`
}

type SubscriptionSelfCurrentSubscriptionDTO struct {
	Subscription *SubscriptionSelfSubscriptionDTO `json:"subscription"`
	Plan         *SubscriptionSelfPlanDTO         `json:"plan"`
}

type AdminUserSubscriptionsResponse struct {
	Contract           *SubscriptionContractDTO      `json:"contract,omitempty"`
	CurrentEntitlement *SubscriptionEntitlementDTO   `json:"current_entitlement,omitempty"`
	CurrentPeriod      SubscriptionCurrentPeriodDTO  `json:"current_period"`
	Quota              SubscriptionQuotaDTO          `json:"quota"`
	CurrentBinding     *RecurringSubscriptionDTO     `json:"current_binding,omitempty"`
	PendingChange      *SubscriptionPendingChangeDTO `json:"pending_change,omitempty"`
	Migration          SubscriptionMigrationDTO      `json:"migration"`
	History            []model.SubscriptionSummary   `json:"history"`
}

type SubscriptionContractDTO struct {
	ContractID               int64  `json:"contract_id"`
	Status                   string `json:"status"`
	PaymentMode              string `json:"payment_mode"`
	CurrentPlanID            int    `json:"current_plan_id"`
	CurrentEntitlementID     int    `json:"current_entitlement_id"`
	CurrentProviderBindingID int64  `json:"current_provider_binding_id"`
	LatestChangeIntentID     int64  `json:"latest_change_intent_id"`
	PendingPlanID            int    `json:"pending_plan_id"`
	PendingEffectiveAt       int64  `json:"pending_effective_at"`
	ChangeVersion            int64  `json:"change_version"`
}

type SubscriptionSelfContractDTO struct {
	ContractID           int64  `json:"contract_id"`
	Status               string `json:"status"`
	PaymentMode          string `json:"payment_mode"`
	CurrentPlanID        int    `json:"current_plan_id"`
	CurrentEntitlementID int    `json:"current_entitlement_id"`
	LatestChangeIntentID int64  `json:"latest_change_intent_id"`
	PendingPlanID        int    `json:"pending_plan_id"`
	PendingEffectiveAt   int64  `json:"pending_effective_at"`
	ChangeVersion        int64  `json:"change_version"`
}

type SubscriptionEntitlementDTO struct {
	EntitlementID     int    `json:"entitlement_id"`
	PlanID            int    `json:"plan_id"`
	ProviderBindingID int64  `json:"provider_binding_id"`
	Status            string `json:"status"`
	PaymentMode       string `json:"payment_mode"`
	StartTime         int64  `json:"start_time"`
	EndTime           int64  `json:"end_time"`
	AccessEndTime     int64  `json:"access_end_time"`
}

type SubscriptionSelfEntitlementDTO struct {
	EntitlementID int    `json:"entitlement_id"`
	PlanID        int    `json:"plan_id"`
	Status        string `json:"status"`
	PaymentMode   string `json:"payment_mode"`
	StartTime     int64  `json:"start_time"`
	EndTime       int64  `json:"end_time"`
	AccessEndTime int64  `json:"access_end_time"`
}

type SubscriptionCurrentPeriodDTO struct {
	Start          int64 `json:"start"`
	End            int64 `json:"end"`
	GracePeriodEnd int64 `json:"grace_period_end"`
}

type SubscriptionQuotaDTO struct {
	AmountTotal     int64 `json:"amount_total"`
	AmountUsed      int64 `json:"amount_used"`
	AmountRemaining int64 `json:"amount_remaining"`
	Unlimited       bool  `json:"unlimited"`
}

type SubscriptionUsageWindowDTO struct {
	Used      int64 `json:"used"`
	Total     int64 `json:"total"`
	Remaining int64 `json:"remaining"`
	ResetAt   int64 `json:"reset_at"`
	Unlimited bool  `json:"unlimited"`
}

type SubscriptionPendingChangeDTO struct {
	IntentID          int64  `json:"intent_id"`
	Kind              string `json:"kind"`
	Status            string `json:"status"`
	FromPlanID        int    `json:"from_plan_id"`
	ToPlanID          int    `json:"to_plan_id"`
	ProviderBindingID int64  `json:"provider_binding_id"`
	EffectiveAt       int64  `json:"effective_at"`
	PaymentMode       string `json:"payment_mode"`
}

type SubscriptionSelfPendingChangeDTO struct {
	IntentID    int64  `json:"intent_id"`
	Kind        string `json:"kind"`
	Status      string `json:"status"`
	FromPlanID  int    `json:"from_plan_id"`
	ToPlanID    int    `json:"to_plan_id"`
	EffectiveAt int64  `json:"effective_at"`
	PaymentMode string `json:"payment_mode"`
}

type SubscriptionSelfRecurringSubscriptionDTO struct {
	PlanId             int   `json:"plan_id"`
	CancelAtPeriodEnd  bool  `json:"cancel_at_period_end"`
	CurrentPeriodStart int64 `json:"current_period_start"`
	CurrentPeriodEnd   int64 `json:"current_period_end"`
	GracePeriodEnd     int64 `json:"grace_period_end"`
	RequiresSupport    bool  `json:"requires_support"`
}

type SubscriptionCapabilitiesDTO struct {
	CanChangePlan          bool `json:"can_change_plan"`
	CanUseStripeRecurring  bool `json:"can_use_stripe_recurring"`
	CanUseBalanceOnePeriod bool `json:"can_use_balance_one_period"`
	CanCancel              bool `json:"can_cancel"`
	CanResume              bool `json:"can_resume"`
	RequiresSupport        bool `json:"requires_support"`
	HasPendingIntent       bool `json:"has_pending_intent"`
	IsGrace                bool `json:"is_grace"`
	IsCancelAtPeriodEnd    bool `json:"is_cancel_at_period_end"`
	HasMigrationConflict   bool `json:"has_migration_conflict"`
}

type SubscriptionMigrationDTO struct {
	RequiresAdminReview bool   `json:"requires_admin_review"`
	Classification      string `json:"classification"`
	Reason              string `json:"reason"`
}

type ChangeSubscriptionPlanResponse struct {
	Status           string                            `json:"status"`
	Contract         *SubscriptionSelfContractDTO      `json:"contract,omitempty"`
	Intent           *SubscriptionSelfPendingChangeDTO `json:"intent,omitempty"`
	CheckoutURL      string                            `json:"checkout_url,omitempty"`
	HostedInvoiceURL string                            `json:"hosted_invoice_url,omitempty"`
}

var ErrSubscriptionPurchasePendingMigration = errors.New("subscription purchase initiation is pending migration")

const maxSubscriptionPlanLocalPrice = 9999.999999

// ---- User APIs ----

func GetSubscriptionPlans(c *gin.Context) {
	if !operation_setting.IsPaymentComplianceConfirmed() {
		common.ApiSuccess(c, []SubscriptionPlanDTO{})
		return
	}

	var plans []model.SubscriptionPlan
	if err := model.DB.Where("enabled = ?", true).Order("sort_order desc, id desc").Find(&plans).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	contract, _ := getSubscriptionSelfContract(c.GetInt("id"))
	currentTierRank := currentSubscriptionTierRank(contract)
	result := make([]SubscriptionPlanDTO, 0, len(plans))
	for _, p := range plans {
		p.NormalizeDefaults()
		result = append(result, SubscriptionPlanDTO{
			Plan:     subscriptionPlanPublicDTO(&p),
			TierRank: p.TierRank,
			Relation: subscriptionPlanRelation(contract, currentTierRank, &p),
		})
	}
	common.ApiSuccess(c, result)
}

func subscriptionPlanPublicDTO(plan *model.SubscriptionPlan) SubscriptionPlanPublicDTO {
	if plan == nil {
		return SubscriptionPlanPublicDTO{}
	}
	return SubscriptionPlanPublicDTO{
		Id:                      plan.Id,
		Title:                   plan.Title,
		Subtitle:                plan.Subtitle,
		PriceAmount:             plan.PriceAmount,
		Currency:                plan.Currency,
		DurationUnit:            plan.DurationUnit,
		DurationValue:           plan.DurationValue,
		CustomSeconds:           plan.CustomSeconds,
		Enabled:                 plan.Enabled,
		SortOrder:               plan.SortOrder,
		TierRank:                plan.TierRank,
		AllowBalancePay:         plan.AllowBalancePay,
		PaymentModes:            subscriptionPlanPaymentModes(plan),
		MaxPurchasePerUser:      plan.MaxPurchasePerUser,
		UpgradeGroup:            plan.UpgradeGroup,
		TotalAmount:             plan.TotalAmount,
		MediaCreditsMonthly:     plan.MediaCreditsMonthly,
		QuotaResetPeriod:        plan.QuotaResetPeriod,
		QuotaResetCustomSeconds: plan.QuotaResetCustomSeconds,
		CreatedAt:               plan.CreatedAt,
		UpdatedAt:               plan.UpdatedAt,
	}
}

func subscriptionPlanPaymentModes(plan *model.SubscriptionPlan) []string {
	modes := make([]string, 0, 2)
	if strings.TrimSpace(plan.StripePriceId) != "" {
		modes = append(modes, model.SubscriptionPaymentModeStripeRecurring)
	}
	if plan.AllowBalancePay == nil || *plan.AllowBalancePay {
		modes = append(modes, model.SubscriptionPaymentModeBalanceOnePeriod)
	}
	return modes
}

func GetSubscriptionSelf(c *gin.Context) {
	userId := c.GetInt("id")
	// Self-serve fast path: if this user has a Stripe change intent whose
	// invoice is already paid, apply it inline so the response below reflects
	// the purchased plan immediately (the frontend polls this endpoint after
	// returning from Stripe payment). No-op unless such an intent exists.
	service.ReconcileUnresolvedStripeIntentsForUser(c.Request.Context(), userId)
	settingMap, _ := model.GetUserSetting(userId, false)
	pref := common.NormalizeBillingPreference(settingMap.BillingPreference)

	// Get all subscriptions (including expired)
	allSubscriptions, err := model.GetAllUserSubscriptions(userId)
	if err != nil {
		allSubscriptions = []model.SubscriptionSummary{}
	}

	// Get active subscriptions for backward compatibility
	activeSubscriptions, err := model.GetAllActiveUserSubscriptions(userId)
	if err != nil {
		activeSubscriptions = []model.SubscriptionSummary{}
	}

	recurringSubscriptions := []RecurringSubscriptionDTO{}
	rawRecurringBindings := []model.SubscriptionProviderBinding{}
	if bindings, err := model.GetRecurringSubscriptionBindingsForUser(userId); err == nil {
		rawRecurringBindings = bindings
		recurringSubscriptions = recurringSubscriptionDTOs(bindings)
	}

	contract, _ := getSubscriptionSelfContract(userId)
	currentEntitlement, _ := getSubscriptionSelfCurrentEntitlement(userId, contract)
	pendingChange, _ := getSubscriptionSelfPendingChange(userId, contract)
	migration := buildSubscriptionMigrationDTO(activeSubscriptions, rawRecurringBindings, contract)
	common.ApiSuccess(c, buildSubscriptionSelfResponse(
		pref,
		contract,
		currentEntitlement,
		pendingChange,
		migration,
		activeSubscriptions,
		allSubscriptions,
		recurringSubscriptions,
	))
}

func buildSubscriptionSelfResponse(
	pref string,
	contract *model.UserSubscriptionContract,
	currentEntitlement *model.UserSubscription,
	pendingChange *model.SubscriptionChangeIntent,
	migration SubscriptionMigrationDTO,
	activeSubscriptions []model.SubscriptionSummary,
	allSubscriptions []model.SubscriptionSummary,
	recurringSubscriptions []RecurringSubscriptionDTO,
) SubscriptionSelfResponse {
	selfActiveSubscriptions := subscriptionSelfSummaryDTOs(activeSubscriptions)
	selfAllSubscriptions := subscriptionSelfSummaryDTOs(allSubscriptions)
	response := SubscriptionSelfResponse{
		BillingPreference:      pref,
		BillingOrder:           []string{"subscription", "wallet"},
		CurrentSubscription:    buildCurrentSubscriptionSnapshot(activeSubscriptions),
		CurrentPeriod:          SubscriptionCurrentPeriodDTO{},
		Quota:                  SubscriptionQuotaDTO{},
		Migration:              migration,
		Subscriptions:          selfActiveSubscriptions,
		AllSubscriptions:       selfAllSubscriptions,
		RecurringSubscriptions: selfRecurringSubscriptionDTOs(recurringSubscriptions),
	}
	if contract != nil && contract.Id > 0 {
		response.Contract = subscriptionSelfContractDTO(contract)
		response.CurrentPeriod = SubscriptionCurrentPeriodDTO{
			Start:          contract.CurrentPeriodStart,
			End:            contract.CurrentPeriodEnd,
			GracePeriodEnd: contract.GracePeriodEnd,
		}
		response.RemainingDays = subscriptionRemainingDays(contract.CurrentPeriodEnd)
	}
	renewalRequiresSupport := subscriptionSelfRenewalRequiresSupport(contract, currentEntitlement, recurringSubscriptions, migration)
	if !renewalRequiresSupport {
		response.RenewalSource, response.RenewalStatus = subscriptionSelfRenewalState(contract, currentEntitlement, recurringSubscriptions)
	}
	if currentEntitlement != nil && currentEntitlement.Id > 0 {
		response.CurrentEntitlement = &SubscriptionSelfEntitlementDTO{
			EntitlementID: currentEntitlement.Id,
			PlanID:        currentEntitlement.PlanId,
			Status:        currentEntitlement.Status,
			PaymentMode:   currentEntitlement.PaymentMode,
			StartTime:     currentEntitlement.StartTime,
			EndTime:       currentEntitlement.EndTime,
			AccessEndTime: currentEntitlement.AccessEndTime,
		}
		response.Quota = SubscriptionQuotaDTO{
			AmountTotal:     currentEntitlement.AmountTotal,
			AmountUsed:      currentEntitlement.AmountUsed,
			AmountRemaining: subscriptionQuotaRemaining(currentEntitlement.AmountTotal, currentEntitlement.AmountUsed),
			Unlimited:       currentEntitlement.AmountTotal == 0,
		}
		if contract == nil || contract.Id <= 0 {
			response.CurrentPeriod = SubscriptionCurrentPeriodDTO{
				Start:          currentEntitlement.StartTime,
				End:            currentEntitlement.EndTime,
				GracePeriodEnd: currentEntitlement.AccessEndTime,
			}
			response.RemainingDays = subscriptionRemainingDays(currentEntitlement.EndTime)
		}
		response.MonthlyBucket = subscriptionUsageWindowDTO(
			currentEntitlement.AmountUsed,
			currentEntitlement.AmountTotal,
			currentEntitlement.NextResetTime,
			currentEntitlement.AmountTotal == 0,
		)
		response.MediaCredits = subscriptionUsageWindowDTO(
			currentEntitlement.MediaCreditsUsed,
			currentEntitlement.MediaCreditsTotal,
			currentEntitlement.NextResetTime,
			false,
		)
	}
	if pendingChange != nil && pendingChange.Id > 0 {
		response.PendingChange = subscriptionSelfPendingChangeDTO(pendingChange)
	}
	response.Capabilities = buildSubscriptionCapabilitiesDTO(
		contract,
		currentEntitlement,
		pendingChange,
		recurringSubscriptions,
		migration,
		response.RenewalSource,
		response.RenewalStatus,
		renewalRequiresSupport,
	)
	return response
}

func buildCurrentSubscriptionSnapshot(activeSubscriptions []model.SubscriptionSummary) *SubscriptionSelfCurrentSubscriptionDTO {
	var currentPlan *model.SubscriptionPlan
	var currentSub *model.UserSubscription
	for _, summary := range activeSubscriptions {
		if summary.Subscription == nil {
			continue
		}
		plan, planErr := model.GetSubscriptionPlanById(summary.Subscription.PlanId)
		if planErr != nil {
			continue
		}
		if currentPlan == nil || plan.PriceAmount > currentPlan.PriceAmount {
			planCopy := *plan
			subCopy := *summary.Subscription
			currentPlan = &planCopy
			currentSub = &subCopy
		}
	}
	if currentPlan == nil || currentSub == nil {
		return nil
	}
	return &SubscriptionSelfCurrentSubscriptionDTO{
		Subscription: subscriptionSelfSubscriptionDTO(currentSub),
		Plan:         subscriptionSelfPlanDTO(currentPlan),
	}
}

func subscriptionSelfSummaryDTOs(summaries []model.SubscriptionSummary) []SubscriptionSelfSummaryDTO {
	result := make([]SubscriptionSelfSummaryDTO, 0, len(summaries))
	for _, summary := range summaries {
		result = append(result, SubscriptionSelfSummaryDTO{
			Subscription: subscriptionSelfSubscriptionDTO(summary.Subscription),
		})
	}
	return result
}

func subscriptionSelfSubscriptionDTO(subscription *model.UserSubscription) *SubscriptionSelfSubscriptionDTO {
	if subscription == nil {
		return nil
	}
	return &SubscriptionSelfSubscriptionDTO{
		Id:                subscription.Id,
		UserId:            subscription.UserId,
		PlanId:            subscription.PlanId,
		ContractId:        subscription.ContractId,
		CurrentSlot:       subscription.CurrentSlot,
		AmountTotal:       subscription.AmountTotal,
		AmountUsed:        subscription.AmountUsed,
		MediaCreditsTotal: subscription.MediaCreditsTotal,
		MediaCreditsUsed:  subscription.MediaCreditsUsed,
		StartTime:         subscription.StartTime,
		EndTime:           subscription.EndTime,
		AccessEndTime:     subscription.AccessEndTime,
		EndReason:         subscription.EndReason,
		Status:            subscription.Status,
		Source:            subscription.Source,
		PaymentMode:       subscription.PaymentMode,
		LastResetTime:     subscription.LastResetTime,
		NextResetTime:     subscription.NextResetTime,
		UpgradeGroup:      subscription.UpgradeGroup,
		PrevUserGroup:     subscription.PrevUserGroup,
		CreatedAt:         subscription.CreatedAt,
		UpdatedAt:         subscription.UpdatedAt,
	}
}

func subscriptionSelfPlanDTO(plan *model.SubscriptionPlan) *SubscriptionSelfPlanDTO {
	if plan == nil {
		return nil
	}
	return &SubscriptionSelfPlanDTO{
		Id:                      plan.Id,
		Title:                   plan.Title,
		Subtitle:                plan.Subtitle,
		PriceAmount:             plan.PriceAmount,
		Currency:                plan.Currency,
		PixPriceBRL:             plan.PixPriceBRL,
		UpiPriceINR:             plan.UpiPriceINR,
		DurationUnit:            plan.DurationUnit,
		DurationValue:           plan.DurationValue,
		CustomSeconds:           plan.CustomSeconds,
		Enabled:                 plan.Enabled,
		SortOrder:               plan.SortOrder,
		TierRank:                plan.TierRank,
		AllowBalancePay:         plan.AllowBalancePay,
		MaxPurchasePerUser:      plan.MaxPurchasePerUser,
		UpgradeGroup:            plan.UpgradeGroup,
		TotalAmount:             plan.TotalAmount,
		MediaCreditsMonthly:     plan.MediaCreditsMonthly,
		QuotaResetPeriod:        plan.QuotaResetPeriod,
		QuotaResetCustomSeconds: plan.QuotaResetCustomSeconds,
		ModelCount:              plan.ModelCount,
		Rpm:                     plan.Rpm,
		Concurrency:             plan.Concurrency,
		FeatureLines:            plan.FeatureLines,
		CreatedAt:               plan.CreatedAt,
		UpdatedAt:               plan.UpdatedAt,
	}
}

func subscriptionContractDTO(contract *model.UserSubscriptionContract) *SubscriptionContractDTO {
	if contract == nil || contract.Id <= 0 {
		return nil
	}
	return &SubscriptionContractDTO{
		ContractID:               contract.Id,
		Status:                   contract.Status,
		PaymentMode:              contract.PaymentMode,
		CurrentPlanID:            contract.CurrentPlanId,
		CurrentEntitlementID:     contract.CurrentEntitlementId,
		CurrentProviderBindingID: contract.CurrentProviderBindingId,
		LatestChangeIntentID:     contract.LatestChangeIntentId,
		PendingPlanID:            contract.PendingPlanId,
		PendingEffectiveAt:       contract.PendingEffectiveAt,
		ChangeVersion:            contract.ChangeVersion,
	}
}

func subscriptionSelfContractDTO(contract *model.UserSubscriptionContract) *SubscriptionSelfContractDTO {
	if contract == nil || contract.Id <= 0 {
		return nil
	}
	return &SubscriptionSelfContractDTO{
		ContractID:           contract.Id,
		Status:               contract.Status,
		PaymentMode:          contract.PaymentMode,
		CurrentPlanID:        contract.CurrentPlanId,
		CurrentEntitlementID: contract.CurrentEntitlementId,
		LatestChangeIntentID: contract.LatestChangeIntentId,
		PendingPlanID:        contract.PendingPlanId,
		PendingEffectiveAt:   contract.PendingEffectiveAt,
		ChangeVersion:        contract.ChangeVersion,
	}
}

func subscriptionPendingChangeDTO(intent *model.SubscriptionChangeIntent) *SubscriptionPendingChangeDTO {
	if intent == nil || intent.Id <= 0 {
		return nil
	}
	return &SubscriptionPendingChangeDTO{
		IntentID:          intent.Id,
		Kind:              intent.Kind,
		Status:            intent.Status,
		FromPlanID:        intent.FromPlanId,
		ToPlanID:          intent.ToPlanId,
		ProviderBindingID: intent.ProviderBindingId,
		EffectiveAt:       intent.EffectiveAt,
		PaymentMode:       intent.PaymentMode,
	}
}

func subscriptionSelfPendingChangeDTO(intent *model.SubscriptionChangeIntent) *SubscriptionSelfPendingChangeDTO {
	if intent == nil || intent.Id <= 0 {
		return nil
	}
	return &SubscriptionSelfPendingChangeDTO{
		IntentID:    intent.Id,
		Kind:        intent.Kind,
		Status:      intent.Status,
		FromPlanID:  intent.FromPlanId,
		ToPlanID:    intent.ToPlanId,
		EffectiveAt: intent.EffectiveAt,
		PaymentMode: intent.PaymentMode,
	}
}

func getSubscriptionSelfContract(userID int) (*model.UserSubscriptionContract, error) {
	if userID <= 0 {
		return nil, nil
	}
	var contract model.UserSubscriptionContract
	err := model.DB.Where("user_id = ?", userID).Limit(1).Find(&contract).Error
	if err != nil {
		return nil, err
	}
	if contract.Id <= 0 {
		return nil, nil
	}
	return &contract, nil
}

func getSubscriptionCanonicalCurrentEntitlement(userID int, contract *model.UserSubscriptionContract) (*model.UserSubscription, error) {
	if userID <= 0 || contract == nil || contract.CurrentEntitlementId <= 0 {
		return nil, nil
	}
	var entitlement model.UserSubscription
	query := model.DB.Where("id = ? AND user_id = ?", contract.CurrentEntitlementId, userID).Limit(1).Find(&entitlement)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, nil
	}
	return &entitlement, nil
}

func getSubscriptionSelfCurrentEntitlement(userID int, contract *model.UserSubscriptionContract) (*model.UserSubscription, error) {
	if userID <= 0 {
		return nil, nil
	}
	if contract != nil && contract.CurrentEntitlementId > 0 {
		return getSubscriptionCanonicalCurrentEntitlement(userID, contract)
	}
	var entitlement model.UserSubscription
	query := model.DB.Where("user_id = ? AND status = ? AND access_end_time > ?",
		userID, model.SubscriptionEntitlementStatusActive, common.GetTimestamp()).
		Order("access_end_time desc, id desc").
		Limit(1).
		Find(&entitlement)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, nil
	}
	return &entitlement, nil
}

func getSubscriptionSelfPendingChange(userID int, contract *model.UserSubscriptionContract) (*model.SubscriptionChangeIntent, error) {
	if userID <= 0 {
		return nil, nil
	}
	query := model.DB.Where("user_id = ? AND status IN ?", userID, []string{
		model.SubscriptionChangeIntentStatusCreated,
		model.SubscriptionChangeIntentStatusSyncing,
		model.SubscriptionChangeIntentStatusAwaitingPayment,
		model.SubscriptionChangeIntentStatusScheduled,
		model.SubscriptionChangeIntentStatusCompensationRequired,
	})
	if contract != nil && contract.Id > 0 {
		query = query.Where("contract_id = ?", contract.Id)
	}
	var intent model.SubscriptionChangeIntent
	result := query.Order("id desc").Limit(1).Find(&intent)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, nil
	}
	return &intent, nil
}

func subscriptionQuotaRemaining(total int64, used int64) int64 {
	if total == 0 {
		return 0
	}
	remaining := total - used
	if remaining < 0 {
		return 0
	}
	return remaining
}

func subscriptionUsageWindowDTO(used int64, total int64, resetAt int64, unlimited bool) SubscriptionUsageWindowDTO {
	if used < 0 {
		used = 0
	}
	if total < 0 {
		total = 0
	}
	return SubscriptionUsageWindowDTO{
		Used:      used,
		Total:     total,
		Remaining: subscriptionQuotaRemaining(total, used),
		ResetAt:   resetAt,
		Unlimited: unlimited,
	}
}

func subscriptionRemainingDays(endTime int64) int64 {
	if endTime <= 0 {
		return 0
	}
	remainingSeconds := endTime - common.GetTimestamp()
	if remainingSeconds <= 0 {
		return 0
	}
	return (remainingSeconds + 24*3600 - 1) / (24 * 3600)
}

func buildSubscriptionCapabilitiesDTO(
	contract *model.UserSubscriptionContract,
	currentEntitlement *model.UserSubscription,
	pendingChange *model.SubscriptionChangeIntent,
	recurringSubscriptions []RecurringSubscriptionDTO,
	migration SubscriptionMigrationDTO,
	renewalSource string,
	renewalStatus string,
	renewalRequiresSupport bool,
) SubscriptionCapabilitiesDTO {
	hasPendingIntent := pendingChange != nil && pendingChange.Id > 0
	capabilities := SubscriptionCapabilitiesDTO{
		CanChangePlan:          !hasPendingIntent && !migration.RequiresAdminReview,
		CanUseStripeRecurring:  !hasPendingIntent && !migration.RequiresAdminReview,
		CanUseBalanceOnePeriod: !hasPendingIntent && !migration.RequiresAdminReview,
		RequiresSupport:        migration.RequiresAdminReview,
		HasPendingIntent:       hasPendingIntent,
		HasMigrationConflict:   migration.RequiresAdminReview,
	}
	if contract != nil && contract.Id > 0 {
		capabilities.IsGrace = contract.Status == model.SubscriptionContractStatusGrace
		if contract.PaymentMode == model.SubscriptionPaymentModeBalanceOnePeriod || contract.Status == model.SubscriptionContractStatusGrace {
			capabilities.CanUseBalanceOnePeriod = false
		}
	}
	capabilities.RequiresSupport = capabilities.RequiresSupport || renewalRequiresSupport
	if !capabilities.RequiresSupport && hasRenewalLifecycleActionWindow(contract, currentEntitlement) {
		switch renewalStatus {
		case model.SubscriptionRenewalStatusEnabled:
			if !renewalPendingChangeBlocksAction(pendingChange, contract, renewalSource, model.SubscriptionRenewalStatusCancelledByUser) &&
				(renewalSource == model.SubscriptionRenewalSourceProvider || renewalSource == model.SubscriptionRenewalSourceWallet) {
				capabilities.CanCancel = true
			}
		case model.SubscriptionRenewalStatusCancelledByUser:
			capabilities.IsCancelAtPeriodEnd = true
			if !renewalPendingChangeBlocksAction(pendingChange, contract, renewalSource, model.SubscriptionRenewalStatusEnabled) &&
				(renewalSource == model.SubscriptionRenewalSourceProvider || renewalSource == model.SubscriptionRenewalSourceWallet) {
				capabilities.CanResume = true
			}
		}
	}
	return capabilities
}

func renewalPendingChangeBlocksAction(pendingChange *model.SubscriptionChangeIntent, contract *model.UserSubscriptionContract, renewalSource string, targetStatus string) bool {
	if pendingChange == nil || pendingChange.Id <= 0 {
		return false
	}
	if renewalSource == model.SubscriptionRenewalSourceProvider &&
		targetStatus == model.SubscriptionRenewalStatusCancelledByUser &&
		contract != nil &&
		contract.Id > 0 &&
		contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
		contract.CurrentProviderBindingId > 0 &&
		pendingChange.ContractId == contract.Id &&
		pendingChange.Kind == model.SubscriptionChangeIntentKindDowngrade &&
		pendingChange.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
		pendingChange.ProviderBindingId == contract.CurrentProviderBindingId &&
		pendingChange.Status == model.SubscriptionChangeIntentStatusScheduled {
		return false
	}
	return true
}

func buildSubscriptionMigrationDTO(
	activeSubscriptions []model.SubscriptionSummary,
	recurringBindings []model.SubscriptionProviderBinding,
	contract *model.UserSubscriptionContract,
) SubscriptionMigrationDTO {
	classification := service.SubscriptionMigrationClassificationNoActive
	reason := ""
	activeCount := len(activeSubscriptions)
	activeRecurringCount := 0
	for _, binding := range recurringBindings {
		if isTerminalRecurringProviderStatus(binding.ProviderStatus) || binding.EndedAt > 0 {
			continue
		}
		activeRecurringCount++
	}
	switch {
	case contract != nil && contract.Status == model.SubscriptionContractStatusNeedsAttention:
		classification = service.SubscriptionMigrationClassificationMultipleActiveEntitlements
		reason = "contract already needs attention"
	case activeRecurringCount > 1:
		classification = service.SubscriptionMigrationClassificationMultipleRecurringBindings
	case activeCount > 1:
		classification = service.SubscriptionMigrationClassificationMultipleActiveEntitlements
	case activeCount == 1 && activeSubscriptions[0].Subscription != nil &&
		(activeSubscriptions[0].Subscription.ProviderBindingId > 0 ||
			activeSubscriptions[0].Subscription.PaymentMode == model.SubscriptionPaymentModeStripeRecurring) &&
		activeRecurringCount != 1:
		classification = service.SubscriptionMigrationClassificationMissingBinding
	}
	if reason == "" {
		reason = classification
	}
	return SubscriptionMigrationDTO{
		RequiresAdminReview: service.IsLegacySubscriptionMigrationBlocking(classification),
		Classification:      classification,
		Reason:              reason,
	}
}

func currentSubscriptionTierRank(contract *model.UserSubscriptionContract) *int {
	if contract == nil || contract.CurrentPlanId <= 0 {
		return nil
	}
	var plan model.SubscriptionPlan
	result := model.DB.Where("id = ?", contract.CurrentPlanId).Limit(1).Find(&plan)
	if result.Error != nil || result.RowsAffected == 0 || plan.TierRank == nil {
		return nil
	}
	return plan.TierRank
}

func subscriptionPlanRelation(contract *model.UserSubscriptionContract, currentTierRank *int, plan *model.SubscriptionPlan) string {
	if plan == nil || plan.TierRank == nil || *plan.TierRank <= 0 {
		return "unavailable"
	}
	if contract == nil || contract.CurrentPlanId <= 0 || currentTierRank == nil {
		return "upgrade"
	}
	if plan.Id == contract.CurrentPlanId {
		return "current"
	}
	if *plan.TierRank > *currentTierRank {
		return "upgrade"
	}
	if *plan.TierRank < *currentTierRank {
		if contract.Status == model.SubscriptionContractStatusActive &&
			contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
			contract.CurrentProviderBindingId > 0 {
			return "downgrade"
		}
		return "unavailable"
	}
	return "unavailable"
}

func recurringSubscriptionDTOs(bindings []model.SubscriptionProviderBinding) []RecurringSubscriptionDTO {
	result := make([]RecurringSubscriptionDTO, 0, len(bindings))
	for _, binding := range bindings {
		provider := strings.TrimSpace(binding.Provider)
		complete := provider == model.PaymentProviderStripe &&
			strings.TrimSpace(binding.ProviderSubscriptionId) != ""
		terminal := isTerminalRecurringProviderStatus(binding.ProviderStatus) || binding.EndedAt > 0
		actionable := complete && !terminal && isActionableRecurringProviderStatus(binding.ProviderStatus)
		result = append(result, RecurringSubscriptionDTO{
			BindingId:          binding.Id,
			Provider:           provider,
			PlanId:             binding.PlanId,
			ProviderStatus:     binding.ProviderStatus,
			CancelAtPeriodEnd:  binding.CancelAtPeriodEnd,
			CurrentPeriodStart: binding.CurrentPeriodStart,
			CurrentPeriodEnd:   binding.CurrentPeriodEnd,
			GracePeriodEnd:     binding.GracePeriodEnd,
			CanCancel:          actionable && !binding.CancelAtPeriodEnd,
			CanResume:          actionable && binding.CancelAtPeriodEnd,
			RequiresSupport:    !complete || (!terminal && !actionable),
			Terminal:           terminal,
		})
	}
	return result
}

func selfRecurringSubscriptionDTOs(recurringSubscriptions []RecurringSubscriptionDTO) []SubscriptionSelfRecurringSubscriptionDTO {
	result := make([]SubscriptionSelfRecurringSubscriptionDTO, 0, len(recurringSubscriptions))
	for _, recurring := range recurringSubscriptions {
		result = append(result, SubscriptionSelfRecurringSubscriptionDTO{
			PlanId:             recurring.PlanId,
			CancelAtPeriodEnd:  recurring.CancelAtPeriodEnd,
			CurrentPeriodStart: recurring.CurrentPeriodStart,
			CurrentPeriodEnd:   recurring.CurrentPeriodEnd,
			GracePeriodEnd:     recurring.GracePeriodEnd,
			RequiresSupport:    recurring.RequiresSupport,
		})
	}
	return result
}

func subscriptionSelfRenewalState(
	contract *model.UserSubscriptionContract,
	currentEntitlement *model.UserSubscription,
	recurringSubscriptions []RecurringSubscriptionDTO,
) (string, string) {
	storedSource, storedStatus := "", ""
	if contract != nil && contract.Id > 0 {
		storedSource = strings.TrimSpace(contract.RenewalSource)
		storedStatus = strings.TrimSpace(contract.RenewalStatus)
	}
	if hasActiveRecurringRenewal(contract, currentEntitlement, recurringSubscriptions) {
		if recurring := currentRecurringForSubscription(contract, currentEntitlement, recurringSubscriptions); recurring != nil {
			if recurring.CancelAtPeriodEnd {
				return model.SubscriptionRenewalSourceProvider, model.SubscriptionRenewalStatusCancelledByUser
			}
			return model.SubscriptionRenewalSourceProvider, model.SubscriptionRenewalStatusEnabled
		}
	}
	if storedSource == model.SubscriptionRenewalSourceWallet &&
		isValidSubscriptionRenewalPair(storedSource, storedStatus) &&
		currentEntitlement != nil && strings.TrimSpace(currentEntitlement.Source) == model.PaymentMethodBalance {
		return storedSource, storedStatus
	}
	return "", ""
}

func isValidSubscriptionRenewalPair(source string, status string) bool {
	switch source {
	case model.SubscriptionRenewalSourceProvider:
		return status == model.SubscriptionRenewalStatusEnabled ||
			status == model.SubscriptionRenewalStatusCancelledByUser
	case model.SubscriptionRenewalSourceWallet:
		switch status {
		case model.SubscriptionRenewalStatusEnabled,
			model.SubscriptionRenewalStatusCancelledByUser,
			model.SubscriptionRenewalStatusPausedInsufficientBalance,
			model.SubscriptionRenewalStatusPausedPlanUnavailable:
			return true
		}
	}
	return false
}

func subscriptionSelfRenewalRequiresSupport(
	contract *model.UserSubscriptionContract,
	currentEntitlement *model.UserSubscription,
	recurringSubscriptions []RecurringSubscriptionDTO,
	migration SubscriptionMigrationDTO,
) bool {
	if migration.RequiresAdminReview {
		return true
	}
	if contract == nil || contract.Id <= 0 {
		return false
	}
	stripeCurrent := contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring ||
		(currentEntitlement != nil && currentEntitlement.PaymentMode == model.SubscriptionPaymentModeStripeRecurring)
	if !stripeCurrent {
		return false
	}
	recurring := currentRecurringForSubscription(contract, currentEntitlement, recurringSubscriptions)
	if recurring == nil {
		return true
	}
	return recurring.RequiresSupport || !isActiveRecurringBinding(*recurring, common.GetTimestamp())
}

func currentRecurringForSubscription(
	contract *model.UserSubscriptionContract,
	currentEntitlement *model.UserSubscription,
	recurringSubscriptions []RecurringSubscriptionDTO,
) *RecurringSubscriptionDTO {
	if currentEntitlement == nil || currentEntitlement.Id <= 0 {
		return nil
	}
	for _, recurring := range recurringSubscriptions {
		if recurringMatchesCurrentSubscription(contract, currentEntitlement, recurring) {
			current := recurring
			return &current
		}
	}
	return nil
}

func hasRenewalLifecycleActionWindow(contract *model.UserSubscriptionContract, entitlement *model.UserSubscription) bool {
	now := common.GetTimestamp()
	if contract == nil || contract.Id <= 0 ||
		contract.Status != model.SubscriptionContractStatusActive ||
		contract.CurrentPeriodEnd <= now ||
		entitlement == nil || entitlement.Id <= 0 ||
		contract.CurrentEntitlementId != entitlement.Id ||
		entitlement.Status != model.SubscriptionEntitlementStatusActive ||
		entitlement.EndTime <= now ||
		entitlement.AccessEndTime <= now ||
		entitlement.CurrentSlot == nil || *entitlement.CurrentSlot != 1 {
		return false
	}
	return true
}

func hasActiveRecurringRenewal(
	contract *model.UserSubscriptionContract,
	currentEntitlement *model.UserSubscription,
	recurringSubscriptions []RecurringSubscriptionDTO,
) bool {
	now := common.GetTimestamp()
	if !isActiveRecurringEntitlement(currentEntitlement, now) {
		return false
	}
	if contract != nil && contract.Id > 0 {
		if !isActiveRecurringContract(contract, now) ||
			contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
			return false
		}
	}
	for _, recurring := range recurringSubscriptions {
		if !recurringMatchesCurrentSubscription(contract, currentEntitlement, recurring) ||
			!isActiveRecurringBinding(recurring, now) {
			continue
		}
		return true
	}
	return false
}

func isActiveRecurringContract(contract *model.UserSubscriptionContract, now int64) bool {
	if contract == nil || contract.Id <= 0 {
		return true
	}
	switch contract.Status {
	case model.SubscriptionContractStatusActive,
		model.SubscriptionContractStatusGrace,
		model.SubscriptionContractStatusNeedsAttention:
	default:
		return false
	}
	periodEnd := contract.CurrentPeriodEnd
	if contract.GracePeriodEnd > periodEnd {
		periodEnd = contract.GracePeriodEnd
	}
	return periodEnd <= 0 || periodEnd > now
}

func isActiveRecurringEntitlement(entitlement *model.UserSubscription, now int64) bool {
	if entitlement == nil || entitlement.Id <= 0 ||
		entitlement.Status != model.SubscriptionEntitlementStatusActive ||
		entitlement.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return false
	}
	accessEnd := entitlement.EndTime
	if entitlement.AccessEndTime > accessEnd {
		accessEnd = entitlement.AccessEndTime
	}
	return accessEnd > now
}

func recurringMatchesCurrentSubscription(
	contract *model.UserSubscriptionContract,
	entitlement *model.UserSubscription,
	recurring RecurringSubscriptionDTO,
) bool {
	if entitlement == nil || entitlement.Id <= 0 {
		return false
	}
	bindingID := entitlement.ProviderBindingId
	planID := entitlement.PlanId
	if contract != nil && contract.Id > 0 {
		bindingID = contract.CurrentProviderBindingId
		if bindingID <= 0 || entitlement.ProviderBindingId != bindingID {
			return false
		}
		if contract.CurrentPlanId > 0 {
			planID = contract.CurrentPlanId
		}
	}
	if bindingID > 0 && recurring.BindingId != bindingID {
		return false
	}
	return planID <= 0 || recurring.PlanId == planID
}

func isActiveRecurringBinding(recurring RecurringSubscriptionDTO, now int64) bool {
	if strings.TrimSpace(recurring.Provider) != model.PaymentProviderStripe ||
		recurring.RequiresSupport || recurring.Terminal ||
		!isActionableRecurringProviderStatus(recurring.ProviderStatus) {
		return false
	}
	periodEnd := recurring.CurrentPeriodEnd
	if recurring.GracePeriodEnd > periodEnd {
		periodEnd = recurring.GracePeriodEnd
	}
	return periodEnd > now
}

func isActionableRecurringProviderStatus(status string) bool {
	// The wallet read model exposes lifecycle actions only for exact healthy
	// bindings. Degraded states such as past_due require support even though a
	// lower-level administrative termination path can still handle them.
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "active", "trialing":
		return true
	default:
		return false
	}
}

func isTerminalRecurringProviderStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "canceled", "incomplete_expired", "unpaid":
		return true
	default:
		return false
	}
}

func UpdateSubscriptionPreference(c *gin.Context) {
	// Kept as a compatibility endpoint for older clients. Billing order is now
	// fixed: subscription quota first, then wallet balance.
	common.ApiSuccess(c, gin.H{"billing_preference": "subscription_first"})
}

func SubscriptionRequestBalancePay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	userId := c.GetInt("id")
	var req SubscriptionBalancePayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	requestID := strings.TrimSpace(req.RequestId)
	if !isStableSubscriptionRequestID(requestID) {
		common.ApiErrorMsg(c, "request_id is required")
		return
	}
	cmd := service.PurchaseSubscriptionCommand{
		UserID:        userId,
		PlanID:        req.PlanId,
		PaymentChoice: service.SubscriptionPaymentChoiceBalance,
		Months:        1,
		RequestID:     requestID,
	}
	if replay, found, err := service.ReplaySubscriptionPurchase(cmd); err != nil {
		common.ApiError(c, err)
		return
	} else if found {
		common.ApiSuccess(c, subscriptionSelfPurchaseResponse(replay, ""))
		return
	}
	quoteResult, err := service.QuoteSubscriptionPurchase(cmd)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if quoteResult == nil || !quoteResult.Available {
		reason := "subscription purchase quote unavailable"
		if quoteResult != nil && strings.TrimSpace(quoteResult.UnavailableReason) != "" {
			reason = quoteResult.UnavailableReason
		}
		common.ApiErrorMsg(c, reason)
		return
	}
	quote := subscriptionPurchaseQuoteFromQuoteResult(quoteResult)
	cmd.VerifiedQuote = &quote
	result, err := service.PurchaseSubscription(cmd)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, subscriptionSelfPurchaseResponse(result, ""))
}

func SubscriptionPurchasePendingMigration(c *gin.Context) {
	common.ApiError(c, ErrSubscriptionPurchasePendingMigration)
}

func rejectSubscriptionPurchasePendingMigration(c *gin.Context) bool {
	if !common.SubscriptionSingleContractEnabled {
		return false
	}
	SubscriptionPurchasePendingMigration(c)
	return true
}

func ChangeSubscriptionPlan(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	userId := c.GetInt("id")
	var req ChangeSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	req.RequestId = strings.TrimSpace(req.RequestId)
	req.PaymentMode = strings.TrimSpace(req.PaymentMode)
	if !isStableSubscriptionRequestID(req.RequestId) {
		common.ApiErrorMsg(c, "request_id is required")
		return
	}
	if req.PaymentMode == "" {
		common.ApiErrorMsg(c, "payment_mode is required")
		return
	}

	result, err := service.ChangeSubscriptionPlan(service.ChangePlanCommand{
		UserID:      userId,
		PlanID:      req.PlanId,
		PaymentMode: req.PaymentMode,
		RequestID:   req.RequestId,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, sanitizedChangeSubscriptionPlanResponse(result))
}

func sanitizedChangeSubscriptionPlanResponse(result *service.ChangePlanResult) ChangeSubscriptionPlanResponse {
	if result == nil {
		return ChangeSubscriptionPlanResponse{}
	}
	response := ChangeSubscriptionPlanResponse{
		Status:           result.Status,
		CheckoutURL:      strings.TrimSpace(result.CheckoutURL),
		HostedInvoiceURL: strings.TrimSpace(result.HostedInvoiceURL),
	}
	if result.Contract != nil && result.Contract.Id > 0 {
		response.Contract = subscriptionSelfContractDTO(result.Contract)
	}
	if result.Intent != nil && result.Intent.Id > 0 {
		response.Intent = subscriptionSelfPendingChangeDTO(result.Intent)
	}
	return response
}

func isStableSubscriptionRequestID(requestID string) bool {
	parsed, err := uuid.Parse(requestID)
	if err != nil {
		return false
	}
	return parsed.String() == requestID
}

// ---- Admin APIs ----

func AdminListSubscriptionPlans(c *gin.Context) {
	var plans []model.SubscriptionPlan
	if err := model.DB.Order("sort_order desc, id desc").Find(&plans).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	result := make([]AdminSubscriptionPlanDTO, 0, len(plans))
	for _, p := range plans {
		p.NormalizeDefaults()
		result = append(result, AdminSubscriptionPlanDTO{
			Plan: p,
		})
	}
	common.ApiSuccess(c, result)
}

type AdminUpsertSubscriptionPlanRequest struct {
	Plan model.SubscriptionPlan `json:"plan"`
}

func AdminCreateSubscriptionPlan(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req AdminUpsertSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	req.Plan.Id = 0
	if strings.TrimSpace(req.Plan.Title) == "" {
		common.ApiErrorMsg(c, "套餐标题不能为空")
		return
	}
	if req.Plan.PriceAmount < 0 {
		common.ApiErrorMsg(c, "价格不能为负数")
		return
	}
	if req.Plan.PriceAmount > 9999 {
		common.ApiErrorMsg(c, "价格不能超过9999")
		return
	}
	if !validateSubscriptionPlanLocalPrices(c, &req.Plan) {
		return
	}
	if req.Plan.Currency == "" {
		req.Plan.Currency = "USD"
	}
	req.Plan.Currency = "USD"
	if req.Plan.AllowBalancePay == nil {
		req.Plan.AllowBalancePay = common.GetPointer(true)
	}
	if req.Plan.DurationUnit == "" {
		req.Plan.DurationUnit = model.SubscriptionDurationMonth
	}
	if req.Plan.DurationValue <= 0 && req.Plan.DurationUnit != model.SubscriptionDurationCustom {
		req.Plan.DurationValue = 1
	}
	if req.Plan.MaxPurchasePerUser < 0 {
		common.ApiErrorMsg(c, "购买上限不能为负数")
		return
	}
	if req.Plan.TotalAmount < 0 {
		common.ApiErrorMsg(c, "总额度不能为负数")
		return
	}
	if req.Plan.MediaCreditsMonthly < 0 {
		common.ApiErrorMsg(c, "媒体额度不能为负数")
		return
	}
	req.Plan.Window5hAmount = 0
	req.Plan.WindowWeekAmount = 0
	req.Plan.UpgradeGroup = strings.TrimSpace(req.Plan.UpgradeGroup)
	if req.Plan.UpgradeGroup != "" {
		if _, ok := ratio_setting.GetGroupRatioCopy()[req.Plan.UpgradeGroup]; !ok {
			common.ApiErrorMsg(c, "升级分组不存在")
			return
		}
	}
	req.Plan.QuotaResetPeriod = model.NormalizeResetPeriod(req.Plan.QuotaResetPeriod)
	if req.Plan.QuotaResetPeriod == model.SubscriptionResetCustom && req.Plan.QuotaResetCustomSeconds <= 0 {
		common.ApiErrorMsg(c, "自定义重置周期需大于0秒")
		return
	}
	err := model.CreateSubscriptionPlan(&req.Plan)
	if err != nil {
		apiSubscriptionPlanLifecycleError(c, err)
		return
	}
	common.ApiSuccess(c, req.Plan)
}

func AdminUpdateSubscriptionPlan(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}
	var req AdminUpsertSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if strings.TrimSpace(req.Plan.Title) == "" {
		common.ApiErrorMsg(c, "套餐标题不能为空")
		return
	}
	if req.Plan.PriceAmount < 0 {
		common.ApiErrorMsg(c, "价格不能为负数")
		return
	}
	if req.Plan.PriceAmount > 9999 {
		common.ApiErrorMsg(c, "价格不能超过9999")
		return
	}
	if !validateSubscriptionPlanLocalPrices(c, &req.Plan) {
		return
	}
	req.Plan.Id = id
	if req.Plan.Currency == "" {
		req.Plan.Currency = "USD"
	}
	req.Plan.Currency = "USD"
	if req.Plan.DurationUnit == "" {
		req.Plan.DurationUnit = model.SubscriptionDurationMonth
	}
	if req.Plan.DurationValue <= 0 && req.Plan.DurationUnit != model.SubscriptionDurationCustom {
		req.Plan.DurationValue = 1
	}
	if req.Plan.MaxPurchasePerUser < 0 {
		common.ApiErrorMsg(c, "购买上限不能为负数")
		return
	}
	if req.Plan.TotalAmount < 0 {
		common.ApiErrorMsg(c, "总额度不能为负数")
		return
	}
	if req.Plan.MediaCreditsMonthly < 0 {
		common.ApiErrorMsg(c, "媒体额度不能为负数")
		return
	}
	req.Plan.Window5hAmount = 0
	req.Plan.WindowWeekAmount = 0
	req.Plan.UpgradeGroup = strings.TrimSpace(req.Plan.UpgradeGroup)
	if req.Plan.UpgradeGroup != "" {
		if _, ok := ratio_setting.GetGroupRatioCopy()[req.Plan.UpgradeGroup]; !ok {
			common.ApiErrorMsg(c, "升级分组不存在")
			return
		}
	}
	req.Plan.QuotaResetPeriod = model.NormalizeResetPeriod(req.Plan.QuotaResetPeriod)
	if req.Plan.QuotaResetPeriod == model.SubscriptionResetCustom && req.Plan.QuotaResetCustomSeconds <= 0 {
		common.ApiErrorMsg(c, "自定义重置周期需大于0秒")
		return
	}

	err := model.UpdateSubscriptionPlan(&req.Plan)
	if err != nil {
		apiSubscriptionPlanLifecycleError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func apiSubscriptionPlanLifecycleError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, model.ErrSubscriptionTierRankReserved):
		common.ApiErrorMsg(c, "套餐等级已被占用")
	case errors.Is(err, model.ErrSubscriptionTierRankRequired):
		common.ApiErrorMsg(c, "启用套餐必须设置正数等级")
	case errors.Is(err, model.ErrSubscriptionPlanLifecycleFieldsImmutable):
		common.ApiErrorMsg(c, "套餐已被引用，不能修改生命周期字段")
	default:
		common.ApiError(c, err)
	}
}

func validateSubscriptionPlanLocalPrices(c *gin.Context, plan *model.SubscriptionPlan) bool {
	if !validateSubscriptionPlanLocalPrice(c, plan.PixPriceBRL, "Pix") {
		return false
	}
	return validateSubscriptionPlanLocalPrice(c, plan.UpiPriceINR, "UPI")
}

func validateSubscriptionPlanLocalPrice(c *gin.Context, price *float64, label string) bool {
	if price == nil {
		return true
	}
	if *price <= 0 {
		common.ApiErrorMsg(c, label+" local price must be greater than zero")
		return false
	}
	if *price > maxSubscriptionPlanLocalPrice {
		common.ApiErrorMsg(c, label+" local price cannot exceed 9999.999999")
		return false
	}
	return true
}

type AdminUpdateSubscriptionPlanStatusRequest struct {
	Enabled *bool `json:"enabled"`
}

func AdminUpdateSubscriptionPlanStatus(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}
	var req AdminUpdateSubscriptionPlanStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Enabled == nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.SetSubscriptionPlanEnabled(id, *req.Enabled); err != nil {
		apiSubscriptionPlanLifecycleError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

type AdminBindSubscriptionRequest struct {
	UserId int `json:"user_id"`
	PlanId int `json:"plan_id"`
}

func AdminBindSubscription(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req AdminBindSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.UserId <= 0 || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	msg, err := model.AdminBindSubscription(req.UserId, req.PlanId, "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}

// ---- Admin: user subscription management ----

func AdminListUserSubscriptions(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Param("id"))
	if userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}
	allSubscriptions, err := model.GetAllUserSubscriptions(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	activeSubscriptions, err := model.GetAllActiveUserSubscriptions(userId)
	if err != nil {
		activeSubscriptions = []model.SubscriptionSummary{}
	}
	recurringSubscriptions := []RecurringSubscriptionDTO{}
	rawRecurringBindings := []model.SubscriptionProviderBinding{}
	if bindings, err := model.GetRecurringSubscriptionBindingsForUser(userId); err == nil {
		rawRecurringBindings = bindings
		recurringSubscriptions = recurringSubscriptionDTOs(bindings)
	}
	contract, _ := getSubscriptionSelfContract(userId)
	currentEntitlement, _ := getSubscriptionCanonicalCurrentEntitlement(userId, contract)
	pendingChange, _ := getSubscriptionSelfPendingChange(userId, contract)
	migration := buildSubscriptionMigrationDTO(activeSubscriptions, rawRecurringBindings, contract)
	common.ApiSuccess(c, buildAdminUserSubscriptionsResponse(
		contract,
		currentEntitlement,
		pendingChange,
		migration,
		recurringSubscriptions,
		allSubscriptions,
	))
}

func buildAdminUserSubscriptionsResponse(
	contract *model.UserSubscriptionContract,
	currentEntitlement *model.UserSubscription,
	pendingChange *model.SubscriptionChangeIntent,
	migration SubscriptionMigrationDTO,
	recurringSubscriptions []RecurringSubscriptionDTO,
	history []model.SubscriptionSummary,
) AdminUserSubscriptionsResponse {
	self := buildSubscriptionSelfResponse(
		"",
		contract,
		currentEntitlement,
		pendingChange,
		migration,
		nil,
		history,
		recurringSubscriptions,
	)
	var entitlementDTO *SubscriptionEntitlementDTO
	if currentEntitlement != nil && currentEntitlement.Id > 0 {
		entitlementDTO = &SubscriptionEntitlementDTO{
			EntitlementID:     currentEntitlement.Id,
			PlanID:            currentEntitlement.PlanId,
			ProviderBindingID: currentEntitlement.ProviderBindingId,
			Status:            currentEntitlement.Status,
			PaymentMode:       currentEntitlement.PaymentMode,
			StartTime:         currentEntitlement.StartTime,
			EndTime:           currentEntitlement.EndTime,
			AccessEndTime:     currentEntitlement.AccessEndTime,
		}
	}
	return AdminUserSubscriptionsResponse{
		Contract:           subscriptionContractDTO(contract),
		CurrentEntitlement: entitlementDTO,
		CurrentPeriod:      self.CurrentPeriod,
		Quota:              self.Quota,
		CurrentBinding:     currentRecurringSubscriptionDTO(contract, recurringSubscriptions),
		PendingChange:      subscriptionPendingChangeDTO(pendingChange),
		Migration:          self.Migration,
		History:            history,
	}
}

func currentRecurringSubscriptionDTO(
	contract *model.UserSubscriptionContract,
	recurringSubscriptions []RecurringSubscriptionDTO,
) *RecurringSubscriptionDTO {
	if contract == nil || contract.CurrentProviderBindingId <= 0 {
		return nil
	}
	for _, binding := range recurringSubscriptions {
		if binding.BindingId == contract.CurrentProviderBindingId {
			current := binding
			return &current
		}
	}
	return nil
}

type AdminCreateUserSubscriptionRequest struct {
	PlanId int `json:"plan_id"`
}

// AdminCreateUserSubscription creates a new user subscription from a plan (no payment).
func AdminCreateUserSubscription(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	userId, _ := strconv.Atoi(c.Param("id"))
	if userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}
	var req AdminCreateUserSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	msg, err := model.AdminBindSubscription(userId, req.PlanId, "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminInvalidateUserSubscription cancels a user subscription immediately.
func AdminInvalidateUserSubscription(c *gin.Context) {
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	msg, err := service.AdminInvalidateUserSubscriptionWithRecurringPolicy(subId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminDeleteUserSubscription hard-deletes a user subscription.
func AdminDeleteUserSubscription(c *gin.Context) {
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	msg, err := service.AdminDeleteUserSubscriptionWithRecurringPolicy(subId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}
