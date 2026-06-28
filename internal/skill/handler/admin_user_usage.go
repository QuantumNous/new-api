package handler

import (
	"errors"
	"math"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	adminUserUsageAction = "skill_admin_action"
	adminUserUsageKind   = "per_user_skill_usage_viewed"
	defaultUsageLimit    = 100
	maxUsageLimit        = 500
	usdPerRatioToken     = 0.002 / 1000
)

type AdminUserSkillUsageResponse struct {
	UserID         int64                         `json:"user_id"`
	ConsentGranted bool                          `json:"consent_granted"`
	KidsProtected  bool                          `json:"kids_protected"`
	Downloads      []AdminUserSkillDownloadRow   `json:"downloads"`
	UsageTimeline  []AdminUserSkillUsageTimeline `json:"usage_timeline"`
}

type AdminUserSkillDownloadRow struct {
	SkillID        string     `json:"skill_id"`
	SkillSlug      string     `json:"skill_slug"`
	SkillName      string     `json:"skill_name"`
	Enabled        bool       `json:"enabled"`
	EnabledAt      time.Time  `json:"enabled_at"`
	DisabledAt     *time.Time `json:"disabled_at,omitempty"`
	RemovedAt      *time.Time `json:"removed_at,omitempty"`
	Source         string     `json:"source"`
	LastUpdateTime *time.Time `json:"last_update_time,omitempty"`
	InputTokens    int64      `json:"input_tokens"`
	OutputTokens   int64      `json:"output_tokens"`
	TotalTokens    int64      `json:"total_tokens"`
	CostUSD        float64    `json:"cost_usd"`
}

type AdminUserSkillUsageTimeline struct {
	EventID      string                    `json:"event_id"`
	EventType    enums.SkillUsageEventType `json:"event_type"`
	OccurredAt   time.Time                 `json:"occurred_at"`
	SkillID      string                    `json:"skill_id,omitempty"`
	SkillSlug    string                    `json:"skill_slug,omitempty"`
	SkillName    string                    `json:"skill_name,omitempty"`
	Model        string                    `json:"model,omitempty"`
	InputTokens  int                       `json:"input_tokens"`
	OutputTokens int                       `json:"output_tokens"`
	TotalTokens  int                       `json:"total_tokens"`
	CostUSD      float64                   `json:"cost_usd"`
	Success      *bool                     `json:"success,omitempty"`
}

type adminSkillInfo struct {
	Slug string
	Name string
}

type userUsageAggregateRow struct {
	SkillID      string
	Model        string
	InputTokens  int64
	OutputTokens int64
	TotalTokens  int64
}

type userUsageEventRow struct {
	EventID      string
	EventType    enums.SkillUsageEventType
	OccurredAt   time.Time
	SkillID      *string
	Model        *string
	InputTokens  *int
	OutputTokens *int
	TotalTokens  *int
	Success      *bool
}

