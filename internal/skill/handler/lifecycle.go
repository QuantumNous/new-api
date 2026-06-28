package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PublishSkillRequest struct {
	Reason string `json:"reason"`
}

type PublishChecklistItem struct {
	Key     string `json:"key"`
	Passed  bool   `json:"passed"`
	Message string `json:"message,omitempty"`
}

type PublishSkillResponse struct {
	Skill       AdminSkill             `json:"skill"`
	Checklist   []PublishChecklistItem `json:"checklist"`
	Version     SkillVersionMetadata   `json:"version"`
	PublishedAt time.Time              `json:"published_at"`
}

func PublishAdminSkill(c *gin.Context) {
	database, ok := skillDB(c)
	if !ok {
		return
	}
	var req PublishSkillRequest
	if !decodeJSONBody(c, &req) {
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Publish reason is required.", gin.H{"reason": "MISSING_REASON"})
		return
	}

	actorID := int64(c.GetInt("id"))
	role := strconv.Itoa(c.GetInt("role"))
	skillID := c.Param("skill_id")

	var published skillmodel.Skill
	var activeVersion skillmodel.SkillVersion
	var checklist []PublishChecklistItem
	err := database.Transaction(func(tx *gorm.DB) error {
		var skill skillmodel.Skill
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&skill, "id = ?", skillID).Error; err != nil {
			return err
		}
		if skill.Status != enums.SkillStatusDraft {
			return errPublishRequiresDraft
		}

		version, versionErr := loadActivePublishVersion(tx, skill)
		if versionErr != nil && !errors.Is(versionErr, gorm.ErrRecordNotFound) && !errors.Is(versionErr, errMissingActiveVersion) {
			return versionErr
		}
		checklist = buildPublishChecklist(skill, version, versionErr)
		if !publishChecklistPassed(checklist) {
			return errPublishChecklistFailed
		}
		before := skillPublishAuditBefore(skill)
		now := time.Now().UTC()
		zipBytes, err := buildSkillPackageForVersion(skill, version)
		if err != nil {
			return err
		}
		if err := storeVersionPackageArtifact(tx, version.ID, zipBytes, now); err != nil {
			return err
		}
		if err := publishDraftSkill(tx, skill, version, actorID, now); err != nil {
			return err
		}
		if err := tx.First(&published, "id = ?", skill.ID).Error; err != nil {
			return err
		}
		activeVersion = version
		reasonPtr := reason
		if err := writeSkillLifecycleAuditLog(tx, c, "publish", published.ID, version.ID, actorID, role, &reasonPtr, before, skillPublishAuditAfter(published, version)); err != nil {
			return err
		}
		if err := emitSkillAdminAction(tx, c, published, version.ID, actorID); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		writePublishSkillError(c, err, checklist)
		return
	}
	skillapi.Success(c, PublishSkillResponse{
		Skill:       adminSkillFromModel(published),
		Checklist:   checklist,
		Version:     skillVersionMetadataFromModel(activeVersion),
		PublishedAt: *published.PublishedAt,
	})
}

func publishDraftSkill(tx *gorm.DB, skill skillmodel.Skill, version skillmodel.SkillVersion, actorID int64, now time.Time) error {
	updates := map[string]any{
		"status":            enums.SkillStatusPublished,
		"published_at":      now,
		"active_version_id": version.ID,
		"updated_by":        actorID,
		"deprecated_at":     nil,
		"archived_at":       nil,
	}
	result := tx.Model(&skillmodel.Skill{}).
		Where("id = ? AND status = ? AND active_version_id = ?", skill.ID, enums.SkillStatusDraft, version.ID).
		Where("EXISTS (SELECT 1 FROM skill_versions WHERE id = ? AND skill_id = ? AND status = ?)", version.ID, skill.ID, enums.SkillVersionStatusActive).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errPublishStateChanged
	}
	return nil
}

