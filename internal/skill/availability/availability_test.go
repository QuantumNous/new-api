package availability

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/stretchr/testify/assert"
)

// ── helpers ────────────────────────────────────────────────────────────────

func intPtr(n int) *int { return &n }

// publishedFreeSkill is the simplest valid published Skill fixture.
func publishedFreeSkill() SkillInfo {
	return SkillInfo{
		Status:       enums.SkillStatusPublished,
		RequiredPlan: enums.RequiredPlanFree,
	}
}

func publishedProSkill() SkillInfo {
	return SkillInfo{
		Status:       enums.SkillStatusPublished,
		RequiredPlan: enums.RequiredPlanPro,
	}
}

func publishedEnterpriseSkill() SkillInfo {
	return SkillInfo{
		Status:       enums.SkillStatusPublished,
		RequiredPlan: enums.RequiredPlanEnterprise,
	}
}

func freeUserActive() UserInfo {
	return UserInfo{
		Plan:      enums.RequiredPlanFree,
		SubActive: true,
	}
}

func proUserActive() UserInfo {
	return UserInfo{
		Plan:      enums.RequiredPlanPro,
		SubActive: true,
	}
}

func enterpriseUserActive() UserInfo {
	return UserInfo{
		Plan:      enums.RequiredPlanEnterprise,
		SubActive: true,
	}
}

// ── Decision-table tests (tasks/01 §6) ────────────────────────────────────

// Row 1: Anonymous + Any skill → login / AUTH_REQUIRED
func TestResolve_Anonymous(t *testing.T) {
	result := Resolve(publishedFreeSkill(), UserInfo{IsAnonymous: true})
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrAuthRequired, result.LockCode)
	assert.Equal(t, CTALogin, result.CTA)
	assert.Nil(t, result.Enabled, "anonymous Enabled must be nil")
	assert.False(t, result.Executable)
}

// Row 2: Free user + Free Skill + Active + Enabled + quota OK → use
func TestResolve_FreeUser_FreeSkill_Enabled_QuotaOK(t *testing.T) {
	skill := SkillInfo{
		Status:            enums.SkillStatusPublished,
		RequiredPlan:      enums.RequiredPlanFree,
		FreeQuotaPerMonth: intPtr(100),
	}
	user := freeUserActive()
	user.IsEnabled = true
	user.WasEnabled = true
	user.QuotaUsed = 50

	result := Resolve(skill, user)
	assert.False(t, result.Locked)
	assert.True(t, result.Executable)
	assert.Equal(t, CTAUse, result.CTA)
	assert.Equal(t, errcodes.ErrorCode(""), result.LockCode)
	assert.Equal(t, true, *result.Enabled)
}

// Row 3: Free user + Free Skill + Active + Enabled + quota exceeded → SKILL_QUOTA_EXCEEDED / upgrade
func TestResolve_FreeUser_FreeSkill_QuotaExceeded(t *testing.T) {
	skill := SkillInfo{
		Status:            enums.SkillStatusPublished,
		RequiredPlan:      enums.RequiredPlanFree,
		FreeQuotaPerMonth: intPtr(100),
	}
	user := freeUserActive()
	user.IsEnabled = true
	user.WasEnabled = true
	user.QuotaUsed = 100 // exactly at limit

	result := Resolve(skill, user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillQuotaExceeded, result.LockCode)
	assert.Equal(t, CTAUpgrade, result.CTA)
	assert.False(t, result.Executable)
}

func TestResolve_FreeUser_FreeSkill_QuotaExceeded_Over(t *testing.T) {
	skill := SkillInfo{
		Status:            enums.SkillStatusPublished,
		RequiredPlan:      enums.RequiredPlanFree,
		FreeQuotaPerMonth: intPtr(10),
	}
	user := freeUserActive()
	user.IsEnabled = true
	user.QuotaUsed = 999

	result := Resolve(skill, user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillQuotaExceeded, result.LockCode)
	assert.Equal(t, CTAUpgrade, result.CTA)
}