// GetAdminUserSkillUsage returns a consent-gated per-user Skill drill-down.
// It never selects SkillUsageEvent.Metadata or prompt-bearing SkillVersion fields.
func GetAdminUserSkillUsage(c *gin.Context) {
	if c.GetInt("role") < common.RoleRootUser {
		skillapi.Error(c, errcodes.ErrForbidden, "Super Admin access is required.", nil)
		return
	}
	db, ok := skillDB(c)
	if !ok {
		return
	}
	targetUserID, valid := parsePositiveInt64Param(c, "user_id")
	if !valid {
		return
	}

	var target platformmodel.User
	if err := db.Select("id", "kids_mode", "tier2_telemetry_consent").
		Where("id = ?", targetUserID).
		First(&target).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			skillapi.Error(c, errcodes.ErrSkillNotFound, "User not found.", nil)
			return
		}
		writeDBError(c, err)
		return
	}

	consentGranted := target.Tier2TelemetryConsent
	if err := auditAdminUserUsageAccess(db, c, targetUserID, target.KidsMode, consentGranted); err != nil {
		writeDBError(c, err)
		return
	}
	if !consentGranted {
		skillapi.Success(c, AdminUserSkillUsageResponse{
			UserID:         targetUserID,
			ConsentGranted: false,
			KidsProtected:  target.KidsMode,
			Downloads:      []AdminUserSkillDownloadRow{},
			UsageTimeline:  []AdminUserSkillUsageTimeline{},
		})
		return
	}

	downloads, skillIDs, err := loadAdminUserDownloads(db, targetUserID)
	if err != nil {
		writeDBError(c, err)
		return
	}
	skillInfo, err := loadAdminSkillInfo(db, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	aggregates, err := loadAdminUserUsageAggregates(db, targetUserID, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	limit := boundedUsageLimit(c)
	timelineRows, err := loadAdminUserUsageTimeline(db, targetUserID, limit)
	if err != nil {
		writeDBError(c, err)
		return
	}

	skillapi.Success(c, AdminUserSkillUsageResponse{
		UserID:         targetUserID,
		ConsentGranted: true,
		KidsProtected:  target.KidsMode,
		Downloads:      buildAdminUserDownloadRows(downloads, skillInfo, aggregates),
		UsageTimeline:  buildAdminUserTimelineRows(timelineRows, skillInfo),
	})
}

func parsePositiveInt64Param(c *gin.Context, name string) (int64, bool) {
	raw := c.Param(name)
	val, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || val <= 0 {
		skillapi.Error(c, errcodes.ErrInvalidRequest, "Invalid user_id.", nil)
		return 0, false
	}
	return val, true
}

func auditAdminUserUsageAccess(db *gorm.DB, c *gin.Context, targetUserID int64, kidsProtected, consentGranted bool) error {
	actorID := int64(c.GetInt("id"))
	changed := auditJSON([]string{"operation", "target_user_id", "consent_granted", "kids_protected"})
	after := auditJSON(map[string]any{
		"operation":       adminUserUsageKind,
		"target_user_id":  targetUserID,
		"consent_granted": consentGranted,
		"kids_protected":  kidsProtected,
	})
	requestID := skillapi.RequestID(c)
	ipAddress := c.ClientIP()
	userAgent := c.Request.UserAgent()
	return db.Create(&skillmodel.SkillAuditLog{
		ActorID:       actorID,
		ActorRole:     "root",
		Action:        adminUserUsageAction,
		ChangedFields: *changed,
		AfterValue:    after,
		RequestID:     &requestID,
		IPAddress:     &ipAddress,
		UserAgent:     &userAgent,
	}).Error
}

func loadAdminUserDownloads(db *gorm.DB, userID int64) ([]skillmodel.UserEnabledSkill, []string, error) {
	var downloads []skillmodel.UserEnabledSkill
	if err := db.Select("user_id", "tenant_id", "skill_id", "enabled", "enabled_at", "disabled_at", "removed_at", "source", "last_used_at").
		Where("user_id = ? AND tenant_id = ?", userID, userID).
		Order("enabled_at DESC").
		Find(&downloads).Error; err != nil {
		return nil, nil, err
	}
	ids := make([]string, 0, len(downloads))
	seen := map[string]struct{}{}
	for _, row := range downloads {
		if row.SkillID == "" {
			continue
		}
		if _, ok := seen[row.SkillID]; ok {
			continue
		}
		seen[row.SkillID] = struct{}{}
		ids = append(ids, row.SkillID)
	}
	return downloads, ids, nil
}

func loadAdminSkillInfo(db *gorm.DB, skillIDs []string) (map[string]adminSkillInfo, error) {
	info := make(map[string]adminSkillInfo, len(skillIDs))
	if len(skillIDs) == 0 {
		return info, nil
	}
	var skills []skillmodel.Skill
	if err := db.Select("id", "slug", "name").
		Where("id IN ?", skillIDs).
		Find(&skills).Error; err != nil {
		return nil, err
	}
	for _, skill := range skills {
		info[skill.ID] = adminSkillInfo{Slug: skill.Slug, Name: skill.Name}
	}
	return info, nil
}

func loadAdminUserUsageAggregates(db *gorm.DB, userID int64, skillIDs []string) (map[string]AdminUserSkillDownloadRow, error) {
	out := map[string]AdminUserSkillDownloadRow{}
	if len(skillIDs) == 0 {
		return out, nil
	}
	var rows []userUsageAggregateRow
	if err := db.Model(&skillmodel.SkillUsageEvent{}).
		Select("skill_id, COALESCE(model, '') AS model, COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens, COALESCE(SUM(COALESCE(total_tokens, COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0))), 0) AS total_tokens").
		Where("user_id = ? AND is_kids_session = ? AND skill_id IN ?", userID, false, skillIDs).
		Group("skill_id, model").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		existing := out[row.SkillID]
		existing.InputTokens += row.InputTokens
		existing.OutputTokens += row.OutputTokens
		existing.TotalTokens += normalizedTotalTokens64(row.InputTokens, row.OutputTokens, row.TotalTokens)
		existing.CostUSD = roundUSD(existing.CostUSD + tokenCostUSD(row.Model, row.InputTokens, row.OutputTokens, row.TotalTokens))
		out[row.SkillID] = existing
	}
	return out, nil
}

