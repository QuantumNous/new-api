package skillrelay

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var db *gorm.DB

// SetDB wires the shared DB instance used for skill lookups.
// Must be called during router setup before the first request (see router/skill-router.go).
func SetDB(database *gorm.DB) { db = database }

// Resolve is the relay entry point for DR-64/65.
// It reads user identity exclusively from the auth context, loads the Skill plus
// immutable active SkillVersion snapshot from DB, and returns a SkillRelayContext.
//
// Returns (ctx, "") on success.
// Returns (nil, errCode) on any failure; caller must abort the request.
func Resolve(c *gin.Context, skillID string) (*SkillRelayContext, errcodes.ErrorCode) {
	return resolve(c, db, skillID)
}

// ResolveVersion is the public routing/package execution entry point when a
// downloaded package provides a manifest-pinned skill_version_id. Identity still
// comes exclusively from the authenticated request context; the version pin is
// only accepted after the server verifies it belongs to the requested published
// Skill and is active.
func ResolveVersion(c *gin.Context, skillID string, skillVersionID string) (*SkillRelayContext, errcodes.ErrorCode) {
	return resolveVersion(c, db, skillID, skillVersionID)
}

// resolve is the pure, DB-injectable core of Resolve. Used directly in tests.
func resolve(c *gin.Context, database *gorm.DB, skillID string) (*SkillRelayContext, errcodes.ErrorCode) {
	return resolveVersion(c, database, skillID, "")
}