func loadActivePublishVersion(tx *gorm.DB, skill skillmodel.Skill) (skillmodel.SkillVersion, error) {
	if skill.ActiveVersionID == nil || strings.TrimSpace(*skill.ActiveVersionID) == "" {
		return skillmodel.SkillVersion{}, errMissingActiveVersion
	}
	var version skillmodel.SkillVersion
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&version, "id = ? AND skill_id = ? AND status = ?", *skill.ActiveVersionID, skill.ID, enums.SkillVersionStatusActive).Error; err != nil {
		return skillmodel.SkillVersion{}, err
	}
	if strings.TrimSpace(version.InstructionTemplate) == "" {
		return skillmodel.SkillVersion{}, errMissingActiveVersion
	}
	return version, nil
}

func buildPublishChecklist(skill skillmodel.Skill, version skillmodel.SkillVersion, versionErr error) []PublishChecklistItem {
	return []PublishChecklistItem{
		checklistItem("active_version", versionErr == nil, "Active version is required."),
		checklistItem("required_metadata", publishRequiredMetadataComplete(skill), "Required metadata is incomplete."),
		checklistItem("examples", jsonArrayHasAny(skill.ExampleInputs) && jsonArrayHasAny(skill.ExampleOutputs), "At least one example input and output are required."),
		checklistItem("plan_and_monetization", skill.RequiredPlan.Valid() && skill.MonetizationType.Valid(), "Required plan and monetization type are required."),
		checklistItem("model_whitelist", jsonArrayHasNonEmptyString(skill.ModelWhitelist) && jsonArrayHasNonEmptyString(version.ModelWhitelistSnapshot), "Model whitelist is required."),
		checklistItem("max_input_tokens", publishMaxInputTokensSnapshotValid(skill, version), "max_input_tokens and active version max_input_tokens_snapshot are required and must match for Free/free-quota Skills."),
		checklistItem("download_usage_instructions", versionInstructionsPublishReady(version), "Download and usage instructions are required."),
	}
}

func checklistItem(key string, passed bool, message string) PublishChecklistItem {
	item := PublishChecklistItem{Key: key, Passed: passed}
	if !passed {
		item.Message = message
	}
	return item
}

func publishChecklistPassed(items []PublishChecklistItem) bool {
	for _, item := range items {
		if !item.Passed {
			return false
		}
	}
	return true
}

func publishRequiredMetadataComplete(skill skillmodel.Skill) bool {
	if strings.TrimSpace(skill.Name) == "" ||
		strings.TrimSpace(skill.ShortDescription) == "" ||
		strings.TrimSpace(skill.Description) == "" ||
		strings.TrimSpace(skill.Category) == "" ||
		skill.IconURL == nil ||
		strings.TrimSpace(*skill.IconURL) == "" {
		return false
	}
	return jsonArrayHasNonEmptyString(skill.Tags)
}

func publishRequiresMaxInputTokens(skill skillmodel.Skill) bool {
	return skill.RequiredPlan == enums.RequiredPlanFree ||
		skill.MonetizationType == enums.MonetizationTypeFree ||
		skill.FreeQuotaPerMonth != nil
}

func publishMaxInputTokensSnapshotValid(skill skillmodel.Skill, version skillmodel.SkillVersion) bool {
	if !publishRequiresMaxInputTokens(skill) {
		return true
	}
	if skill.MaxInputTokens == nil || version.MaxInputTokensSnapshot == nil {
		return false
	}
	return *skill.MaxInputTokens == *version.MaxInputTokensSnapshot
}

func versionInstructionsPublishReady(version skillmodel.SkillVersion) bool {
	return strings.TrimSpace(version.DownloadInstructions) != "" &&
		strings.TrimSpace(version.UsageInstructions) != ""
}

func jsonArrayHasAny(raw skillmodel.SkillJSONB) bool {
	var values []any
	if err := common.Unmarshal(raw, &values); err != nil {
		return false
	}
	return len(values) > 0
}

func jsonArrayHasNonEmptyString(raw skillmodel.SkillJSONB) bool {
	var values []string
	if err := common.Unmarshal(raw, &values); err != nil {
		return false
	}
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return true
		}
	}
	return false
}

