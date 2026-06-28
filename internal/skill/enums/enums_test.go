package enums

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// --- SkillStatus ---

func TestSkillStatus_Valid(t *testing.T) {
	valid := []SkillStatus{
		SkillStatusDraft, SkillStatusPublished,
		SkillStatusDeprecated, SkillStatusArchived,
	}
	for _, s := range valid {
		assert.True(t, s.Valid(), "expected %q to be valid", s)
	}

	invalid := []SkillStatus{"", "featured", "PUBLISHED", "DRAFT", "active", "unknown"}
	for _, s := range invalid {
		assert.False(t, s.Valid(), "expected %q to be invalid", s)
	}
}

func TestSkillStatus_StringValues(t *testing.T) {
	assert.Equal(t, "draft", string(SkillStatusDraft))
	assert.Equal(t, "published", string(SkillStatusPublished))
	assert.Equal(t, "deprecated", string(SkillStatusDeprecated))
	assert.Equal(t, "archived", string(SkillStatusArchived))
}

// --- RequiredPlan ---

func TestRequiredPlan_Valid(t *testing.T) {
	valid := []RequiredPlan{RequiredPlanFree, RequiredPlanPro, RequiredPlanEnterprise}
	for _, p := range valid {
		assert.True(t, p.Valid(), "expected %q to be valid", p)
	}

	invalid := []RequiredPlan{"", "FREE", "basic", "premium", "unknown"}
	for _, p := range invalid {
		assert.False(t, p.Valid(), "expected %q to be invalid", p)
	}
}

func TestRequiredPlan_StringValues(t *testing.T) {
	assert.Equal(t, "free", string(RequiredPlanFree))
	assert.Equal(t, "pro", string(RequiredPlanPro))
	assert.Equal(t, "enterprise", string(RequiredPlanEnterprise))
}

// --- MonetizationType ---

func TestMonetizationType_Valid(t *testing.T) {
	valid := []MonetizationType{
		MonetizationTypeFree, MonetizationTypePlanIncluded, MonetizationTypeTokenMarkup,
		MonetizationTypeOneTime, MonetizationTypePlusExclusive,
	}
	for _, m := range valid {
		assert.True(t, m.Valid(), "expected %q to be valid", m)
	}

	invalid := []MonetizationType{"", "FREE", "paid", "plan_included_extra", "unknown"}
	for _, m := range invalid {
		assert.False(t, m.Valid(), "expected %q to be invalid", m)
	}
}

func TestMonetizationType_StringValues(t *testing.T) {
	assert.Equal(t, "free", string(MonetizationTypeFree))
	assert.Equal(t, "plan_included", string(MonetizationTypePlanIncluded))
	assert.Equal(t, "token_markup", string(MonetizationTypeTokenMarkup))
	assert.Equal(t, "one_time", string(MonetizationTypeOneTime))
	assert.Equal(t, "plus_exclusive", string(MonetizationTypePlusExclusive))
}

// --- SkillVersionStatus ---

func TestSkillVersionStatus_Valid(t *testing.T) {
	valid := []SkillVersionStatus{
		SkillVersionStatusDraft, SkillVersionStatusActive,
		SkillVersionStatusInactive, SkillVersionStatusArchived,
	}
	for _, v := range valid {
		assert.True(t, v.Valid(), "expected %q to be valid", v)
	}

	invalid := []SkillVersionStatus{"", "ACTIVE", "published", "deprecated", "unknown"}
	for _, v := range invalid {
		assert.False(t, v.Valid(), "expected %q to be invalid", v)
	}
}

func TestSkillVersionStatus_StringValues(t *testing.T) {
	assert.Equal(t, "draft", string(SkillVersionStatusDraft))
	assert.Equal(t, "active", string(SkillVersionStatusActive))
	assert.Equal(t, "inactive", string(SkillVersionStatusInactive))
	assert.Equal(t, "archived", string(SkillVersionStatusArchived))
}

