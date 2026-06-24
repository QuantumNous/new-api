package handler

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
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

type CreateSkillVersionRequest struct {
	InstructionTemplate string           `json:"instruction_template"`
	PromptGuardTemplate *string          `json:"prompt_guard_template,omitempty"`
	OutputSchema        *json.RawMessage `json:"output_schema,omitempty"`
}

type ActivateSkillVersionRequest struct {
	Reason *string `json:"reason,omitempty"`
}

type SkillVersionMetadata struct {
	ID                        string                   `json:"id"`
	SkillID                   string                   `json:"skill_id"`
	VersionNumber             int                      `json:"version_number"`
	Status                    enums.SkillVersionStatus `json:"status"`
	InstructionTemplateSHA256 string                   `json:"instruction_template_sha256"`
	HasPromptGuardTemplate    bool                     `json:"has_prompt_guard_template"`
	HasOutputSchema           bool                     `json:"has_output_schema"`
	ModelWhitelistSnapshot    json.RawMessage          `json:"model_whitelist_snapshot"`
	RequiredPlanSnapshot      enums.RequiredPlan       `json:"required_plan_snapshot"`
	MonetizationSnapshot      json.RawMessage          `json:"monetization_snapshot"`
	MaxInputTokensSnapshot    *int                     `json:"max_input_tokens_snapshot,omitempty"`
	RolloutPercentage         int                      `json:"rollout_percentage"`
	ExperimentName            *string                  `json:"experiment_name,omitempty"`
	CreatedBy                 int64                    `json:"created_by"`
	CreatedAt                 time.Time                `json:"created_at"`
	ActivatedAt               *time.Time               `json:"activated_at,omitempty"`
	ArchivedAt                *time.Time               `json:"archived_at,omitempty"`
}

type SkillVersionDetail struct {
	SkillVersionMetadata
	InstructionTemplate string           `json:"instruction_template"`
	PromptGuardTemplate *string          `json:"prompt_guard_template,omitempty"`
	OutputSchema        *json.RawMessage `json:"output_schema,omitempty"`
}

type monetizationSnapshot struct {
	Type              enums.MonetizationType `json:"type"`
	PriceMarkup       float64                `json:"price_markup"`
	FreeQuotaPerMonth *int                   `json:"free_quota_per_month,omitempty"`
}

func ListAdminSkillVersions(c *gin.Context) {
	page, validationErr := skillapi.ParsePageParams(c)
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}
	database, ok := skillDB(c)
	if !ok {
		return
	}
	skillID := c.Param("skill_id")
	if err := ensureSkillExists(database, skillID); err != nil {
		writeSkillLookupError(c, err)
		return
	}

	query := database.Model(&skillmodel.SkillVersion{}).Where("skill_id = ?", skillID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		writeDBError(c, err)
		return
	}

	var versions []skillmodel.SkillVersion
	if err := query.Order("version_number DESC").
		Offset(page.Offset).
		Limit(page.Limit).
		Find(&versions).Error; err != nil {
		writeDBError(c, err)
		return
	}

	out := make([]SkillVersionMetadata, 0, len(versions))
	for _, v := range versions {
		out = append(out, skillVersionMetadataFromModel(v))
	}
	skillapi.List(c, out, skillapi.NewPagination(page.Page, page.Limit, total))
}

func GetAdminSkillVersion(c *gin.Context) {
	database, ok := skillDB(c)
	if !ok {
		return
	}
	version, err := findSkillVersion(database, c.Param("skill_id"), c.Param("version_id"))
	if err != nil {
		writeSkillLookupError(c, err)
		return
	}
	detail := SkillVersionDetail{
		SkillVersionMetadata: skillVersionMetadataFromModel(version),
		InstructionTemplate:  version.InstructionTemplate,
		PromptGuardTemplate:  version.PromptGuardTemplate,
		OutputSchema:         rawJSONPtr(version.OutputSchema),
	}
	skillapi.Success(c, detail)
}

func CreateAdminSkillVersion(c *gin.Context) {
	database, ok := skillDB(c)
	if !ok {
		return
	}
	var req CreateSkillVersionRequest
	if !decodeJSONBody(c, &req) {
		return
	}
	if strings.TrimSpace(req.InstructionTemplate) == "" {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "instruction_template is required.", gin.H{"field": "instruction_template"})
		return
	}
	outputSchema, valid := normalizeOptionalJSON(req.OutputSchema, "output_schema", c)
	if !valid {
		return
	}

	actorID := int64(c.GetInt("id"))
	role := strconv.Itoa(c.GetInt("role"))
	skillID := c.Param("skill_id")
	var created skillmodel.SkillVersion
	err := createSkillVersionWithRetry(database, c, skillID, req, outputSchema, actorID, role, &created)
	if err != nil {
		writeSkillVersionMutationError(c, err)
		return
	}
	c.JSON(http.StatusCreated, skillapi.SuccessEnvelope{
		Data: skillVersionMetadataFromModel(created),
		Meta: skillapi.Meta{RequestID: skillapi.RequestID(c)},
	})
}

