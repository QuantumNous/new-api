package skillrelay

import (
	"errors"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"gorm.io/gorm"
)

// deprecatedRuntimeEnabled gates whether deprecated+enabled skills may execute.
// D3=b (DR-66): kept FALSE — deprecated stays fail-closed (SKILL_NOT_PUBLISHED)
// until DR-67 adds the step-9 use-time entitlement check ("already-enabled AND
// STILL-entitled", tasks/05 §5.1 + tasks/01 §6 status table).
//
// DR-67 flips this constant in the SAME PR that adds the use-time entitlement
// gate. Never flip alone: flipping without DR-67 would re-open the "enabled is
// enough, still-entitled missing" gap that D3=b exists to avoid. The open branch
// (allowDeprecated && enabled → pass) is implemented + tested now (see
// TestLifecycleEnabledDecision_FutureDR67_DeprecatedEnabledAllowedWhenFlagOn) but
// not live — this is a staged cross-ticket handoff seam, not dead code.
const deprecatedRuntimeEnabled = false

// lifecycleEnabledDecision is the pure-function form of the DR-66 lifecycle +
// enabled-state truth table (no DB, exhaustively unit-testable in both flag states).
//
// hasActiveVersion mirrors resolve()'s active-version requirement; enabled is the
// per-(user, skill) use-time authority from user_enabled_skills; allowDeprecated
// is deprecatedRuntimeEnabled (false in DR-66).
//
// Returns "" to allow execution; otherwise the skill error code the caller must abort with.
func lifecycleEnabledDecision(status enums.SkillStatus, hasActiveVersion, enabled, allowDeprecated bool) errcodes.ErrorCode {
	if !hasActiveVersion {
		return errcodes.ErrSkillNotPublished
	}
	switch status {
	case enums.SkillStatusPublished:
		if enabled {
			return ""
		}
		return errcodes.ErrSkillNotEnabled
	case enums.SkillStatusDeprecated:
		// Opened by DR-67 (flag flip + entitlement gate). D3=b: fail-closed here;
		// this also serves the "unavailable deprecated" case for non-enabled users.
		if allowDeprecated && enabled {
			return ""
		}
		return errcodes.ErrSkillNotPublished
	default: // draft / archived / unknown
		return errcodes.ErrSkillNotPublished
	}
}

// userSkillEnabled reads the enabled flag for (userID, tenantID=userID, skillID)
// from user_enabled_skills.
//
// V1 code-reality constraint: tenant_id == user_id (no separate tenant entity).
// NOT a long-term product rule — see DR-66 design D4.
//
// Narrow single-column read (matches resolver's existing Select style). A missing
// row means "never enabled" → (false, nil); only a real DB error returns a non-nil
// error, which the caller maps to SKILL_INTERNAL_ERROR. disabled_at is intentionally
// NOT read: enabled is the sole use-time authority in V1; disabled_at is audit-only
// metadata (DR-66 design §5.2).
func userSkillEnabled(database *gorm.DB, userID int64, skillID string) (bool, error) {
	var enabled bool
	err := database.Model(&skillmodel.UserEnabledSkill{}).
		Select("enabled").
		Where("user_id = ? AND tenant_id = ? AND skill_id = ?", userID, userID, skillID).
		Take(&enabled).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	return enabled, nil
}
