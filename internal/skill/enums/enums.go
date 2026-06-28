// Package enums defines shared Skill Marketplace enum constants used across
// data models, API responses, and event recording. All string values match
// the CHECK constraints in tasks/03_Data_Model_and_API_Spec.md §3 exactly.
package enums

// SkillStatus is the lifecycle status of a published Skill (tasks/03 §3).
// "featured" is NOT a status — it is a promotion flag (featured_flag / featured_rank).
type SkillStatus string

const (
	SkillStatusDraft      SkillStatus = "draft"
	SkillStatusPublished  SkillStatus = "published"
	SkillStatusDeprecated SkillStatus = "deprecated"
	SkillStatusArchived   SkillStatus = "archived"
)

var validSkillStatuses = map[SkillStatus]struct{}{
	SkillStatusDraft:      {},
	SkillStatusPublished:  {},
	SkillStatusDeprecated: {},
	SkillStatusArchived:   {},
}

func (s SkillStatus) Valid() bool { _, ok := validSkillStatuses[s]; return ok }

// RequiredPlan is the minimum subscription tier required to enable/execute a Skill.
type RequiredPlan string

const (
	RequiredPlanFree       RequiredPlan = "free"
	RequiredPlanPro        RequiredPlan = "pro"
	RequiredPlanEnterprise RequiredPlan = "enterprise"
)

var validRequiredPlans = map[RequiredPlan]struct{}{
	RequiredPlanFree:       {},
	RequiredPlanPro:        {},
	RequiredPlanEnterprise: {},
}

func (p RequiredPlan) Valid() bool { _, ok := validRequiredPlans[p]; return ok }

// MonetizationType describes how a Skill is priced.
type MonetizationType string

const (
	MonetizationTypeFree         MonetizationType = "free"
	MonetizationTypePlanIncluded MonetizationType = "plan_included"
	MonetizationTypeTokenMarkup  MonetizationType = "token_markup"
	MonetizationTypeOneTime      MonetizationType = "one_time"
)

var validMonetizationTypes = map[MonetizationType]struct{}{
	MonetizationTypeFree:         {},
	MonetizationTypePlanIncluded: {},
	MonetizationTypeTokenMarkup:  {},
	MonetizationTypeOneTime:      {},
}

func (m MonetizationType) Valid() bool { _, ok := validMonetizationTypes[m]; return ok }

// SkillVersionStatus is the lifecycle status of a skill_versions row.
type SkillVersionStatus string

const (
	SkillVersionStatusDraft    SkillVersionStatus = "draft"
	SkillVersionStatusActive   SkillVersionStatus = "active"
	SkillVersionStatusInactive SkillVersionStatus = "inactive"
	SkillVersionStatusArchived SkillVersionStatus = "archived"
)

var validSkillVersionStatuses = map[SkillVersionStatus]struct{}{
	SkillVersionStatusDraft:    {},
	SkillVersionStatusActive:   {},
	SkillVersionStatusInactive: {},
	SkillVersionStatusArchived: {},
}

func (v SkillVersionStatus) Valid() bool { _, ok := validSkillVersionStatuses[v]; return ok }

// ReviewStatus is the workflow state of a skill_reviews row.
type ReviewStatus string

const (
	ReviewStatusOpen      ReviewStatus = "open"
	ReviewStatusAssigned  ReviewStatus = "assigned"
	ReviewStatusEscalated ReviewStatus = "escalated"
	ReviewStatusResolved  ReviewStatus = "resolved"
	ReviewStatusReopened  ReviewStatus = "reopened"
)

var validReviewStatuses = map[ReviewStatus]struct{}{
	ReviewStatusOpen:      {},
	ReviewStatusAssigned:  {},
	ReviewStatusEscalated: {},
	ReviewStatusResolved:  {},
	ReviewStatusReopened:  {},
}

func (r ReviewStatus) Valid() bool { _, ok := validReviewStatuses[r]; return ok }

// KidsApprovalStatus tracks the Kids Safety approval state of a Skill.
// is_kids_safe=true requires approved or emergency_approved (with unexpired
// kids_emergency_approval_expires_at) before publish and execution.
type KidsApprovalStatus string