func ActivateAdminSkillVersion(c *gin.Context) {
	database, ok := skillDB(c)
	if !ok {
		return
	}
	var req ActivateSkillVersionRequest
	if c.Request.Body != nil && c.Request.ContentLength != 0 {
		if !decodeJSONBody(c, &req) {
			return
		}
	}

	actorID := int64(c.GetInt("id"))
	role := strconv.Itoa(c.GetInt("role"))
	skillID := c.Param("skill_id")
	versionID := c.Param("version_id")
	var activated skillmodel.SkillVersion
	err := database.Transaction(func(tx *gorm.DB) error {
		var skill skillmodel.Skill
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&skill, "id = ?", skillID).Error; err != nil {
			return err
		}
		var version skillmodel.SkillVersion
		if err := tx.First(&version, "id = ? AND skill_id = ?", versionID, skillID).Error; err != nil {
			return err
		}
		if version.Status == enums.SkillVersionStatusArchived {
			return errArchivedVersion
		}
		if !publishMaxInputTokensSnapshotValid(skill, version) {
			return errVersionMaxInputSnapshotInvalid
		}
		before := versionAuditBefore(&version)

		now := time.Now().UTC()
		if skill.Status == enums.SkillStatusPublished {
			zipBytes, err := buildSkillPackageForVersion(skill, version)
			if err != nil {
				return err
			}
			if err := storeVersionPackageArtifact(tx, version.ID, zipBytes, now); err != nil {
				return err
			}
		}
		var prior *skillmodel.SkillVersion
		var active skillmodel.SkillVersion
		if err := tx.Where("skill_id = ? AND status = ?", skillID, enums.SkillVersionStatusActive).First(&active).Error; err == nil {
			prior = &active
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err := tx.Model(&skillmodel.SkillVersion{}).
			Where("skill_id = ? AND status = ? AND id <> ?", skillID, enums.SkillVersionStatusActive, versionID).
			Update("status", enums.SkillVersionStatusInactive).Error; err != nil {
			return err
		}
		if err := tx.Model(&skillmodel.SkillVersion{}).
			Where("id = ? AND skill_id = ?", versionID, skillID).
			Updates(map[string]any{
				"status":       enums.SkillVersionStatusActive,
				"activated_at": now,
			}).Error; err != nil {
			return err
		}
		if err := tx.Model(&skillmodel.Skill{}).
			Where("id = ?", skillID).
			Updates(map[string]any{
				"active_version_id": versionID,
				"updated_by":        actorID,
			}).Error; err != nil {
			return err
		}
		if err := tx.First(&activated, "id = ?", versionID).Error; err != nil {
			return err
		}
		if err := writeVersionAuditLog(tx, c, "version_activated", skill.ID, version.ID, actorID, role, req.Reason, before, versionActivationAuditAfter(activated, prior)); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		writeSkillVersionMutationError(c, err)
		return
	}
	skillapi.Success(c, skillVersionMetadataFromModel(activated))
}

func createSkillVersionWithRetry(db *gorm.DB, c *gin.Context, skillID string, req CreateSkillVersionRequest, outputSchema *skillmodel.SkillJSONB, actorID int64, role string, created *skillmodel.SkillVersion) error {
	const maxAttempts = 3
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		err := db.Transaction(func(tx *gorm.DB) error {
			var skill skillmodel.Skill
			if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&skill, "id = ?", skillID).Error; err != nil {
				return err
			}
			version, err := buildVersionFromSkill(tx, skill, req, outputSchema, actorID)
			if err != nil {
				return err
			}
			if err := tx.Create(&version).Error; err != nil {
				return err
			}
			if err := writeVersionAuditLog(tx, c, "version_created", skill.ID, version.ID, actorID, role, nil, nil, versionAuditAfter(version)); err != nil {
				return err
			}
			*created = version
			return nil
		})
		if err == nil {
			return nil
		}
		lastErr = err
		if !isSkillVersionNumberConflict(err) {
			return err
		}
	}
	return fmt.Errorf("%w: %v", errVersionNumberConflict, lastErr)
}

