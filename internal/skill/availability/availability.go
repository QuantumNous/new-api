// Package availability implements the Skill Marketplace availability resolver
// (DR-72, M06). It returns the lock state, error code, and call-to-action for
// a (user, skill) pair, forming the single entitlement source of truth shared
// by the Marketplace UI (DR-52/63/64) and Relay pre-execution checks (DR-67).
//
// Decision table source: tasks/01_Functional_Requirements.md §6.
// API shapes: tasks/03_Data_Model_and_API_Spec.md §8.1-8.3.
package availability

import (
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/QuantumNous/new-api/internal/skill/pricing"
)

// CTA is the UI call-to-action rendered for a skill's current availability state.
type CTA string

const (
	// CTAUse is shown when the skill is enabled and fully executable.
	CTAUse CTA = "use"
	// CTAEnable is shown when the user is entitled but has not yet enabled the skill.
	CTAEnable CTA = "enable"
	// CTAUpgrade is shown when the user's plan is insufficient (pro required, user is free).
	CTAUpgrade CTA = "upgrade"
	// CTARenew is shown when the user's subscription has expired (subscription_inactive).
	CTARenew CTA = "renew"
	// CTAContactSales is shown when enterprise plan is required.
	CTAContactSales CTA = "contact_sales"
	// CTALogin is shown to anonymous visitors who must sign in to enable/use the skill.
	CTALogin CTA = "login"
	// CTAUnavailable is shown for archived, deprecated-unavailable, or kids-blocked skills.
	CTAUnavailable CTA = "unavailable"
)

// Result is the availability and lock state for a (user, skill) pair.
//
// Marketplace List / Skill Detail use the Enabled + Locked + LockCode + CTA fields.
// My Skills uses the Executable + Locked + LockCode + CTA fields.
// Relay (DR-67) uses Locked + LockCode to decide whether to block execution.
type Result struct {
	// Enabled is the user's enablement state.
	// nil  = anonymous visitor (no identity context).
	// true = user_enabled_skills.enabled is true.
	// false = skill exists but user has not enabled it (or it is disabled).
	Enabled *bool

	// Executable reports whether the skill can be run in the current session.
	// True only when Locked==false and the user has enabled the skill.
	// Used in My Skills response field "executable".
	Executable bool

	// Locked reports whether execution (and enable, for blocked cases) is prevented.
	Locked bool

	// LockCode is the canonical API error code explaining the lock.
	// Empty string when Locked==false.
	LockCode errcodes.ErrorCode

	// CTA is the primary call-to-action the UI should render.
	CTA CTA
}

// SkillInfo contains the skill fields required by the resolver.
// Populated from the skills table row (via the API query layer).
type SkillInfo struct {
	// Status is the skill lifecycle state.
	Status enums.SkillStatus

	// RequiredPlan is the minimum subscription tier to enable and execute this skill.
	RequiredPlan enums.RequiredPlan

	// IsKidsSafe must be true for the skill to be executable in a Kids Session.
	IsKidsSafe bool

	// IsKidsExclusive blocks the skill from normal (non-Kids) sessions.
	IsKidsExclusive bool

	// FreeQuotaPerMonth is the monthly execution quota for free-path users.
	// nil means no quota limit applies.
	FreeQuotaPerMonth *int

	// MonetizationType is the Skill pricing tier.
	MonetizationType enums.MonetizationType
}

// UserInfo contains the caller's entitlement context for a single skill resolution.
// Populated from the authenticated session, user record, and user_enabled_skills row.
type UserInfo struct {
	// IsAnonymous is true when no authenticated user is present.
	// When true, all other fields are ignored.
	IsAnonymous bool

	// IsKidsSession is true when the server-resolved kids mode is active for this session.
	// Must be set server-side only; client-provided values must be discarded upstream.
	IsKidsSession bool

	// Plan is the user's current subscription tier (free, pro, enterprise).
	Plan enums.RequiredPlan

	// SubActive is true when the user's current subscription is active.
	// For free-plan users this is always true (free plans do not expire).
	// For pro/enterprise users, false signals an expired or cancelled subscription.
	SubActive bool

	// QuotaUsed is the number of free-quota executions consumed this month.
	// Only evaluated when SkillInfo.FreeQuotaPerMonth is non-nil.
	QuotaUsed int

	// IsEnabled is true when user_enabled_skills.enabled = true for this (user, skill) pair.
	IsEnabled bool

	// WasEnabled is true when a user_enabled_skills row exists for this (user, skill) pair,
	// regardless of the current enabled value. Required for deprecated-skill rules:
	// only users who previously enabled a skill retain the right to continue execution
	// after the skill is deprecated; new users and users who disabled it do not.
	WasEnabled bool

	// HasOneTimeEntitlement is true when a durable USD 2 one-time purchase grant exists.
	HasOneTimeEntitlement bool
}

