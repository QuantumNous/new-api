package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	defaultAnalyticsWindow = 7 * 24 * time.Hour
	maxAnalyticsWindow     = 30 * 24 * time.Hour
	wasuWindow             = 7 * 24 * time.Hour
	freshnessDelayedAfter  = 15 * time.Minute
	freshnessFailedAfter   = 60 * time.Minute
)

var analyticsNow = func() time.Time { return time.Now().UTC() }

var p0AnalyticsEventTypes = []enums.SkillUsageEventType{
	enums.SkillUsageEventTypeImpression,
	enums.SkillUsageEventTypeDetailView,
	enums.SkillUsageEventTypeEnabled,
	enums.SkillUsageEventTypeFirstUse,
	enums.SkillUsageEventTypeRepeatUse,
	enums.SkillUsageEventTypeUsed,
	enums.SkillUsageEventTypeBlocked,
}

type SkillAnalyticsOverview struct {
	WASU                 int64    `json:"wasu"`
	TotalSkillRuns       int64    `json:"total_skill_runs"`
	DetailCTR            *float64 `json:"detail_ctr"`
	EnableRate           *float64 `json:"enable_rate"`
	FirstUseRate         *float64 `json:"first_use_rate"`
	RepeatUseRate        *float64 `json:"repeat_use_rate"`
	BlockRate            *float64 `json:"block_rate"`
	TopBlockReason       *string  `json:"top_block_reason"`
	RevenueAttributionUS *float64 `json:"revenue_attribution_usd"`
	ChargingEnabled      bool     `json:"charging_enabled"`
	DataFreshness        string   `json:"data_freshness"`
	PeriodStart          string   `json:"period_start"`
	PeriodEnd            string   `json:"period_end"`
}

type SkillAnalyticsSkillRow struct {
	SkillID              string             `json:"skill_id"`
	SkillName            string             `json:"skill_name"`
	Status               enums.SkillStatus  `json:"status"`
	RequiredPlan         enums.RequiredPlan `json:"required_plan"`
	EnabledUsers         int64              `json:"enabled_users"`
	ActiveUsers          int64              `json:"active_users"`
	SuccessfulRuns       int64              `json:"successful_runs"`
	DetailCTR            *float64           `json:"detail_ctr"`
	EnableRate           *float64           `json:"enable_rate"`
	FirstUseRate         *float64           `json:"first_use_rate"`
	RepeatUseRate        *float64           `json:"repeat_use_rate"`
	BlockRate            *float64           `json:"block_rate"`
	RevenueAttributionUS *float64           `json:"revenue_attribution_usd"`
}

type SkillAnalyticsSkillsResponse struct {
	Skills          []SkillAnalyticsSkillRow `json:"skills"`
	Pagination      skillapi.Pagination      `json:"pagination"`
	ChargingEnabled bool                     `json:"charging_enabled"`
	PeriodStart     string                   `json:"period_start"`
	PeriodEnd       string                   `json:"period_end"`
}

type skillAnalyticsPageRow struct {
	ID             string
	Name           string
	Status         enums.SkillStatus
	RequiredPlan   enums.RequiredPlan
	SuccessfulRuns int64
}