func buildVersionFromSkill(tx *gorm.DB, skill skillmodel.Skill, req CreateSkillVersionRequest, outputSchema *skillmodel.SkillJSONB, actorID int64) (skillmodel.SkillVersion, error) {
	var maxVersion int
	if err := tx.Model(&skillmodel.SkillVersion{}).
		Where("skill_id = ?", skill.ID).
		Select("COALESCE(MAX(version_number), 0)").
		Scan(&maxVersion).Error; err != nil {
		return skillmodel.SkillVersion{}, err
	}

	monetization, err := common.Marshal(monetizationSnapshot{
		Type:              skill.MonetizationType,
		PriceMarkup:       skill.PriceMarkup,
		FreeQuotaPerMonth: skill.FreeQuotaPerMonth,
	})
	if err != nil {
		return skillmodel.SkillVersion{}, err
	}
	sum := sha256.Sum256([]byte(req.InstructionTemplate))
	return skillmodel.SkillVersion{
		SkillID:                   skill.ID,
		VersionNumber:             maxVersion + 1,
		Status:                    enums.SkillVersionStatusDraft,
		InstructionTemplate:       req.InstructionTemplate,
		InstructionTemplateSHA256: hex.EncodeToString(sum[:]),
		PromptGuardTemplate:       req.PromptGuardTemplate,
		OutputSchema:              outputSchema,
		ModelWhitelistSnapshot:    append(skillmodel.SkillJSONB(nil), skill.ModelWhitelist...),
		RequiredPlanSnapshot:      skill.RequiredPlan,
		MonetizationSnapshot:      skillmodel.SkillJSONB(monetization),
		MaxInputTokensSnapshot:    skill.MaxInputTokens,
		RolloutPercentage:         100,
		CreatedBy:                 actorID,
	}, nil
}

