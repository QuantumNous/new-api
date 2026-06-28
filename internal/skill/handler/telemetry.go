package handler

import (
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const telemetryProducerDownloadedRunner = "downloaded_runner"

var telemetryAllowedKeys = map[string]struct{}{
	"skill_id":      {},
	"version":       {},
	"occurred_at":   {},
	"success":       {},
	"model":         {},
	"input_tokens":  {},
	"output_tokens": {},
	"total_tokens":  {},
	"latency_ms":    {},
}

var telemetryRestrictedKeys = map[string]struct{}{
	"instruction_template": {},
	"prompt":               {},
	"system_prompt":        {},
	"messages":             {},
	"raw":                  {},
	"raw_input":            {},
	"raw_user_input":       {},
	"raw_messages":         {},
	"input":                {},
	"output":               {},
	"provider_payload":     {},
	"kids_raw_input":       {},
	"full_user_input":      {},
	"raw_output":           {},
	"model_output":         {},
}

type runnerSkillUsageTelemetryRequest struct {
	SkillID      string `json:"skill_id"`
	Version      string `json:"version"`
	OccurredAt   string `json:"occurred_at"`
	Success      *bool  `json:"success"`
	Model        string `json:"model"`
	InputTokens  *int   `json:"input_tokens"`
	OutputTokens *int   `json:"output_tokens"`
	TotalTokens  *int   `json:"total_tokens"`
	LatencyMS    *int   `json:"latency_ms"`
}

// RecordRunnerSkillUsage handles POST /api/v1/telemetry/skill-usage.
// It is called by downloaded local runners only after user opt-in. The server
// still re-checks the persisted consent flag on every request so revocation
// immediately stops new analytics writes.
func RecordRunnerSkillUsage(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	userID := c.GetInt("id")
	if userID <= 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "DeepRouter API token is required.", nil)
		return
	}
	consented, err := userTier2TelemetryConsent(db, userID)
	if err != nil {
		writeDBError(c, err)
		return
	}
	if !consented {
		skillapi.Error(c, errcodes.ErrForbidden, "Tier 2 telemetry consent is not enabled.", nil)
		return
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 64*1024))
	if err != nil {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Failed to read telemetry payload.", nil)
		return
	}
	var raw map[string]any
	if err := common.Unmarshal(body, &raw); err != nil || raw == nil {
		quarantineTelemetry(c, db, int64(userID), "invalid_json", nil)
		c.JSON(http.StatusAccepted, skillapi.SuccessEnvelope{
			Data: gin.H{"status": "quarantined"},
			Meta: skillapi.Meta{RequestID: skillapi.RequestID(c)},
		})
		return
	}
	if key, restricted := containsRestrictedTelemetryKey(raw); restricted {
		skillapi.Error(c, errcodes.ErrInvalidRequest, fmt.Sprintf("Telemetry payload must not contain %s.", key), nil)
		return
	}
	if unknown := unknownTelemetryKeys(raw); len(unknown) > 0 {
		quarantineTelemetry(c, db, int64(userID), "unknown_fields", fieldsDiagnostic(unknown))
		c.JSON(http.StatusAccepted, skillapi.SuccessEnvelope{
			Data: gin.H{"status": "quarantined"},
			Meta: skillapi.Meta{RequestID: skillapi.RequestID(c)},
		})
		return
	}

	var req runnerSkillUsageTelemetryRequest
	if err := common.Unmarshal(body, &req); err != nil {
		quarantineTelemetry(c, db, int64(userID), "invalid_schema", fieldsDiagnostic(keysOf(raw)))
		c.JSON(http.StatusAccepted, skillapi.SuccessEnvelope{
			Data: gin.H{"status": "quarantined"},
			Meta: skillapi.Meta{RequestID: skillapi.RequestID(c)},
		})
		return
	}
	if reason := validateRunnerTelemetry(req); reason != "" {
		quarantineTelemetry(c, db, int64(userID), reason, fieldsDiagnostic(keysOf(raw)))
		c.JSON(http.StatusAccepted, skillapi.SuccessEnvelope{
			Data: gin.H{"status": "quarantined"},
			Meta: skillapi.Meta{RequestID: skillapi.RequestID(c)},
		})
		return
	}

	uid := int64(userID)
	skillID := strings.TrimSpace(req.SkillID)
	version := strings.TrimSpace(req.Version)
	var skillVersionID *string
	if _, err := uuid.Parse(version); err == nil {
		skillVersionID = &version
	}
	metadata := map[string]any{
		"producer": telemetryProducerDownloadedRunner,
	}
	if version != "" && skillVersionID == nil {
		metadata["version"] = version
	}
	if occurred := strings.TrimSpace(req.OccurredAt); occurred != "" {
		metadata["client_occurred_at"] = occurred
	}
	metaBytes, err := common.Marshal(metadata)
	if err != nil {
		writeDBError(c, err)
		return
	}

	event := skillmodel.SkillUsageEvent{
		EventType:      enums.SkillUsageEventTypeUsed,
		UserID:         &uid,
		TenantID:       &uid,
		SkillID:        &skillID,
		SkillVersionID: skillVersionID,
		EntryPoint:     enums.EntryPointDownloadedRunner,
		Model:          stringPtrOrNil(req.Model),
		InputTokens:    req.InputTokens,
		OutputTokens:   req.OutputTokens,
		TotalTokens:    req.TotalTokens,
		LatencyMS:      req.LatencyMS,
		Success:        req.Success,
		Metadata:       skillmodel.SkillJSONB(metaBytes),
	}
	if err := skillmodel.EmitSkillUsageEvent(db, event); err != nil {
		writeDBError(c, err)
		return
	}
	skillapi.Success(c, gin.H{"status": "recorded"})
}