// --- ReviewStatus ---

func TestReviewStatus_Valid(t *testing.T) {
	valid := []ReviewStatus{
		ReviewStatusOpen, ReviewStatusAssigned, ReviewStatusEscalated,
		ReviewStatusResolved, ReviewStatusReopened,
	}
	for _, r := range valid {
		assert.True(t, r.Valid(), "expected %q to be valid", r)
	}

	invalid := []ReviewStatus{"", "OPEN", "closed", "pending", "unknown"}
	for _, r := range invalid {
		assert.False(t, r.Valid(), "expected %q to be invalid", r)
	}
}

func TestReviewStatus_StringValues(t *testing.T) {
	assert.Equal(t, "open", string(ReviewStatusOpen))
	assert.Equal(t, "assigned", string(ReviewStatusAssigned))
	assert.Equal(t, "escalated", string(ReviewStatusEscalated))
	assert.Equal(t, "resolved", string(ReviewStatusResolved))
	assert.Equal(t, "reopened", string(ReviewStatusReopened))
}

// --- KidsApprovalStatus ---

func TestKidsApprovalStatus_Valid(t *testing.T) {
	valid := []KidsApprovalStatus{
		KidsApprovalStatusNotRequired, KidsApprovalStatusPending,
		KidsApprovalStatusApproved, KidsApprovalStatusEmergencyApproved,
		KidsApprovalStatusRejected, KidsApprovalStatusRevoked,
	}
	for _, k := range valid {
		assert.True(t, k.Valid(), "expected %q to be valid", k)
	}

	invalid := []KidsApprovalStatus{"", "APPROVED", "approved_emergency", "denied", "unknown"}
	for _, k := range invalid {
		assert.False(t, k.Valid(), "expected %q to be invalid", k)
	}
}

func TestKidsApprovalStatus_StringValues(t *testing.T) {
	assert.Equal(t, "not_required", string(KidsApprovalStatusNotRequired))
	assert.Equal(t, "pending", string(KidsApprovalStatusPending))
	assert.Equal(t, "approved", string(KidsApprovalStatusApproved))
	assert.Equal(t, "emergency_approved", string(KidsApprovalStatusEmergencyApproved))
	assert.Equal(t, "rejected", string(KidsApprovalStatusRejected))
	assert.Equal(t, "revoked", string(KidsApprovalStatusRevoked))
}

// --- BlockReason ---

func TestBlockReason_Valid(t *testing.T) {
	valid := []BlockReason{
		BlockReasonAuthRequired, BlockReasonSkillNotFound, BlockReasonSkillNotPublished,
		BlockReasonSkillNotEnabled, BlockReasonPlanRequired, BlockReasonSubscriptionInactive,
		BlockReasonEvaluationNotPassed, BlockReasonQuotaExceeded, BlockReasonKidsModeBlocked, BlockReasonContextTooLong,
		BlockReasonRateLimited, BlockReasonTimeout, BlockReasonSafetyViolation,
		BlockReasonInternalError,
	}
	for _, b := range valid {
		assert.True(t, b.Valid(), "expected %q to be valid", b)
	}

	invalid := []BlockReason{
		"", "AUTH_REQUIRED", "skill_plan_required", "plan-required",
		"skill_quota_exceeded", "unknown",
	}
	for _, b := range invalid {
		assert.False(t, b.Valid(), "expected %q to be invalid", b)
	}
}