func loadAdminUserUsageTimeline(db *gorm.DB, userID int64, limit int) ([]userUsageEventRow, error) {
	var rows []userUsageEventRow
	err := db.Model(&skillmodel.SkillUsageEvent{}).
		Select("event_id", "event_type", "occurred_at", "skill_id", "model", "input_tokens", "output_tokens", "total_tokens", "success").
		Where("user_id = ? AND is_kids_session = ?", userID, false).
		Order("occurred_at DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func buildAdminUserDownloadRows(downloads []skillmodel.UserEnabledSkill, skillInfo map[string]adminSkillInfo, aggregates map[string]AdminUserSkillDownloadRow) []AdminUserSkillDownloadRow {
	rows := make([]AdminUserSkillDownloadRow, 0, len(downloads))
	for _, download := range downloads {
		info := skillInfo[download.SkillID]
		agg := aggregates[download.SkillID]
		rows = append(rows, AdminUserSkillDownloadRow{
			SkillID:        download.SkillID,
			SkillSlug:      info.Slug,
			SkillName:      info.Name,
			Enabled:        download.Enabled,
			EnabledAt:      download.EnabledAt,
			DisabledAt:     download.DisabledAt,
			RemovedAt:      download.RemovedAt,
			Source:         download.Source,
			LastUpdateTime: download.LastUsedAt,
			InputTokens:    agg.InputTokens,
			OutputTokens:   agg.OutputTokens,
			TotalTokens:    agg.TotalTokens,
			CostUSD:        agg.CostUSD,
		})
	}
	return rows
}

func buildAdminUserTimelineRows(events []userUsageEventRow, skillInfo map[string]adminSkillInfo) []AdminUserSkillUsageTimeline {
	rows := make([]AdminUserSkillUsageTimeline, 0, len(events))
	for _, event := range events {
		skillID := derefString(event.SkillID)
		info := skillInfo[skillID]
		inputTokens := derefInt(event.InputTokens)
		outputTokens := derefInt(event.OutputTokens)
		totalTokens := normalizedTotalTokens(inputTokens, outputTokens, derefInt(event.TotalTokens))
		model := derefString(event.Model)
		rows = append(rows, AdminUserSkillUsageTimeline{
			EventID:      event.EventID,
			EventType:    event.EventType,
			OccurredAt:   event.OccurredAt,
			SkillID:      skillID,
			SkillSlug:    info.Slug,
			SkillName:    info.Name,
			Model:        model,
			InputTokens:  inputTokens,
			OutputTokens: outputTokens,
			TotalTokens:  totalTokens,
			CostUSD:      roundUSD(tokenCostUSD(model, int64(inputTokens), int64(outputTokens), int64(derefInt(event.TotalTokens)))),
			Success:      event.Success,
		})
	}
	return rows
}

func boundedUsageLimit(c *gin.Context) int {
	limit := defaultUsageLimit
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > maxUsageLimit {
		return maxUsageLimit
	}
	return limit
}

func tokenCostUSD(model string, inputTokens, outputTokens, totalTokens int64) float64 {
	if model == "" {
		return 0
	}
	modelRatio, hasRatio, _ := ratio_setting.GetModelRatio(model)
	if !hasRatio || modelRatio <= 0 {
		return 0
	}
	completionRatio := ratio_setting.GetCompletionRatio(model)
	if completionRatio <= 0 {
		completionRatio = 1
	}
	if inputTokens == 0 && outputTokens == 0 && totalTokens > 0 {
		return float64(totalTokens) * modelRatio * usdPerRatioToken
	}
	return float64(inputTokens)*modelRatio*usdPerRatioToken +
		float64(outputTokens)*modelRatio*completionRatio*usdPerRatioToken
}

func normalizedTotalTokens(inputTokens, outputTokens, totalTokens int) int {
	if totalTokens > 0 {
		return totalTokens
	}
	return inputTokens + outputTokens
}

func normalizedTotalTokens64(inputTokens, outputTokens, totalTokens int64) int64 {
	if totalTokens > 0 {
		return totalTokens
	}
	return inputTokens + outputTokens
}

func derefString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func derefInt(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}

func roundUSD(v float64) float64 {
	return math.Round(v*1_000_000) / 1_000_000
}