func GetOpsSkillAnalyticsOverview(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	period, valid := parseAnalyticsPeriod(c)
	if !valid {
		return
	}
	wasuStart := period.End.Add(-wasuWindow)

	dataFreshness, err := dataFreshness(db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	wasu, err := countWASU(db, wasuStart, period.End)
	if err != nil {
		writeDBError(c, err)
		return
	}
	impressions, err := countDistinctPairsForEvent(db, period.Start, period.End, enums.SkillUsageEventTypeImpression)
	if err != nil {
		writeDBError(c, err)
		return
	}
	details, err := countDistinctPairsForEvent(db, period.Start, period.End, enums.SkillUsageEventTypeDetailView)
	if err != nil {
		writeDBError(c, err)
		return
	}
	enables, err := countDistinctPairsForEvent(db, period.Start, period.End, enums.SkillUsageEventTypeEnabled)
	if err != nil {
		writeDBError(c, err)
		return
	}
	firstUses, err := countDistinctPairsForEvent(db, period.Start, period.End, enums.SkillUsageEventTypeFirstUse)
	if err != nil {
		writeDBError(c, err)
		return
	}
	totalRuns, err := countSuccessfulRuns(db, period.Start, period.End)
	if err != nil {
		writeDBError(c, err)
		return
	}
	activePairs, repeatPairs, err := countRepeatPairs(db, period.Start, period.End)
	if err != nil {
		writeDBError(c, err)
		return
	}
	blocked, err := countEvents(db, period.Start, period.End, enums.SkillUsageEventTypeBlocked)
	if err != nil {
		writeDBError(c, err)
		return
	}
	topReason, err := topBlockReason(db, period.Start, period.End)
	if err != nil {
		writeDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, SkillAnalyticsOverview{
		WASU:                 wasu,
		TotalSkillRuns:       totalRuns,
		DetailCTR:            ratio64(details, impressions),
		EnableRate:           ratio64(enables, details),
		FirstUseRate:         ratio64(firstUses, enables),
		RepeatUseRate:        ratio64(repeatPairs, activePairs),
		BlockRate:            ratio64(blocked, blocked+totalRuns),
		TopBlockReason:       topReason,
		RevenueAttributionUS: nil,
		ChargingEnabled:      false,
		DataFreshness:        dataFreshness,
		PeriodStart:          period.Start.Format(time.RFC3339),
		PeriodEnd:            period.End.Format(time.RFC3339),
	})
}

func GetOpsSkillAnalyticsSkills(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	period, valid := parseAnalyticsPeriod(c)
	if !valid {
		return
	}
	page, validationErr := skillapi.ParsePageParams(c)
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}

	pageRows, total, err := loadSkillAnalyticsPage(db, period.Start, period.End, page)
	if err != nil {
		writeDBError(c, err)
		return
	}
	skillIDs := make([]string, 0, len(pageRows))
	for _, row := range pageRows {
		skillIDs = append(skillIDs, row.ID)
	}

	enabledUsers, err := loadEnabledUsersBySkill(db, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	impressions, err := countDistinctPairsBySkillForEvent(db, period.Start, period.End, skillIDs, enums.SkillUsageEventTypeImpression)
	if err != nil {
		writeDBError(c, err)
		return
	}
	details, err := countDistinctPairsBySkillForEvent(db, period.Start, period.End, skillIDs, enums.SkillUsageEventTypeDetailView)
	if err != nil {
		writeDBError(c, err)
		return
	}
	enables, err := countDistinctPairsBySkillForEvent(db, period.Start, period.End, skillIDs, enums.SkillUsageEventTypeEnabled)
	if err != nil {
		writeDBError(c, err)
		return
	}
	firstUses, err := countDistinctPairsBySkillForEvent(db, period.Start, period.End, skillIDs, enums.SkillUsageEventTypeFirstUse)
	if err != nil {
		writeDBError(c, err)
		return
	}
	activePairs, repeatPairs, err := countRepeatPairsBySkill(db, period.Start, period.End, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	blocked, err := countEventsBySkill(db, period.Start, period.End, skillIDs, enums.SkillUsageEventTypeBlocked)
	if err != nil {
		writeDBError(c, err)
		return
	}

	rows := make([]SkillAnalyticsSkillRow, 0, len(pageRows))
	for _, skill := range pageRows {
		rows = append(rows, SkillAnalyticsSkillRow{
			SkillID:              skill.ID,
			SkillName:            skill.Name,
			Status:               skill.Status,
			RequiredPlan:         skill.RequiredPlan,
			EnabledUsers:         enabledUsers[skill.ID],
			ActiveUsers:          activePairs[skill.ID],
			SuccessfulRuns:       skill.SuccessfulRuns,
			DetailCTR:            ratio64(details[skill.ID], impressions[skill.ID]),
			EnableRate:           ratio64(enables[skill.ID], details[skill.ID]),
			FirstUseRate:         ratio64(firstUses[skill.ID], enables[skill.ID]),
			RepeatUseRate:        ratio64(repeatPairs[skill.ID], activePairs[skill.ID]),
			BlockRate:            ratio64(blocked[skill.ID], blocked[skill.ID]+skill.SuccessfulRuns),
			RevenueAttributionUS: nil,
		})
	}

	c.JSON(http.StatusOK, SkillAnalyticsSkillsResponse{
		Skills:          rows,
		Pagination:      skillapi.NewPagination(page.Page, page.Limit, total),
		ChargingEnabled: false,
		PeriodStart:     period.Start.Format(time.RFC3339),
		PeriodEnd:       period.End.Format(time.RFC3339),
	})
}

type analyticsPeriod struct {
	Start time.Time
	End   time.Time
}

func parseAnalyticsPeriod(c *gin.Context) (analyticsPeriod, bool) {
	now := analyticsNow().UTC()
	end := now
	start := now.Add(-defaultAnalyticsWindow)
	if rawEnd := strings.TrimSpace(c.Query("end")); rawEnd != "" {
		parsed, err := time.Parse(time.RFC3339, rawEnd)
		if err != nil {
			writeAnalyticsQueryError(c, "INVALID_END", "end must be an RFC3339 timestamp")
			return analyticsPeriod{}, false
		}
		end = parsed.UTC()
	}
	if rawStart := strings.TrimSpace(c.Query("start")); rawStart != "" {
		parsed, err := time.Parse(time.RFC3339, rawStart)
		if err != nil {
			writeAnalyticsQueryError(c, "INVALID_START", "start must be an RFC3339 timestamp")
			return analyticsPeriod{}, false
		}
		start = parsed.UTC()
	}
	if !start.Before(end) {
		writeAnalyticsQueryError(c, "INVALID_RANGE", "start must be before end")
		return analyticsPeriod{}, false
	}
	if end.Sub(start) > maxAnalyticsWindow {
		writeAnalyticsQueryError(c, "INVALID_RANGE", "date range must be 30 days or less")
		return analyticsPeriod{}, false
	}
	return analyticsPeriod{Start: start, End: end}, true
}

func writeAnalyticsQueryError(c *gin.Context, reason, message string) {
	skillapi.Error(c, errcodes.ErrInvalidRequest, message, gin.H{"reason": reason})
}

func analyticsEventsQuery(db *gorm.DB, start, end time.Time) *gorm.DB {
	return db.Model(&skillmodel.SkillUsageEvent{}).
		Where("occurred_at >= ? AND occurred_at < ?", start.UTC(), end.UTC()).
		Where("entry_point <> ?", enums.EntryPointAdminPreview)
}

func p0AnalyticsEventsQuery(db *gorm.DB) *gorm.DB {
	return db.Model(&skillmodel.SkillUsageEvent{}).
		Where("entry_point <> ?", enums.EntryPointAdminPreview).
		Where("event_type IN ?", p0AnalyticsEventTypes)
}

func dataFreshness(db *gorm.DB) (string, error) {
	latest, ok, err := latestP0AnalyticsEventOccurredAt(db)
	if err != nil {
		return "", err
	}
	return dataFreshnessFromLatest(latest, ok, analyticsNow()), nil
}

func latestP0AnalyticsEventOccurredAt(db *gorm.DB) (time.Time, bool, error) {
	var event skillmodel.SkillUsageEvent
	err := p0AnalyticsEventsQuery(db).
		Select("occurred_at").
		Order("occurred_at DESC").
		Limit(1).
		Take(&event).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return time.Time{}, false, nil
		}
		return time.Time{}, false, err
	}
	return event.OccurredAt.UTC(), true, nil
}

