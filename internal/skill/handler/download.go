package handler

import (
	"errors"
	"fmt"
	"net/http"

	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/QuantumNous/new-api/internal/skill/packaging"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// DownloadSkillPackage serves GET /api/v1/marketplace/skills/:id/download (DR-81).
//
// Requires an authenticated, entitled user (SkillUserAuth → AUTH_REQUIRED when
// absent). Returns the versioned zip for the active published version, pinned to
// skill_version_id. The package carries no provider credentials and no routing
// logic; its bundled client authenticates at runtime with the runner's own key.
func DownloadSkillPackage(c *gin.Context) {
	userID, ok := authenticatedUserID(c)
	if !ok {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Login required to download a Skill package.", nil)
		return
	}

	db, ok := skillDB(c)
	if !ok {
		return
	}

	var skill skillmodel.Skill
	err := db.Where("status = ?", enums.SkillStatusPublished).
		Where("id = ? OR slug = ?", c.Param("id"), c.Param("id")).
		First(&skill).Error
	if err != nil {
		writeSkillLookupError(c, err)
		return
	}

	if skill.ActiveVersionID == nil || *skill.ActiveVersionID == "" {
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Skill has no active version to package.", nil)
		return
	}

	var version skillmodel.SkillVersion
	if err := db.Where("id = ?", *skill.ActiveVersionID).First(&version).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			skillapi.Error(c, errcodes.ErrSkillInternalError, "Active Skill version not found.", nil)
			return
		}
		writeDBError(c, err)
		return
	}

	zipBytes, err := packaging.BuildPackage(skill, version)
	if err != nil {
		skillapi.Error(c, errcodes.ErrSkillInternalError, "Failed to build Skill package.", nil)
		return
	}

	// Record the download as an entitlement (spec §8.6 emits skill_enabled).
	// V1 has no separate tenant entity: tenant_id == user_id (UserEnabledSkill doc).
	// A bookkeeping failure must not block the download itself.
	_ = skillmodel.EnableSkillForUser(db, userID, userID, skill.ID, "skill_package")

	filename := packaging.Filename(skill, version)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	c.Header("X-Skill-Version-Id", version.ID)
	c.Data(http.StatusOK, "application/zip", zipBytes)
}

// authenticatedUserID extracts the platform user id set by SkillUserAuth.
// Returns (0, false) when no positive id is present in the context.
func authenticatedUserID(c *gin.Context) (int64, bool) {
	raw, exists := c.Get("id")
	if !exists {
		return 0, false
	}
	switch v := raw.(type) {
	case int:
		if v > 0 {
			return int64(v), true
		}
	case int64:
		if v > 0 {
			return v, true
		}
	}
	return 0, false
}