func writeVersionAuditLog(tx *gorm.DB, c *gin.Context, action, skillID, versionID string, actorID int64, actorRole string, reason *string, beforeValue, afterValue *skillmodel.SkillJSONB) error {
	requestID := skillapi.RequestID(c)
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()
	changedFields := skillmodel.SkillJSONB(`["status","instruction_template_sha256","model_whitelist_snapshot","required_plan_snapshot","monetization_snapshot","max_input_tokens_snapshot"]`)
	if action == "version_created" {
		changedFields = skillmodel.SkillJSONB(`["instruction_template_sha256","model_whitelist_snapshot","required_plan_snapshot","monetization_snapshot","max_input_tokens_snapshot"]`)
	}
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

func versionAuditBefore(version *skillmodel.SkillVersion) *skillmodel.SkillJSONB {
	if version == nil {
		return nil
	}
	return auditJSON(map[string]any{
		"skill_version_id":                version.ID,
		"status":                          version.Status,
		"instruction_template_sha256":     version.InstructionTemplateSHA256,
		"model_whitelist_snapshot_sha256": sha256Hex(version.ModelWhitelistSnapshot),
		"required_plan_snapshot":          version.RequiredPlanSnapshot,
		"monetization_snapshot_sha256":    sha256Hex(version.MonetizationSnapshot),
		"max_input_tokens_snapshot":       version.MaxInputTokensSnapshot,
	})
}

func versionAuditAfter(version skillmodel.SkillVersion) *skillmodel.SkillJSONB {
	return auditJSON(map[string]any{
		"skill_version_id":                version.ID,
		"version_number":                  version.VersionNumber,
		"status":                          version.Status,
		"instruction_template_sha256":     version.InstructionTemplateSHA256,
		"model_whitelist_snapshot_sha256": sha256Hex(version.ModelWhitelistSnapshot),
		"required_plan_snapshot":          version.RequiredPlanSnapshot,
		"monetization_snapshot_sha256":    sha256Hex(version.MonetizationSnapshot),
		"max_input_tokens_snapshot":       version.MaxInputTokensSnapshot,
	})
}

func versionActivationAuditAfter(version skillmodel.SkillVersion, prior *skillmodel.SkillVersion) *skillmodel.SkillJSONB {
	payload := map[string]any{
		"skill_version_id":                version.ID,
		"version_number":                  version.VersionNumber,
		"status":                          version.Status,
		"instruction_template_sha256":     version.InstructionTemplateSHA256,
		"model_whitelist_snapshot_sha256": sha256Hex(version.ModelWhitelistSnapshot),
		"required_plan_snapshot":          version.RequiredPlanSnapshot,
		"monetization_snapshot_sha256":    sha256Hex(version.MonetizationSnapshot),
		"max_input_tokens_snapshot":       version.MaxInputTokensSnapshot,
	}
	if prior != nil && prior.ID != version.ID {
		payload["previous_active_version_id"] = prior.ID
	}
	return auditJSON(payload)
}

func auditJSON(v any) *skillmodel.SkillJSONB {
	raw, err := common.Marshal(v)
	if err != nil {
		fallback := skillmodel.SkillJSONB(`{}`)
		return &fallback
	}
	j := skillmodel.SkillJSONB(raw)
	return &j
}

func sha256Hex(raw []byte) string {
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}

func skillVersionMetadataFromModel(v skillmodel.SkillVersion) SkillVersionMetadata {
	return SkillVersionMetadata{
		ID:                        v.ID,
		SkillID:                   v.SkillID,
		VersionNumber:             v.VersionNumber,
		Status:                    v.Status,
		InstructionTemplateSHA256: v.InstructionTemplateSHA256,
		HasPromptGuardTemplate:    v.PromptGuardTemplate != nil && strings.TrimSpace(*v.PromptGuardTemplate) != "",
		HasOutputSchema:           v.OutputSchema != nil,
		ModelWhitelistSnapshot:    rawJSONWithDefault(v.ModelWhitelistSnapshot, "[]"),
		RequiredPlanSnapshot:      v.RequiredPlanSnapshot,
		MonetizationSnapshot:      rawJSONWithDefault(v.MonetizationSnapshot, "{}"),
		MaxInputTokensSnapshot:    v.MaxInputTokensSnapshot,
		RolloutPercentage:         v.RolloutPercentage,
		ExperimentName:            v.ExperimentName,
		CreatedBy:                 v.CreatedBy,
		CreatedAt:                 v.CreatedAt,
		ActivatedAt:               v.ActivatedAt,
		ArchivedAt:                v.ArchivedAt,
	}
}

func rawJSONPtr(value *skillmodel.SkillJSONB) *json.RawMessage {
	if value == nil {
		return nil
	}
	raw := rawJSONWithDefault(*value, "null")
	return &raw
}

func rawJSONWithDefault(value skillmodel.SkillJSONB, fallback string) json.RawMessage {
	if len(value) == 0 {
		return json.RawMessage(fallback)
	}
	var decoded any
	if err := common.Unmarshal(value, &decoded); err != nil {
		return json.RawMessage(fallback)
	}
	return json.RawMessage(value)
}

func normalizeOptionalJSON(raw *json.RawMessage, field string, c *gin.Context) (*skillmodel.SkillJSONB, bool) {
	if raw == nil {
		return nil, true
	}
	trimmed := bytes.TrimSpace(*raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil, true
	}
	var decoded any
	if err := common.Unmarshal(trimmed, &decoded); err != nil {
		skillapi.Error(c, errcodes.ErrInvalidRequest, fmt.Sprintf("%s must be valid JSON.", field), gin.H{"field": field})
		return nil, false
	}
	value := skillmodel.SkillJSONB(append([]byte(nil), trimmed...))
	return &value, true
}

func decodeJSONBody(c *gin.Context, dest any) bool {
	if err := common.DecodeJson(c.Request.Body, dest); err != nil {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Request body must be valid JSON.", nil)
		return false
	}
	return true
}

func ensureSkillExists(db *gorm.DB, skillID string) error {
	var s skillmodel.Skill
	return db.Select("id").First(&s, "id = ?", skillID).Error
}

func findSkillVersion(db *gorm.DB, skillID, versionID string) (skillmodel.SkillVersion, error) {
	var version skillmodel.SkillVersion
	err := db.First(&version, "id = ? AND skill_id = ?", versionID, skillID).Error
	return version, err
}

var (
	errArchivedVersion                = errors.New("archived skill version cannot be activated")
	errVersionNumberConflict          = errors.New("skill version number allocation conflicted")
	errVersionMaxInputSnapshotInvalid = errors.New("skill version max_input_tokens_snapshot invalid")
)

func isSkillVersionNumberConflict(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	if !strings.Contains(msg, "skill_versions") {
		return false
	}
	return strings.Contains(msg, "unique") ||
		strings.Contains(msg, "duplicate") ||
		strings.Contains(msg, "constraint")
}

func writeSkillVersionMutationError(c *gin.Context, err error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		skillapi.Error(c, errcodes.ErrSkillNotFound, "Skill or version not found.", nil)
		return
	}
	if errors.Is(err, errArchivedVersion) {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Archived skill versions cannot be activated.", nil)
		return
	}
	if errors.Is(err, errVersionNumberConflict) {
		c.JSON(http.StatusConflict, skillapi.ErrorEnvelope{
			Error: skillapi.ErrorBody{
				Code:      errcodes.ErrSkillConflict,
				Message:   "Could not allocate a unique skill version number; retry the request.",
				Detail:    gin.H{"reason": "VERSION_NUMBER_CONFLICT"},
				RequestID: skillapi.RequestID(c),
			},
		})
		return
	}
	if errors.Is(err, errVersionMaxInputSnapshotInvalid) {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "max_input_tokens_snapshot is required and must match max_input_tokens for Free/free-quota Skills.", gin.H{"reason": "VERSION_MAX_INPUT_TOKENS_SNAPSHOT_INVALID"})
		return
	}
	if errors.Is(err, errSkillPackageGuardFailed) {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Skill package build failed.", gin.H{
			"reason": "VERSION_PACKAGE_INVALID",
		})
		return
	}
	writeDBError(c, err)
}