func dataFreshnessFromLatest(latest time.Time, hasLatest bool, now time.Time) string {
	if !hasLatest {
		return "failed"
	}
	lag := now.UTC().Sub(latest.UTC())
	if lag <= freshnessDelayedAfter {
		return "ok"
	}
	if lag <= freshnessFailedAfter {
		return "delayed"
	}
	return "failed"
}

func countWASU(db *gorm.DB, start, end time.Time) (int64, error) {
	var count int64
	err := analyticsEventsQuery(db, start, end).
		Where("event_type = ? AND success = ? AND user_id IS NOT NULL", enums.SkillUsageEventTypeUsed, true).
		Distinct("user_id").
		Count(&count).Error
	return count, err
}

func countSuccessfulRuns(db *gorm.DB, start, end time.Time) (int64, error) {
	var count int64
	err := analyticsEventsQuery(db, start, end).
		Where("event_type = ? AND success = ?", enums.SkillUsageEventTypeUsed, true).
		Count(&count).Error
	return count, err
}

func countEvents(db *gorm.DB, start, end time.Time, eventType enums.SkillUsageEventType) (int64, error) {
	var count int64
	err := analyticsEventsQuery(db, start, end).
		Where("event_type = ?", eventType).
		Count(&count).Error
	return count, err
}