// resolveVersion is the pure, DB-injectable core of ResolveVersion. Used directly in tests.
func resolveVersion(c *gin.Context, database *gorm.DB, skillID string, skillVersionID string) (*SkillRelayContext, errcodes.ErrorCode) {
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	if userID == 0 {
		return nil, errcodes.ErrAuthRequired
	}

	user := airbotixUser(c)
	if user == nil {
		if database == nil {
			return nil, errcodes.ErrSkillInternalError
		}
		var dbUser platformmodel.User
		if err := database.Select([]string{"id", "group", "kids_mode", "status"}).
			Where("id = ?", userID).First(&dbUser).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, errcodes.ErrAuthRequired
			}
			return nil, errcodes.ErrSkillInternalError
		}
		user = &dbUser
	}
	if user.Status == common.UserStatusDisabled {
		return nil, errcodes.ErrAuthRequired
	}

	if database == nil {
		return nil, errcodes.ErrSkillInternalError
	}

	var skill skillmodel.Skill
	if err := database.
		Select([]string{
			"id",
			"status",
			"required_plan",
			"active_version_id",
			"slug",
			"name",
			"timeout_seconds",
			"max_input_tokens",
			"model_whitelist",
			"is_kids_safe",
			"is_kids_exclusive",
		}).
		Where("id = ?", skillID).Take(&skill).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcodes.ErrSkillNotFound
		}
		return nil, errcodes.ErrSkillInternalError
	}

	// DR-66 lifecycle + enabled-state gate (tasks/05 §5.1 step 8, before the
	// SkillVersion snapshot SELECT / LoadAndApply). Gate failure returns here, so a
	// disabled / draft / archived skill never loads a
	// snapshot or prompt ("No prompt load", tasks/05 error table; threat T-05).
	//
	// Short-circuit (fixed requirement, not an optimisation): only a published
	// skill WITH an active version (and, once DR-67 flips the flag, deprecated)
	// needs the enabled lookup. A missing active version, draft, archived, or
	// deprecated without DR-67's live flag is rejected on lifecycle alone, so it must
	// NOT query user_enabled_skills. Gating the lookup on hasActiveVersion also preserves error
	// priority: a published-but-no-active-version skill returns SKILL_NOT_PUBLISHED
	// even when the enabled lookup would have hit a DB error (which must not mask the
	// higher-priority lifecycle failure with SKILL_INTERNAL_ERROR).
	hasActiveVersion := skill.ActiveVersionID != nil
	enabled := false
	if hasActiveVersion &&
		(skill.Status == enums.SkillStatusPublished ||
			(deprecatedRuntimeEnabled && skill.Status == enums.SkillStatusDeprecated)) {
		e, err := userSkillEnabled(database, int64(userID), skill.ID)
		if err != nil {
			return nil, errcodes.ErrSkillInternalError
		}
		enabled = e
	}
	if code := lifecycleEnabledDecision(skill.Status, hasActiveVersion, enabled, deprecatedRuntimeEnabled); code != "" {
		return nil, code
	}

	// DR-63 version selection (runs AFTER the DR-66 gate authorises execution): use
	// the manifest-pinned version if provided, else the skill's active version. The
	// snapshot SELECT below still requires the selected version to be active.
	selectedVersionID := strings.TrimSpace(skillVersionID)
	if selectedVersionID == "" {
		if skill.ActiveVersionID == nil {
			return nil, errcodes.ErrSkillNotPublished
		}
		selectedVersionID = *skill.ActiveVersionID
	}
	if strings.TrimSpace(selectedVersionID) == "" {
		return nil, errcodes.ErrSkillNotPublished
	}

	var skillVersion skillmodel.SkillVersion
	var versionEntitlement struct {
		ID                   string
		SkillID              string
		Status               enums.SkillVersionStatus
		RequiredPlanSnapshot enums.RequiredPlan
	}
	if err := database.Model(&skillmodel.SkillVersion{}).
		Select([]string{
			"id",
			"skill_id",
			"status",
			"required_plan_snapshot",
		}).
		Where("id = ? AND skill_id = ? AND status = ?", selectedVersionID, skill.ID, enums.SkillVersionStatusActive).
		Take(&versionEntitlement).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcodes.ErrSkillNotPublished
		}
		return nil, errcodes.ErrSkillInternalError
	}

	entitlement, err := resolveRuntimeEntitlement(database, userID, user.Group)
	if err != nil {
		return nil, errcodes.ErrSkillInternalError
	}
	if code := useTimeEntitlementDecision(versionEntitlement.RequiredPlanSnapshot, entitlement.Plan, entitlement.SubActive); code != "" {
		return nil, code
	}

	if err := database.
		Select([]string{
			"id",
			"skill_id",
			"status",
			"instruction_template",
			"model_whitelist_snapshot",
			"required_plan_snapshot",
			"monetization_snapshot",
			"max_input_tokens_snapshot",
		}).
		Where("id = ? AND skill_id = ? AND status = ?", selectedVersionID, skill.ID, enums.SkillVersionStatusActive).
		Take(&skillVersion).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcodes.ErrSkillNotPublished
		}
		return nil, errcodes.ErrSkillInternalError
	}
	if strings.TrimSpace(skillVersion.InstructionTemplate) == "" {
		return nil, errcodes.ErrSkillInternalError
	}

	return &SkillRelayContext{
		RequestID:      uuid.New().String(),
		SkillID:        skillID,
		SkillVersionID: skillVersion.ID,
		UserID:         userID,
		IsKidsSession:  user.KidsMode,
		Plan:           entitlement.Plan,
		SubActive:      entitlement.SubActive,
		Skill:          &skill,
		SkillVersion:   &skillVersion,
	}, ""
}

// airbotixUser retrieves the *model.User pre-loaded by middleware/policy.go.
// Returns nil if the policy middleware did not run or the context key is absent.
func airbotixUser(c *gin.Context) *platformmodel.User {
	u, _ := common.GetContextKeyType[*platformmodel.User](c, constant.ContextKeyAirbotixUser)
	return u
}

// groupToPlan maps the platform user.Group string to a skill-marketplace RequiredPlan.
// "pro" and "enterprise" map directly; all other values (including the default "default")
// map to free. V1 mapping - a subscription table will supersede this in Phase 2.
func groupToPlan(group string) enums.RequiredPlan {
	switch group {
	case string(enums.RequiredPlanPro):
		return enums.RequiredPlanPro
	case string(enums.RequiredPlanEnterprise):
		return enums.RequiredPlanEnterprise
	default:
		return enums.RequiredPlanFree
	}
}