const (
	KidsApprovalStatusNotRequired       KidsApprovalStatus = "not_required"
	KidsApprovalStatusPending           KidsApprovalStatus = "pending"
	KidsApprovalStatusApproved          KidsApprovalStatus = "approved"
	KidsApprovalStatusEmergencyApproved KidsApprovalStatus = "emergency_approved"
	KidsApprovalStatusRejected          KidsApprovalStatus = "rejected"
	KidsApprovalStatusRevoked           KidsApprovalStatus = "revoked"
)

var validKidsApprovalStatuses = map[KidsApprovalStatus]struct{}{
	KidsApprovalStatusNotRequired:       {},
	KidsApprovalStatusPending:           {},
	KidsApprovalStatusApproved:          {},
	KidsApprovalStatusEmergencyApproved: {},
	KidsApprovalStatusRejected:          {},
	KidsApprovalStatusRevoked:           {},
}

func (k KidsApprovalStatus) Valid() bool { _, ok := validKidsApprovalStatuses[k]; return ok }

// BlockReason is the lowercase data-model enum stored in skill_usage_events.block_reason
// and returned in analytics/audit. This is NOT the API error code; see errcodes.ErrorCode.
//
// Naming note (tasks/03 §3): some values keep the "skill_" prefix (skill_not_found,
// skill_not_published, skill_not_enabled) while others do not (plan_required,
// subscription_inactive, etc.). This matches the canonical enum definition exactly.
// The mapping to uppercase API error codes is in errcodes.ErrorCodeFor().
type BlockReason string

const (
	BlockReasonAuthRequired         BlockReason = "auth_required"
	BlockReasonSkillNotFound        BlockReason = "skill_not_found"
	BlockReasonSkillNotPublished    BlockReason = "skill_not_published"
	BlockReasonSkillNotEnabled      BlockReason = "skill_not_enabled"
	BlockReasonPlanRequired         BlockReason = "plan_required"
	BlockReasonSubscriptionInactive BlockReason = "subscription_inactive"
	BlockReasonEvaluationNotPassed  BlockReason = "evaluation_not_passed"
	BlockReasonQuotaExceeded        BlockReason = "quota_exceeded"
	BlockReasonKidsModeBlocked      BlockReason = "kids_mode_blocked"
	BlockReasonContextTooLong       BlockReason = "context_too_long"
	BlockReasonRateLimited          BlockReason = "rate_limited"
	BlockReasonTimeout              BlockReason = "timeout"
	BlockReasonSafetyViolation      BlockReason = "safety_violation"
	BlockReasonInternalError        BlockReason = "internal_error"
)

var validBlockReasons = map[BlockReason]struct{}{
	BlockReasonAuthRequired:         {},
	BlockReasonSkillNotFound:        {},
	BlockReasonSkillNotPublished:    {},
	BlockReasonSkillNotEnabled:      {},
	BlockReasonPlanRequired:         {},
	BlockReasonSubscriptionInactive: {},
	BlockReasonEvaluationNotPassed:  {},
	BlockReasonQuotaExceeded:        {},
	BlockReasonKidsModeBlocked:      {},
	BlockReasonContextTooLong:       {},
	BlockReasonRateLimited:          {},
	BlockReasonTimeout:              {},
	BlockReasonSafetyViolation:      {},
	BlockReasonInternalError:        {},
}

func (b BlockReason) Valid() bool { _, ok := validBlockReasons[b]; return ok }

// SkillUsageEventType is the analytics event name stored in skill_usage_events.event_type.
type SkillUsageEventType string

const (
	SkillUsageEventTypeImpression          SkillUsageEventType = "skill_impression"
	SkillUsageEventTypeDetailView          SkillUsageEventType = "skill_detail_view"
	SkillUsageEventTypeSaved               SkillUsageEventType = "skill_saved"
	SkillUsageEventTypeUnsaved             SkillUsageEventType = "skill_unsaved"
	SkillUsageEventTypeFavorited           SkillUsageEventType = "skill_favorited"
	SkillUsageEventTypeEnabled             SkillUsageEventType = "skill_enabled"
	SkillUsageEventTypeRated               SkillUsageEventType = "skill_rated"
	SkillUsageEventTypeReported            SkillUsageEventType = "skill_reported"
	SkillUsageEventTypeEvaluationCompleted SkillUsageEventType = "skill_evaluation_completed"
	SkillUsageEventTypeAdminAction         SkillUsageEventType = "skill_admin_action"
	SkillUsageEventTypeKidsApproved        SkillUsageEventType = "skill_kids_approved"
	SkillUsageEventTypeInstalled           SkillUsageEventType = "skill_installed"
	SkillUsageEventTypeUsedLocal           SkillUsageEventType = "skill_used_local"
	SkillUsageEventTypeUsed                SkillUsageEventType = "skill_used"
	SkillUsageEventTypeBlocked             SkillUsageEventType = "skill_blocked"
	SkillUsageEventTypeFirstUse            SkillUsageEventType = "skill_first_use"
	SkillUsageEventTypeRepeatUse           SkillUsageEventType = "skill_repeat_use"
	SkillUsageEventTypePurchased           SkillUsageEventType = "skill_purchased"
)

