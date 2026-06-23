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

	if skill.Status != enums.SkillStatusPublished {
		return nil, errcodes.ErrSkillNotPublished
	}
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
		Plan:           groupToPlan(user.Group),
		SubActive:      true, // TODO(DR-subscription): replace with subscription table lookup
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
