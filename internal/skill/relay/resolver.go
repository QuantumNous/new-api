package skillrelay

import (
	"errors"

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

// Resolve is the relay entry point for DR-64 (tasks/05 §5.1 steps 1-6).
// It reads user identity exclusively from the auth context (T-21: never from the
// client payload), loads the Skill from DB, and returns a SkillRelayContext.
//
// Returns (ctx, "") on success.
// Returns (nil, errCode) on any failure — caller must abort the request.
func Resolve(c *gin.Context, skillID string) (*SkillRelayContext, errcodes.ErrorCode) {
	return resolve(c, db, skillID)
}

// resolve is the pure, DB-injectable core of Resolve. Used directly in tests.
func resolve(c *gin.Context, database *gorm.DB, skillID string) (*SkillRelayContext, errcodes.ErrorCode) {
	// Step 3: reject anonymous callers immediately (user_id=0 → not authenticated).
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)
	if userID == 0 {
		return nil, errcodes.ErrAuthRequired
	}

	// Steps 4-6: resolve identity server-side.
	// Prefer the *model.User already stashed by middleware/policy.go to avoid an
	// extra DB round-trip. Fall back to a targeted DB lookup when the middleware
	// did not run (e.g. direct unit tests or non-relay routes).
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

	// Load skill from DB — only fetch the columns needed for relay entry;
	// large text fields (description, example_inputs, etc.) are not read here.
	if database == nil {
		return nil, errcodes.ErrSkillInternalError
	}
	var skill skillmodel.Skill
	if err := database.
		Select([]string{"id", "status", "required_plan", "active_version_id", "slug", "name", "timeout_seconds", "max_input_tokens", "model_whitelist", "is_kids_safe", "is_kids_exclusive"}).
		Where("id = ?", skillID).Take(&skill).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errcodes.ErrSkillNotFound
		}
		return nil, errcodes.ErrSkillInternalError
	}
	// Only published skills with an active version are executable.
	// draft/deprecated/archived → SKILL_NOT_PUBLISHED (HTTP 403).
	if skill.Status != enums.SkillStatusPublished {
		return nil, errcodes.ErrSkillNotPublished
	}
	// active_version_id = NULL means the skill has no runnable version yet.
	// DR-88 (prompt injection) will dereference this pointer — guard it here
	// so no downstream handler ever receives a nil ActiveVersionID.
	if skill.ActiveVersionID == nil {
		return nil, errcodes.ErrSkillNotPublished
	}

	return &SkillRelayContext{
		RequestID:     uuid.New().String(),
		SkillID:       skillID,
		UserID:        userID,
		IsKidsSession: user.KidsMode,
		Plan:          groupToPlan(user.Group),
		SubActive:     true, // TODO(DR-subscription): replace with subscription table lookup
		Skill:         &skill,
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
// map to free. V1 mapping — a subscription table will supersede this in Phase 2.
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