// Row 4: Free user + Pro Skill + Active + Any → SKILL_PLAN_REQUIRED / upgrade
func TestResolve_FreeUser_ProSkill(t *testing.T) {
	user := freeUserActive()
	user.IsEnabled = false

	result := Resolve(publishedProSkill(), user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillPlanRequired, result.LockCode)
	assert.Equal(t, CTAUpgrade, result.CTA)
	assert.False(t, result.Executable)
}

func TestResolve_FreeUser_ProSkill_AlreadyEnabled(t *testing.T) {
	// Even if somehow enabled, plan check still blocks.
	user := freeUserActive()
	user.IsEnabled = true

	result := Resolve(publishedProSkill(), user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillPlanRequired, result.LockCode)
	assert.Equal(t, CTAUpgrade, result.CTA)
}

// Row 5: Pro user + Pro Skill + Active + Enabled → use
func TestResolve_ProUser_ProSkill_Enabled(t *testing.T) {
	user := proUserActive()
	user.IsEnabled = true
	user.WasEnabled = true

	result := Resolve(publishedProSkill(), user)
	assert.False(t, result.Locked)
	assert.True(t, result.Executable)
	assert.Equal(t, CTAUse, result.CTA)
	assert.Equal(t, true, *result.Enabled)
}

// Row 6: Pro expired + Pro Skill + Inactive + Enabled → SKILL_SUBSCRIPTION_INACTIVE / renew
func TestResolve_ProExpired_ProSkill_SubInactive(t *testing.T) {
	user := UserInfo{
		Plan:       enums.RequiredPlanPro,
		SubActive:  false, // expired
		IsEnabled:  true,
		WasEnabled: true,
	}

	result := Resolve(publishedProSkill(), user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillSubscriptionInactive, result.LockCode)
	assert.Equal(t, CTARenew, result.CTA)
	assert.False(t, result.Executable)
}

// Row 7: Enterprise user + Pro Skill + Active + Enabled → use (enterprise satisfies pro)
func TestResolve_EnterpriseUser_ProSkill_Enabled(t *testing.T) {
	user := enterpriseUserActive()
	user.IsEnabled = true
	user.WasEnabled = true

	result := Resolve(publishedProSkill(), user)
	assert.False(t, result.Locked)
	assert.True(t, result.Executable)
	assert.Equal(t, CTAUse, result.CTA)
}

// Row 8: Non-enterprise + Enterprise Skill → SKILL_PLAN_REQUIRED / contact_sales
func TestResolve_FreeUser_EnterpriseSkill(t *testing.T) {
	result := Resolve(publishedEnterpriseSkill(), freeUserActive())
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillPlanRequired, result.LockCode)
	assert.Equal(t, CTAContactSales, result.CTA)
}

func TestResolve_ProUser_EnterpriseSkill(t *testing.T) {
	user := proUserActive()
	user.IsEnabled = false

	result := Resolve(publishedEnterpriseSkill(), user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillPlanRequired, result.LockCode)
	assert.Equal(t, CTAContactSales, result.CTA)
}

// Row 9: Any logged-in + Published + Active + Not Enabled → enable CTA (not locked)
func TestResolve_LoggedIn_Published_NotEnabled(t *testing.T) {
	user := freeUserActive()
	user.IsEnabled = false
	user.WasEnabled = false

	result := Resolve(publishedFreeSkill(), user)
	assert.False(t, result.Locked, "entitled user who hasn't enabled should NOT be locked")
	assert.Equal(t, CTAEnable, result.CTA)
	assert.False(t, result.Executable)
	assert.Equal(t, false, *result.Enabled)
}

func TestResolve_ProUser_ProSkill_NotEnabled(t *testing.T) {
	user := proUserActive()
	user.IsEnabled = false

	result := Resolve(publishedProSkill(), user)
	assert.False(t, result.Locked)
	assert.Equal(t, CTAEnable, result.CTA)
	assert.False(t, result.Executable)
}

// Row 10: Any logged-in + Draft Skill → SKILL_NOT_PUBLISHED / unavailable
func TestResolve_DraftSkill(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusDraft,
		RequiredPlan: enums.RequiredPlanFree,
	}
	result := Resolve(skill, freeUserActive())
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillNotPublished, result.LockCode)
	assert.Equal(t, CTAUnavailable, result.CTA)
}