func userTier2TelemetryConsent(db *gorm.DB, userID int) (bool, error) {
	var user platformmodel.User
	if err := db.Select("tier2_telemetry_consent").Where("id = ?", userID).First(&user).Error; err != nil {
		return false, err
	}
	return user.Tier2TelemetryConsent, nil
}

func validateRunnerTelemetry(req runnerSkillUsageTelemetryRequest) string {
	if strings.TrimSpace(req.SkillID) == "" {
		return "missing_skill_id"
	}
	if req.Success == nil {
		return "missing_success"
	}
	if strings.TrimSpace(req.OccurredAt) != "" {
		if _, err := time.Parse(time.RFC3339, strings.TrimSpace(req.OccurredAt)); err != nil {
			return "invalid_occurred_at"
		}
	}
	for _, item := range []struct {
		name string
		val  *int
	}{
		{"input_tokens", req.InputTokens},
		{"output_tokens", req.OutputTokens},
		{"total_tokens", req.TotalTokens},
		{"latency_ms", req.LatencyMS},
	} {
		if item.val != nil && *item.val < 0 {
			return "invalid_" + item.name
		}
	}
	return ""
}

func quarantineTelemetry(c *gin.Context, db *gorm.DB, userID int64, reason string, fields skillmodel.SkillJSONB) {
	if fields == nil {
		fields = skillmodel.SkillJSONB(`{}`)
	}
	var tokenID *int
	if id, ok := c.Get("token_id"); ok {
		if typed, ok := id.(int); ok {
			tokenID = &typed
		}
	}
	if err := db.Create(&skillmodel.SkillTelemetryQuarantine{
		UserID:  userID,
		TokenID: tokenID,
		Reason:  reason,
		Fields:  fields,
	}).Error; err != nil {
		common.SysLog("Skill telemetry quarantine insert failed: " + err.Error())
	}
}

func containsRestrictedTelemetryKey(v any) (string, bool) {
	switch typed := v.(type) {
	case map[string]any:
		for k, child := range typed {
			if _, ok := telemetryRestrictedKeys[k]; ok {
				return k, true
			}
			if key, ok := containsRestrictedTelemetryKey(child); ok {
				return key, true
			}
		}
	case []any:
		for _, child := range typed {
			if key, ok := containsRestrictedTelemetryKey(child); ok {
				return key, true
			}
		}
	}
	return "", false
}

func unknownTelemetryKeys(raw map[string]any) []string {
	var unknown []string
	for k := range raw {
		if _, ok := telemetryAllowedKeys[k]; !ok {
			unknown = append(unknown, k)
		}
	}
	sort.Strings(unknown)
	return unknown
}

func keysOf(raw map[string]any) []string {
	keys := make([]string, 0, len(raw))
	for key := range raw {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func fieldsDiagnostic(keys []string) skillmodel.SkillJSONB {
	payload := map[string]any{"fields": keys}
	out, err := common.Marshal(payload)
	if err != nil {
		return skillmodel.SkillJSONB(`{}`)
	}
	return skillmodel.SkillJSONB(out)
}

func stringPtrOrNil(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