var validSkillUsageEventTypes = map[SkillUsageEventType]struct{}{
	SkillUsageEventTypeImpression:          {},
	SkillUsageEventTypeDetailView:          {},
	SkillUsageEventTypeSaved:               {},
	SkillUsageEventTypeUnsaved:             {},
	SkillUsageEventTypeFavorited:           {},
	SkillUsageEventTypeEnabled:             {},
	SkillUsageEventTypeRated:               {},
	SkillUsageEventTypeReported:            {},
	SkillUsageEventTypeEvaluationCompleted: {},
	SkillUsageEventTypeAdminAction:         {},
	SkillUsageEventTypeKidsApproved:        {},
	SkillUsageEventTypeInstalled:           {},
	SkillUsageEventTypeUsedLocal:           {},
	SkillUsageEventTypeUsed:                {},
	SkillUsageEventTypeBlocked:             {},
	SkillUsageEventTypeFirstUse:            {},
	SkillUsageEventTypeRepeatUse:           {},
	SkillUsageEventTypePurchased:           {},
}

func (e SkillUsageEventType) Valid() bool { _, ok := validSkillUsageEventTypes[e]; return ok }

// EntryPoint identifies the surface from which a Skill interaction originated.
// Must be recorded in every skill_usage_events.entry_point (tasks/03 §3).
type EntryPoint string

const (
	EntryPointMarketplaceCard EntryPoint = "marketplace_card"
	EntryPointSkillDetail     EntryPoint = "skill_detail"
	EntryPointMySkills        EntryPoint = "my_skills"
	EntryPointSavedList       EntryPoint = "saved_list"
	EntryPointFeatured        EntryPoint = "featured"
	EntryPointPopular         EntryPoint = "popular"
	EntryPointNew             EntryPoint = "new"
	EntryPointRecommended     EntryPoint = "recommended"
	EntryPointRecoPersonal    EntryPoint = "reco_personal"
	EntryPointRecoCodownload  EntryPoint = "reco_codownload"
	EntryPointAdminPreview    EntryPoint = "admin_preview"
	EntryPointSearchResults   EntryPoint = "search_results"
	// EntryPointSkillPackage is the primary R2 execution entry for downloaded
	// Skill packages calling the public routing API. It is also used by the
	// package-download skill_enabled event.
	EntryPointSkillPackage EntryPoint = "skill_package"
	// EntryPointAPIToken identifies Skill package download/execution initiated
	// directly with a DeepRouter API token rather than a browser/JWT session.
	EntryPointAPIToken EntryPoint = "api_token"
	// EntryPointPlaygroundPicker is retained only so historical Playground
	// execution events continue to parse. New V1/R2 execution flows must emit
	// EntryPointSkillPackage instead.
	EntryPointPlaygroundPicker EntryPoint = "playground_picker"
)

var validEntryPoints = map[EntryPoint]struct{}{
	EntryPointMarketplaceCard:  {},
	EntryPointSkillDetail:      {},
	EntryPointMySkills:         {},
	EntryPointSavedList:        {},
	EntryPointPlaygroundPicker: {},
	EntryPointFeatured:         {},
	EntryPointPopular:          {},
	EntryPointNew:              {},
	EntryPointRecommended:      {},
	EntryPointRecoPersonal:     {},
	EntryPointRecoCodownload:   {},
	EntryPointAdminPreview:     {},
	EntryPointSearchResults:    {},
	EntryPointSkillPackage:     {},
	EntryPointAPIToken:         {},
}

func (e EntryPoint) Valid() bool { _, ok := validEntryPoints[e]; return ok }