// Row 11: Any logged-in + Archived Skill → SKILL_NOT_PUBLISHED / unavailable
func TestResolve_ArchivedSkill(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusArchived,
		RequiredPlan: enums.RequiredPlanFree,
	}
	result := Resolve(skill, freeUserActive())
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillNotPublished, result.LockCode)
	assert.Equal(t, CTAUnavailable, result.CTA)
}

// Row 12: New user + Deprecated Skill → SKILL_NOT_PUBLISHED / unavailable (not discoverable)
func TestResolve_DeprecatedSkill_NewUser(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusDeprecated,
		RequiredPlan: enums.RequiredPlanFree,
	}
	user := freeUserActive()
	user.IsEnabled = false
	user.WasEnabled = false // never enabled

	result := Resolve(skill, user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillNotPublished, result.LockCode)
	assert.Equal(t, CTAUnavailable, result.CTA)
}

// Row 13: Existing enabled user + Deprecated Skill + Active/entitled → use (executable)
func TestResolve_DeprecatedSkill_ExistingEnabledUser(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusDeprecated,
		RequiredPlan: enums.RequiredPlanFree,
	}
	user := freeUserActive()
	user.IsEnabled = true
	user.WasEnabled = true

	result := Resolve(skill, user)
	assert.False(t, result.Locked)
	assert.True(t, result.Executable)
	assert.Equal(t, CTAUse, result.CTA)
}

// Row 14: Existing disabled user + Deprecated Skill → SKILL_NOT_PUBLISHED / unavailable (cannot re-enable)
func TestResolve_DeprecatedSkill_DisabledUser(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusDeprecated,
		RequiredPlan: enums.RequiredPlanFree,
	}
	user := freeUserActive()
	user.IsEnabled = false
	user.WasEnabled = true // previously enabled, now disabled

	result := Resolve(skill, user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillNotPublished, result.LockCode)
	assert.Equal(t, CTAUnavailable, result.CTA)
}

// Row 15: Kids Session + Non-Kids-Safe Skill → SKILL_KIDS_MODE_BLOCKED / unavailable
func TestResolve_KidsSession_NonKidsSafeSkill(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusPublished,
		RequiredPlan: enums.RequiredPlanFree,
		IsKidsSafe:   false,
	}
	user := freeUserActive()
	user.IsKidsSession = true
	user.IsEnabled = true
	user.WasEnabled = true

	result := Resolve(skill, user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillKidsModeBlocked, result.LockCode)
	assert.Equal(t, CTAUnavailable, result.CTA)
	assert.False(t, result.Executable)
}

// Row 15 complement: Kids Session + Kids-Safe Skill → allow (not blocked)
func TestResolve_KidsSession_KidsSafeSkill(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusPublished,
		RequiredPlan: enums.RequiredPlanFree,
		IsKidsSafe:   true,
	}
	user := freeUserActive()
	user.IsKidsSession = true
	user.IsEnabled = true
	user.WasEnabled = true

	result := Resolve(skill, user)
	assert.False(t, result.Locked)
	assert.True(t, result.Executable)
	assert.Equal(t, CTAUse, result.CTA)
}

// Row 16: Normal Session + Kids-Exclusive Skill → SKILL_KIDS_MODE_BLOCKED / unavailable
func TestResolve_NormalSession_KidsExclusiveSkill(t *testing.T) {
	skill := SkillInfo{
		Status:          enums.SkillStatusPublished,
		RequiredPlan:    enums.RequiredPlanFree,
		IsKidsSafe:      true,
		IsKidsExclusive: true,
	}
	user := freeUserActive()
	user.IsKidsSession = false // normal session
	user.IsEnabled = true
	user.WasEnabled = true

	result := Resolve(skill, user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillKidsModeBlocked, result.LockCode)
	assert.Equal(t, CTAUnavailable, result.CTA)
}

// ── Additional edge-case and invariant tests ────────────────────────────────