func countDistinctPairsForEvent(db *gorm.DB, start, end time.Time, eventType enums.SkillUsageEventType) (int64, error) {
	pairs := analyticsEventsQuery(db, start, end).
		Select("user_id, skill_id").
		Where("event_type = ? AND user_id IS NOT NULL AND skill_id IS NOT NULL", eventType).
		Group("user_id, skill_id")
	var count int64
	err := db.Table("(?) AS analytics_pairs", pairs).Count(&count).Error
	return count, err
}

func countRepeatPairs(db *gorm.DB, start, end time.Time) (active int64, repeat int64, err error) {
	pairs := successfulPairCountsQuery(db, start, end, nil)
	if err = db.Table("(?) AS analytics_success_pairs", pairs).Count(&active).Error; err != nil {
		return 0, 0, err
	}
	err = db.Table("(?) AS analytics_success_pairs", pairs).
		Where("successful_runs >= ?", 2).
		Count(&repeat).Error
	return active, repeat, err
}

func topBlockReason(db *gorm.DB, start, end time.Time) (*string, error) {
	var rows []struct {
		BlockReason *enums.BlockReason
		Count       int64
	}
	err := analyticsEventsQuery(db, start, end).
		Select("block_reason, count(*) as count").
		Where("event_type = ?", enums.SkillUsageEventTypeBlocked).
		Group("block_reason").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	counts := map[string]int64{}
	for _, row := range rows {
		counts[analyticsBlockReason(row.BlockReason)] += row.Count
	}
	var top string
	var topCount int64
	for reason, count := range counts {
		if count > topCount || (count == topCount && reason < top) {
			top = reason
			topCount = count
		}
	}
	if top == "" {
		return nil, nil
	}
	return &top, nil
}