// TestBlockReason_StringValues verifies every value verbatim against tasks/03 §3.
// The mixed prefix pattern (skill_not_found keeps "skill_", plan_required does not)
// is intentional — see DR-39 design doc for rationale.
func TestBlockReason_StringValues(t *testing.T) {
	assert.Equal(t, "auth_required", string(BlockReasonAuthRequired))
	assert.Equal(t, "skill_not_found", string(BlockReasonSkillNotFound))
	assert.Equal(t, "skill_not_published", string(BlockReasonSkillNotPublished))
	assert.Equal(t, "skill_not_enabled", string(BlockReasonSkillNotEnabled))
	assert.Equal(t, "plan_required", string(BlockReasonPlanRequired))
	assert.Equal(t, "subscription_inactive", string(BlockReasonSubscriptionInactive))
	assert.Equal(t, "evaluation_not_passed", string(BlockReasonEvaluationNotPassed))
	assert.Equal(t, "quota_exceeded", string(BlockReasonQuotaExceeded))
	assert.Equal(t, "kids_mode_blocked", string(BlockReasonKidsModeBlocked))
	assert.Equal(t, "context_too_long", string(BlockReasonContextTooLong))
	assert.Equal(t, "rate_limited", string(BlockReasonRateLimited))
	assert.Equal(t, "timeout", string(BlockReasonTimeout))
	assert.Equal(t, "safety_violation", string(BlockReasonSafetyViolation))
	assert.Equal(t, "internal_error", string(BlockReasonInternalError))
}

// --- EntryPoint ---

func TestEntryPoint_Valid(t *testing.T) {
	valid := []EntryPoint{
		EntryPointMarketplaceCard, EntryPointSkillDetail, EntryPointMySkills,
		EntryPointSavedList, EntryPointFeatured, EntryPointPopular,
		EntryPointNew, EntryPointNewWeek, EntryPointTrending,
		EntryPointRecommended, EntryPointRecoPersonal,
		EntryPointRecoCodownload, EntryPointAdminPreview,
		EntryPointSearchResults, EntryPointPaywall,
		EntryPointSkillPackage, EntryPointAPIToken,
		EntryPointDownloadedRunner, EntryPointPlaygroundPicker,
	}
	for _, e := range valid {
		assert.True(t, e.Valid(), "expected %q to be valid", e)
	}

	invalid := []EntryPoint{"", "FEATURED", "marketplace", "skill-detail", "unknown"}
	for _, e := range invalid {
		assert.False(t, e.Valid(), "expected %q to be invalid", e)
	}
}

func TestEntryPoint_StringValues(t *testing.T) {
	assert.Equal(t, "marketplace_card", string(EntryPointMarketplaceCard))
	assert.Equal(t, "skill_detail", string(EntryPointSkillDetail))
	assert.Equal(t, "my_skills", string(EntryPointMySkills))
	assert.Equal(t, "saved_list", string(EntryPointSavedList))
	assert.Equal(t, "featured", string(EntryPointFeatured))
	assert.Equal(t, "popular", string(EntryPointPopular))
	assert.Equal(t, "new", string(EntryPointNew))
	assert.Equal(t, "new_week", string(EntryPointNewWeek))
	assert.Equal(t, "trending", string(EntryPointTrending))
	assert.Equal(t, "recommended", string(EntryPointRecommended))
	assert.Equal(t, "reco_personal", string(EntryPointRecoPersonal))
	assert.Equal(t, "reco_codownload", string(EntryPointRecoCodownload))
	assert.Equal(t, "digest", string(EntryPointDigest))
	assert.Equal(t, "reengage", string(EntryPointReengage))
	assert.Equal(t, "admin_preview", string(EntryPointAdminPreview))
	assert.Equal(t, "search_results", string(EntryPointSearchResults))
	assert.Equal(t, "paywall", string(EntryPointPaywall))
	assert.Equal(t, "skill_package", string(EntryPointSkillPackage))
	assert.Equal(t, "api_token", string(EntryPointAPIToken))
	assert.Equal(t, "downloaded_runner", string(EntryPointDownloadedRunner))
	assert.Equal(t, "playground_picker", string(EntryPointPlaygroundPicker))
}

func TestEntryPoint_LegacyPlaygroundPickerStillParses(t *testing.T) {
	assert.True(t, EntryPoint("playground_picker").Valid(),
		"legacy Playground analytics rows must continue to parse")
}