// Enterprise user + Enterprise Skill + Active + Not Enabled → enable CTA
func TestResolve_EnterpriseUser_EnterpriseSkill_NotEnabled(t *testing.T) {
	user := enterpriseUserActive()
	user.IsEnabled = false

	result := Resolve(publishedEnterpriseSkill(), user)
	assert.False(t, result.Locked)
	assert.Equal(t, CTAEnable, result.CTA)
	assert.False(t, result.Executable)
	assert.Equal(t, false, *result.Enabled)
}

// Free Skill with nil FreeQuotaPerMonth: no quota check regardless of usage.
func TestResolve_FreeSkill_NoQuotaLimit(t *testing.T) {
	skill := SkillInfo{
		Status:            enums.SkillStatusPublished,
		RequiredPlan:      enums.RequiredPlanFree,
		FreeQuotaPerMonth: nil, // no limit
	}
	user := freeUserActive()
	user.IsEnabled = true
	user.QuotaUsed = 999999

	result := Resolve(skill, user)
	assert.False(t, result.Locked)
	assert.True(t, result.Executable)
	assert.Equal(t, CTAUse, result.CTA)
}

// Sub-inactive check applies only for non-free skills.
// Free user with SubActive=false on a free skill must still be allowed.
func TestResolve_FreeUser_SubInactive_FreeSkill(t *testing.T) {
	skill := publishedFreeSkill()
	user := UserInfo{
		Plan:       enums.RequiredPlanFree,
		SubActive:  false, // free plan; this field is irrelevant for free skills
		IsEnabled:  true,
		WasEnabled: true,
	}

	result := Resolve(skill, user)
	assert.False(t, result.Locked)
	assert.True(t, result.Executable)
	assert.Equal(t, CTAUse, result.CTA)
}

// Enterprise user + Pro Skill + Sub expired → subscription_inactive (not plan_required).
func TestResolve_EnterpriseExpired_ProSkill(t *testing.T) {
	user := UserInfo{
		Plan:       enums.RequiredPlanEnterprise,
		SubActive:  false, // enterprise subscription expired
		IsEnabled:  true,
		WasEnabled: true,
	}

	result := Resolve(publishedProSkill(), user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillSubscriptionInactive, result.LockCode)
	assert.Equal(t, CTARenew, result.CTA)
}

// Deprecated skill + existing enabled user + plan expired → subscription_inactive
// (entitlement checks still run for deprecated+enabled users).
func TestResolve_DeprecatedSkill_EnabledUser_SubInactive(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusDeprecated,
		RequiredPlan: enums.RequiredPlanPro,
	}
	user := UserInfo{
		Plan:       enums.RequiredPlanPro,
		SubActive:  false, // expired
		IsEnabled:  true,
		WasEnabled: true,
	}

	result := Resolve(skill, user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillSubscriptionInactive, result.LockCode)
	assert.Equal(t, CTARenew, result.CTA)
}

// Kids check fires BEFORE lifecycle check. A kids-unsafe archived skill seen
// from a Kids Session must return kids-blocked, not skill-not-published,
// because kids safety has higher precedence (FR-G9).
func TestResolve_KidsSession_UnsafeArchivedSkill_KidsBlockFirst(t *testing.T) {
	skill := SkillInfo{
		Status:       enums.SkillStatusArchived,
		RequiredPlan: enums.RequiredPlanFree,
		IsKidsSafe:   false,
	}
	user := freeUserActive()
	user.IsKidsSession = true

	result := Resolve(skill, user)
	assert.True(t, result.Locked)
	assert.Equal(t, errcodes.ErrSkillKidsModeBlocked, result.LockCode)
	assert.Equal(t, CTAUnavailable, result.CTA)
}

// Executable must be false whenever Locked is true.
func TestResolve_ExecutableIsFalseWhenLocked(t *testing.T) {
	cases := []struct {
		name  string
		skill SkillInfo
		user  UserInfo
	}{
		{
			name:  "anonymous",
			skill: publishedFreeSkill(),
			user:  UserInfo{IsAnonymous: true},
		},
		{
			name:  "plan required",
			skill: publishedProSkill(),
			user:  freeUserActive(),
		},
		{
			name:  "subscription inactive",
			skill: publishedProSkill(),
			user:  UserInfo{Plan: enums.RequiredPlanPro, SubActive: false, IsEnabled: true, WasEnabled: true},
		},
		{
			name: "quota exceeded",
			skill: SkillInfo{
				Status:            enums.SkillStatusPublished,
				RequiredPlan:      enums.RequiredPlanFree,
				FreeQuotaPerMonth: intPtr(5),
			},
			user: func() UserInfo {
				u := freeUserActive()
				u.IsEnabled = true
				u.QuotaUsed = 5
				return u
			}(),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := Resolve(tc.skill, tc.user)
			assert.True(t, r.Locked)
			assert.False(t, r.Executable, "Executable must be false when Locked")
		})
	}
}