func loadSkillAnalyticsPage(db *gorm.DB, start, end time.Time, page skillapi.PageParams) ([]skillAnalyticsPageRow, int64, error) {
	var total int64
	if err := db.Model(&skillmodel.Skill{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	successes := analyticsEventsQuery(db, start, end).
		Select("skill_id, count(*) AS successful_runs").
		Where("event_type = ? AND success = ? AND skill_id IS NOT NULL", enums.SkillUsageEventTypeUsed, true).
		Group("skill_id")
	var rows []skillAnalyticsPageRow
	err := db.Model(&skillmodel.Skill{}).
		Select("skills.id, skills.name, skills.status, skills.required_plan, COALESCE(successes.successful_runs, 0) AS successful_runs").
		Joins("LEFT JOIN (?) AS successes ON successes.skill_id = skills.id", successes).
		Order("COALESCE(successes.successful_runs, 0) DESC").
		Order("LOWER(skills.name) ASC").
		Offset(page.Offset).
		Limit(page.Limit).
		Scan(&rows).Error
	return rows, total, err
}

func loadEnabledUsersBySkill(db *gorm.DB, skillIDs []string) (map[string]int64, error) {
	out := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := db.Model(&skillmodel.UserEnabledSkill{}).
		Select("skill_id, count(*) as count").
		Where("enabled = ? AND skill_id IN ?", true, skillIDs).
		Group("skill_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.SkillID] = row.Count
	}
	return out, nil
}

func countDistinctPairsBySkillForEvent(db *gorm.DB, start, end time.Time, skillIDs []string, eventType enums.SkillUsageEventType) (map[string]int64, error) {
	out := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return out, nil
	}
	pairs := analyticsEventsQuery(db, start, end).
		Select("skill_id, user_id").
		Where("event_type = ? AND user_id IS NOT NULL AND skill_id IN ?", eventType, skillIDs).
		Group("skill_id, user_id")
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := db.Table("(?) AS analytics_pairs", pairs).
		Select("skill_id, count(*) AS count").
		Group("skill_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.SkillID] = row.Count
	}
	return out, nil
}

func countEventsBySkill(db *gorm.DB, start, end time.Time, skillIDs []string, eventType enums.SkillUsageEventType) (map[string]int64, error) {
	out := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := analyticsEventsQuery(db, start, end).
		Select("skill_id, count(*) AS count").
		Where("event_type = ? AND skill_id IN ?", eventType, skillIDs).
		Group("skill_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.SkillID] = row.Count
	}
	return out, nil
}

func countRepeatPairsBySkill(db *gorm.DB, start, end time.Time, skillIDs []string) (map[string]int64, map[string]int64, error) {
	active := make(map[string]int64, len(skillIDs))
	repeat := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return active, repeat, nil
	}
	pairs := successfulPairCountsQuery(db, start, end, skillIDs)
	var activeRows []struct {
		SkillID string
		Count   int64
	}
	if err := db.Table("(?) AS analytics_success_pairs", pairs).
		Select("skill_id, count(*) AS count").
		Group("skill_id").
		Scan(&activeRows).Error; err != nil {
		return nil, nil, err
	}
	for _, row := range activeRows {
		active[row.SkillID] = row.Count
	}
	var repeatRows []struct {
		SkillID string
		Count   int64
	}
	if err := db.Table("(?) AS analytics_success_pairs", pairs).
		Select("skill_id, count(*) AS count").
		Where("successful_runs >= ?", 2).
		Group("skill_id").
		Scan(&repeatRows).Error; err != nil {
		return nil, nil, err
	}
	for _, row := range repeatRows {
		repeat[row.SkillID] = row.Count
	}
	return active, repeat, nil
}

func successfulPairCountsQuery(db *gorm.DB, start, end time.Time, skillIDs []string) *gorm.DB {
	query := analyticsEventsQuery(db, start, end).
		Select("skill_id, user_id, count(*) AS successful_runs").
		Where("event_type = ? AND success = ? AND user_id IS NOT NULL AND skill_id IS NOT NULL", enums.SkillUsageEventTypeUsed, true).
		Group("skill_id, user_id")
	if len(skillIDs) > 0 {
		query = query.Where("skill_id IN ?", skillIDs)
	}
	return query
}

func ratio64(numerator, denominator int64) *float64 {
	if denominator <= 0 {
		return nil
	}
	v := float64(numerator) / float64(denominator)
	return &v
}

func analyticsBlockReason(reason *enums.BlockReason) string {
	if reason == nil || *reason == "" {
		return "unknown"
	}
	switch *reason {
	case enums.BlockReasonKidsModeBlocked:
		return "kids_blocked"
	case enums.BlockReasonPlanRequired,
		enums.BlockReasonSubscriptionInactive,
		enums.BlockReasonQuotaExceeded,
		enums.BlockReasonSafetyViolation:
		return string(*reason)
	default:
		return "unknown"
	}
}