func writeSkillLifecycleAuditLog(tx *gorm.DB, c *gin.Context, action, skillID, versionID string, actorID int64, actorRole string, reason *string, beforeValue, afterValue *skillmodel.SkillJSONB) error {
	requestID := skillapi.RequestID(c)
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()
	changedFields := skillmodel.SkillJSONB(`["status","published_at","active_version_id"]`)
	return tx.Create(&skillmodel.SkillAuditLog{
		SkillID:        &skillID,
		SkillVersionID: &versionID,
		ActorID:        actorID,
		ActorRole:      actorRole,
		Action:         action,
		ActionReason:   reason,
		ChangedFields:  changedFields,
		BeforeValue:    beforeValue,
		AfterValue:     afterValue,
		RequestID:      &requestID,
		IPAddress:      &ipAddress,
		UserAgent:      &userAgent,
	}).Error
}

func emitSkillAdminAction(tx *gorm.DB, c *gin.Context, skill skillmodel.Skill, versionID string, actorID int64) error {
	success := true
	requestID := skillapi.RequestID(c)
	metadataRaw, err := common.Marshal(map[string]any{
		"producer":       "admin",
		"schema_version": "1.0",
	})
	if err != nil {
		return err
	}
	return skillmodel.EmitSkillUsageEvent(tx, skillmodel.SkillUsageEvent{
		EventType:      enums.SkillUsageEventTypeAdminAction,
		UserID:         &actorID,
		TenantID:       &actorID,
		RequestID:      &requestID,
		SkillID:        &skill.ID,
		SkillVersionID: &versionID,
		EntryPoint:     enums.EntryPointAdminPreview,
		Plan:           &skill.RequiredPlan,
		IsKidsSession:  false,
		Success:        &success,
		Metadata:       skillmodel.SkillJSONB(metadataRaw),
	})
}

func skillPublishAuditBefore(skill skillmodel.Skill) *skillmodel.SkillJSONB {
	return auditJSON(map[string]any{
		"skill_id":          skill.ID,
		"status":            skill.Status,
		"published_at":      skill.PublishedAt,
		"active_version_id": skill.ActiveVersionID,
	})
}

func skillPublishAuditAfter(skill skillmodel.Skill, version skillmodel.SkillVersion) *skillmodel.SkillJSONB {
	return auditJSON(map[string]any{
		"skill_id":          skill.ID,
		"status":            skill.Status,
		"published_at":      skill.PublishedAt,
		"active_version_id": skill.ActiveVersionID,
		"skill_version_id":  version.ID,
		"version_number":    version.VersionNumber,
	})
}

var (
	errPublishChecklistFailed = errors.New("publish checklist failed")
	errPublishRequiresDraft   = errors.New("skill must be draft to publish")
	errPublishStateChanged    = errors.New("skill publish state changed")
	errMissingActiveVersion   = errors.New("active skill version is required")
)

func writePublishSkillError(c *gin.Context, err error, checklist []PublishChecklistItem) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		skillapi.Error(c, errcodes.ErrSkillNotFound, "Skill not found.", nil)
		return
	}
	if errors.Is(err, errPublishRequiresDraft) {
		c.JSON(http.StatusConflict, skillapi.ErrorEnvelope{
			Error: skillapi.ErrorBody{
				Code:      errcodes.ErrInvalidRequest,
				Message:   "Only draft Skills can be published.",
				Detail:    gin.H{"reason": "SKILL_NOT_DRAFT"},
				RequestID: skillapi.RequestID(c),
			},
		})
		return
	}
	if errors.Is(err, errPublishStateChanged) {
		c.JSON(http.StatusConflict, skillapi.ErrorEnvelope{
			Error: skillapi.ErrorBody{
				Code:      errcodes.ErrInvalidRequest,
				Message:   "Skill publish state changed. Reload and try again.",
				Detail:    gin.H{"reason": "PUBLISH_STATE_CHANGED"},
				RequestID: skillapi.RequestID(c),
			},
		})
		return
	}
	if errors.Is(err, errPublishChecklistFailed) {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Publish checklist failed.", gin.H{
			"reason":    "PUBLISH_CHECKLIST_FAILED",
			"checklist": checklist,
		})
		return
	}
	if errors.Is(err, errSkillPackageGuardFailed) {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Skill package build failed.", gin.H{
			"reason": "PUBLISH_PACKAGE_INVALID",
		})
		return
	}
	writeDBError(c, err)
}