// When Locked==false and Enabled==true, Executable must be true.
func TestResolve_ExecutableIsTrueWhenUnlockedAndEnabled(t *testing.T) {
	user := freeUserActive()
	user.IsEnabled = true
	user.WasEnabled = true

	r := Resolve(publishedFreeSkill(), user)
	assert.False(t, r.Locked)
	assert.True(t, r.Executable)
}

// LockCode must be empty when Locked is false.
func TestResolve_LockCodeEmptyWhenNotLocked(t *testing.T) {
	cases := []struct {
		name  string
		skill SkillInfo
		user  UserInfo
	}{
		{
			name:  "entitled not enabled",
			skill: publishedFreeSkill(),
			user:  freeUserActive(),
		},
		{
			name: "entitled and enabled",
			skill: publishedFreeSkill(),
			user: func() UserInfo {
				u := freeUserActive()
				u.IsEnabled = true
				u.WasEnabled = true
				return u
			}(),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := Resolve(tc.skill, tc.user)
			assert.False(t, r.Locked)
			assert.Equal(t, errcodes.ErrorCode(""), r.LockCode, "LockCode must be empty when not locked")
		})
	}
}

// Quota boundary: exactly one below limit → allowed.
func TestResolve_QuotaBoundary_OneBelowLimit(t *testing.T) {
	skill := SkillInfo{
		Status:            enums.SkillStatusPublished,
		RequiredPlan:      enums.RequiredPlanFree,
		FreeQuotaPerMonth: intPtr(10),
	}
	user := freeUserActive()
	user.IsEnabled = true
	user.QuotaUsed = 9 // one below limit

	result := Resolve(skill, user)
	assert.False(t, result.Locked)
	assert.True(t, result.Executable)
	assert.Equal(t, CTAUse, result.CTA)
}

// ── CTA enum string values ────────────────────────────────────────────────

func TestCTA_StringValues(t *testing.T) {
	assert.Equal(t, "use", string(CTAUse))
	assert.Equal(t, "enable", string(CTAEnable))
	assert.Equal(t, "upgrade", string(CTAUpgrade))
	assert.Equal(t, "renew", string(CTARenew))
	assert.Equal(t, "contact_sales", string(CTAContactSales))
	assert.Equal(t, "login", string(CTALogin))
	assert.Equal(t, "unavailable", string(CTAUnavailable))
}

// ── planSatisfied helper ─────────────────────────────────────────────────

func TestPlanSatisfied(t *testing.T) {
	cases := []struct {
		required enums.RequiredPlan
		user     enums.RequiredPlan
		want     bool
	}{
		{enums.RequiredPlanFree, enums.RequiredPlanFree, true},
		{enums.RequiredPlanFree, enums.RequiredPlanPro, true},
		{enums.RequiredPlanFree, enums.RequiredPlanEnterprise, true},
		{enums.RequiredPlanPro, enums.RequiredPlanFree, false},
		{enums.RequiredPlanPro, enums.RequiredPlanPro, true},
		{enums.RequiredPlanPro, enums.RequiredPlanEnterprise, true},
		{enums.RequiredPlanEnterprise, enums.RequiredPlanFree, false},
		{enums.RequiredPlanEnterprise, enums.RequiredPlanPro, false},
		{enums.RequiredPlanEnterprise, enums.RequiredPlanEnterprise, true},
	}
	for _, tc := range cases {
		got := planSatisfied(tc.required, tc.user)
		assert.Equal(t, tc.want, got,
			"planSatisfied(required=%q, user=%q)", tc.required, tc.user)
	}
}