// Resolve returns the availability/lock state for a (user, skill) pair.
//
// The result is deterministic given the inputs. Callers are responsible for
// loading the skill and user records; this function contains no I/O.
//
// Precedence order (earliest match wins):
//  1. Anonymous → AUTH_REQUIRED / login
//  2. Kids mode gate (safety-critical, evaluated before lifecycle)
//  3. Lifecycle: archived, draft → unavailable; deprecated → existing-enabled-only
//  4. Plan hierarchy: enterprise or pro required
//  5. Subscription active (non-free skills only)
//  6. Enable state: entitled but not enabled → Locked=true, ErrSkillNotEnabled, CTAEnable (UI may enable; execution blocked)
//  7. Free quota cap (only relevant for enabled users; quota is an execution limit,
//     not an enablement limit — tasks/01 §6 rows 2/3 both require Enabled=true)
//  8. Entitled and enabled → use / executable
func Resolve(skill SkillInfo, user UserInfo) Result {
	// 1. Anonymous visitor: cannot enable or execute; show login CTA.
	if user.IsAnonymous {
		return Result{
			Locked:   true,
			LockCode: errcodes.ErrAuthRequired,
			CTA:      CTALogin,
		}
	}

	enabled := boolPtr(user.IsEnabled)

	// 2. Kids mode gate (safety-critical path; evaluated before lifecycle checks).
	//    kids_mode > lifecycle per FR-G9 precedence.
	if user.IsKidsSession && !skill.IsKidsSafe {
		return Result{
			Enabled:  enabled,
			Locked:   true,
			LockCode: errcodes.ErrSkillKidsModeBlocked,
			CTA:      CTAUnavailable,
		}
	}
	if !user.IsKidsSession && skill.IsKidsExclusive {
		return Result{
			Enabled:  enabled,
			Locked:   true,
			LockCode: errcodes.ErrSkillKidsModeBlocked,
			CTA:      CTAUnavailable,
		}
	}

	// 3. Lifecycle checks.
	switch skill.Status {
	case enums.SkillStatusArchived, enums.SkillStatusDraft:
		return Result{
			Enabled:  enabled,
			Locked:   true,
			LockCode: errcodes.ErrSkillNotPublished,
			CTA:      CTAUnavailable,
		}
	case enums.SkillStatusDeprecated:
		// Deprecated skills are not discoverable to new users and cannot be
		// re-enabled by users who previously disabled them. Only users who
		// currently have enabled=true retain the right to continue execution.
		// (tasks/01 §5.1, §6; tasks/03 §8.1 "Deprecated Skills are not shown
		// in Marketplace to new users".)
		if !user.IsEnabled {
			return Result{
				Enabled:  enabled,
				Locked:   true,
				LockCode: errcodes.ErrSkillNotPublished,
				CTA:      CTAUnavailable,
			}
		}
		// user.IsEnabled == true: continue to plan and quota checks.
		// WasEnabled is not re-checked here; IsEnabled already implies it.
	}
	// Reaches here for: published, or deprecated+currently-enabled.

	monetization := skill.MonetizationType
	if monetization == "" {
		monetization = enums.MonetizationTypePlanIncluded
	}
	decision := pricing.ResolveEntitlement(pricing.EntitlementInput{
		RequiredPlan:          skill.RequiredPlan,
		MonetizationType:      monetization,
		UserPlan:              user.Plan,
		SubscriptionActive:    user.SubActive,
		HasOneTimeEntitlement: user.HasOneTimeEntitlement,
	})
	if !decision.Allowed {
		cta := CTAUpgrade
		if decision.Code == errcodes.ErrSkillSubscriptionInactive {
			cta = CTARenew
		} else if skill.RequiredPlan == enums.RequiredPlanEnterprise {
			cta = CTAContactSales
		}
		return Result{
			Enabled:  enabled,
			Locked:   true,
			LockCode: decision.Code,
			CTA:      cta,
		}
	}

	// 6. Entitled but not yet enabled.
	//    PRD §6: "Block execution; allow enable if entitled" — Locked=true prevents
	//    Relay execution gate from proceeding. CTAEnable signals the UI to offer the
	//    enable action; it does NOT mean the skill is executable or unlocked.
	//    Quota must not be evaluated before this: quota is an execution limit, not
	//    an enablement limit (tasks/01 §6 rows 2-3 require Enabled=true for quota).
	if !user.IsEnabled {
		return Result{
			Enabled:  boolPtr(false),
			Locked:   true,
			LockCode: errcodes.ErrSkillNotEnabled,
			CTA:      CTAEnable,
		}
	}

	// 7. Free quota cap (enabled users only; tasks/01 §6 rows 2-3 require Enabled=true).
	if skill.FreeQuotaPerMonth != nil && user.QuotaUsed >= *skill.FreeQuotaPerMonth {
		return Result{
			Enabled:  enabled,
			Locked:   true,
			LockCode: errcodes.ErrSkillQuotaExceeded,
			CTA:      CTAUpgrade,
		}
	}

	// 8. Fully entitled and enabled.
	return Result{
		Enabled:    boolPtr(true),
		Executable: true,
		Locked:     false,
		CTA:        CTAUse,
	}
}

func boolPtr(b bool) *bool { return &b }

// planSatisfied is kept package-private for existing availability regression tests.
func planSatisfied(required, user enums.RequiredPlan) bool {
	return pricing.ResolveEntitlement(pricing.EntitlementInput{
		RequiredPlan:       required,
		MonetizationType:   enums.MonetizationTypePlanIncluded,
		UserPlan:           user,
		SubscriptionActive: true,
	}).Allowed
}
