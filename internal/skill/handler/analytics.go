package handler

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
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
	enums.SkillUsageEventTypeSaved,
	enums.SkillUsageEventTypeUnsaved,
	enums.SkillUsageEventTypeEnabled,
	enums.SkillUsageEventTypeFirstUse,
	enums.SkillUsageEventTypeRepeatUse,
	enums.SkillUsageEventTypeUsed,
	enums.SkillUsageEventTypeBlocked,
}

type SkillAnalyticsOverview struct {
	WASU                               int64    `json:"wasu"`
	TotalSkillRuns                     int64    `json:"total_skill_runs"`
	DetailCTR                          *float64 `json:"detail_ctr"`
	EnableRate                         *float64 `json:"enable_rate"`
	FirstUseRate                       *float64 `json:"first_use_rate"`
	RepeatUseRate                      *float64 `json:"repeat_use_rate"`
	BlockRate                          *float64 `json:"block_rate"`
	TopBlockReason                     *string  `json:"top_block_reason"`
	RevenueAttributionUS               *float64 `json:"revenue_attribution_usd"`
	RechargeToFirstUseRate             *float64 `json:"recharge_to_first_use_rate"`
	RechargeToFirstUseConversions      int64    `json:"recharge_to_first_use_conversions"`
	RechargeCount                      int64    `json:"recharge_count"`
	MedianTimeToFirstUseSeconds        *int64   `json:"median_time_to_first_use_seconds"`
	SkillUseToRepeatRechargeRate       *float64 `json:"skill_use_to_repeat_recharge_rate"`
	SkillUseToRepeatRechargeUsers      int64    `json:"skill_use_to_repeat_recharge_users"`
	SkillUseToRepeatRechargeUserCohort int64    `json:"skill_use_to_repeat_recharge_user_cohort"`
	ChargingEnabled                    bool     `json:"charging_enabled"`
	DataFreshness                      string   `json:"data_freshness"`
	PeriodStart                        string   `json:"period_start"`
	PeriodEnd                          string   `json:"period_end"`
}

type SkillAnalyticsSkillRow struct {
	SkillID                            string             `json:"skill_id"`
	SkillName                          string             `json:"skill_name"`
	Status                             enums.SkillStatus  `json:"status"`
	RequiredPlan                       enums.RequiredPlan `json:"required_plan"`
	EnabledUsers                       int64              `json:"enabled_users"`
	SavedUsers                         int64              `json:"saved_users"`
	SavedButUnusedUsers                int64              `json:"saved_but_unused_users"`
	ActiveUsers                        int64              `json:"active_users"`
	SuccessfulRuns                     int64              `json:"successful_runs"`
	DetailCTR                          *float64           `json:"detail_ctr"`
	EnableRate                         *float64           `json:"enable_rate"`
	FirstUseRate                       *float64           `json:"first_use_rate"`
	RepeatUseRate                      *float64           `json:"repeat_use_rate"`
	BlockRate                          *float64           `json:"block_rate"`
	RevenueAttributionUS               *float64           `json:"revenue_attribution_usd"`
	RechargeToFirstUseRate             *float64           `json:"recharge_to_first_use_rate"`
	RechargeToFirstUseConversions      int64              `json:"recharge_to_first_use_conversions"`
	RechargeCount                      int64              `json:"recharge_count"`
	MedianTimeToFirstUseSeconds        *int64             `json:"median_time_to_first_use_seconds"`
	SkillUseToRepeatRechargeRate       *float64           `json:"skill_use_to_repeat_recharge_rate"`
	SkillUseToRepeatRechargeUsers      int64              `json:"skill_use_to_repeat_recharge_users"`
	SkillUseToRepeatRechargeUserCohort int64              `json:"skill_use_to_repeat_recharge_user_cohort"`
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
	SavedUsers     int64
}

type analyticsRequest struct {
	Period      analyticsPeriod
	IncludeKids bool
	Sort        string
}

type orderedFunnelCounts struct {
	Impressions int64
	Details     int64
	Enables     int64
	FirstUses   int64
}

type monetizationFunnelStats struct {
	RechargeCount                      int64
	RechargeToFirstUseConversions      int64
	MedianTimeToFirstUseSeconds        *int64
	SkillUseToRepeatRechargeUserCohort int64
	SkillUseToRepeatRechargeUsers      int64
	RevenueAttributionUS               float64
}

type monetizationEvent struct {
	UserID     int64
	SkillID    string
	OccurredAt time.Time
}

type successfulTopUp struct {
	UserID     int64
	OccurredAt time.Time
	RevenueUS  float64
}

const analyticsSessionIdentityExpr = "CASE WHEN user_id IS NULL THEN session_id ELSE NULL END"

func GetOpsSkillAnalyticsOverview(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	req, valid := parseAnalyticsRequest(c)
	if !valid {
		return
	}
	period := req.Period
	wasuStart := period.End.Add(-wasuWindow)

	dataFreshness, err := dataFreshness(db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	wasu, err := countWASU(db, wasuStart, period.End, req.IncludeKids)
	if err != nil {
		writeDBError(c, err)
		return
	}
	funnel, err := countOrderedFunnel(db, period.Start, period.End, req.IncludeKids)
	if err != nil {
		writeDBError(c, err)
		return
	}
	totalRuns, err := countSuccessfulRuns(db, period.Start, period.End, req.IncludeKids)
	if err != nil {
		writeDBError(c, err)
		return
	}
	activePairs, repeatPairs, err := countRepeatPairs(db, period.Start, period.End, req.IncludeKids)
	if err != nil {
		writeDBError(c, err)
		return
	}
	blocked, err := countEvents(db, period.Start, period.End, enums.SkillUsageEventTypeBlocked, req.IncludeKids)
	if err != nil {
		writeDBError(c, err)
		return
	}
	topReason, err := topBlockReason(db, period.Start, period.End, req.IncludeKids)
	if err != nil {
		writeDBError(c, err)
		return
	}
	chargingEnabled := skillAnalyticsChargingEnabled()
	monetization := monetizationFunnelStats{}
	if chargingEnabled {
		monetization, err = loadMonetizationFunnelStats(db, period.Start, period.End, req.IncludeKids, nil)
		if err != nil {
			writeDBError(c, err)
			return
		}
	}

	c.JSON(http.StatusOK, SkillAnalyticsOverview{
		WASU:                               wasu,
		TotalSkillRuns:                     totalRuns,
		DetailCTR:                          ratio64(funnel.Details, funnel.Impressions),
		EnableRate:                         ratio64(funnel.Enables, funnel.Details),
		FirstUseRate:                       ratio64(funnel.FirstUses, funnel.Enables),
		RepeatUseRate:                      ratio64(repeatPairs, activePairs),
		BlockRate:                          ratio64(blocked, blocked+totalRuns),
		TopBlockReason:                     topReason,
		RevenueAttributionUS:               revenueAttributionPtr(chargingEnabled, monetization.RevenueAttributionUS),
		RechargeToFirstUseRate:             ratio64(monetization.RechargeToFirstUseConversions, monetization.RechargeCount),
		RechargeToFirstUseConversions:      monetization.RechargeToFirstUseConversions,
		RechargeCount:                      monetization.RechargeCount,
		MedianTimeToFirstUseSeconds:        monetization.MedianTimeToFirstUseSeconds,
		SkillUseToRepeatRechargeRate:       ratio64(monetization.SkillUseToRepeatRechargeUsers, monetization.SkillUseToRepeatRechargeUserCohort),
		SkillUseToRepeatRechargeUsers:      monetization.SkillUseToRepeatRechargeUsers,
		SkillUseToRepeatRechargeUserCohort: monetization.SkillUseToRepeatRechargeUserCohort,
		ChargingEnabled:                    chargingEnabled,
		DataFreshness:                      dataFreshness,
		PeriodStart:                        period.Start.Format(time.RFC3339),
		PeriodEnd:                          period.End.Format(time.RFC3339),
	})
}

func GetOpsSkillAnalyticsSkills(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	req, valid := parseAnalyticsRequest(c)
	if !valid {
		return
	}
	period := req.Period
	page, validationErr := skillapi.ParsePageParams(c)
	if validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return
	}

	pageRows, total, err := loadSkillAnalyticsPage(db, period.Start, period.End, req.IncludeKids, req.Sort, page)
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
	savedButUnusedUsers, err := loadSavedButUnusedUsersBySkill(db, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	funnel, err := countOrderedFunnelBySkill(db, period.Start, period.End, req.IncludeKids, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	activePairs, repeatPairs, err := countRepeatPairsBySkill(db, period.Start, period.End, req.IncludeKids, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	blocked, err := countEventsBySkill(db, period.Start, period.End, skillIDs, enums.SkillUsageEventTypeBlocked, req.IncludeKids)
	if err != nil {
		writeDBError(c, err)
		return
	}
	chargingEnabled := skillAnalyticsChargingEnabled()
	monetizationBySkill := map[string]monetizationFunnelStats{}
	if chargingEnabled {
		monetizationBySkill, err = loadMonetizationFunnelStatsBySkill(db, period.Start, period.End, req.IncludeKids, skillIDs)
		if err != nil {
			writeDBError(c, err)
			return
		}
	}

	rows := make([]SkillAnalyticsSkillRow, 0, len(pageRows))
	for _, skill := range pageRows {
		monetization := monetizationBySkill[skill.ID]
		rows = append(rows, SkillAnalyticsSkillRow{
			SkillID:                            skill.ID,
			SkillName:                          skill.Name,
			Status:                             skill.Status,
			RequiredPlan:                       skill.RequiredPlan,
			EnabledUsers:                       enabledUsers[skill.ID],
			SavedUsers:                         skill.SavedUsers,
			SavedButUnusedUsers:                savedButUnusedUsers[skill.ID],
			ActiveUsers:                        activePairs[skill.ID],
			SuccessfulRuns:                     skill.SuccessfulRuns,
			DetailCTR:                          ratio64(funnel[skill.ID].Details, funnel[skill.ID].Impressions),
			EnableRate:                         ratio64(funnel[skill.ID].Enables, funnel[skill.ID].Details),
			FirstUseRate:                       ratio64(funnel[skill.ID].FirstUses, funnel[skill.ID].Enables),
			RepeatUseRate:                      ratio64(repeatPairs[skill.ID], activePairs[skill.ID]),
			BlockRate:                          ratio64(blocked[skill.ID], blocked[skill.ID]+skill.SuccessfulRuns),
			RevenueAttributionUS:               revenueAttributionPtr(chargingEnabled, monetization.RevenueAttributionUS),
			RechargeToFirstUseRate:             ratio64(monetization.RechargeToFirstUseConversions, monetization.RechargeCount),
			RechargeToFirstUseConversions:      monetization.RechargeToFirstUseConversions,
			RechargeCount:                      monetization.RechargeCount,
			MedianTimeToFirstUseSeconds:        monetization.MedianTimeToFirstUseSeconds,
			SkillUseToRepeatRechargeRate:       ratio64(monetization.SkillUseToRepeatRechargeUsers, monetization.SkillUseToRepeatRechargeUserCohort),
			SkillUseToRepeatRechargeUsers:      monetization.SkillUseToRepeatRechargeUsers,
			SkillUseToRepeatRechargeUserCohort: monetization.SkillUseToRepeatRechargeUserCohort,
		})
	}

	c.JSON(http.StatusOK, SkillAnalyticsSkillsResponse{
		Skills:          rows,
		Pagination:      skillapi.NewPagination(page.Page, page.Limit, total),
		ChargingEnabled: chargingEnabled,
		PeriodStart:     period.Start.Format(time.RFC3339),
		PeriodEnd:       period.End.Format(time.RFC3339),
	})
}

type analyticsPeriod struct {
	Start time.Time
	End   time.Time
}

func parseAnalyticsRequest(c *gin.Context) (analyticsRequest, bool) {
	period, valid := parseAnalyticsPeriod(c)
	if !valid {
		return analyticsRequest{}, false
	}
	includeKids, valid := parseAnalyticsIncludeKids(c)
	if !valid {
		return analyticsRequest{}, false
	}
	sort := strings.TrimSpace(c.DefaultQuery("sort", "runs"))
	if sort != "runs" && sort != "most_saved" {
		writeAnalyticsQueryError(c, "INVALID_SORT", "sort must be runs or most_saved")
		return analyticsRequest{}, false
	}
	return analyticsRequest{Period: period, IncludeKids: includeKids, Sort: sort}, true
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

func parseAnalyticsIncludeKids(c *gin.Context) (bool, bool) {
	raw := strings.TrimSpace(c.Query("include_kids"))
	if raw == "" {
		return false, true
	}
	includeKids, err := strconv.ParseBool(raw)
	if err != nil {
		writeAnalyticsQueryError(c, "INVALID_INCLUDE_KIDS", "include_kids must be true or false")
		return false, false
	}
	return includeKids, true
}

func writeAnalyticsQueryError(c *gin.Context, reason, message string) {
	skillapi.Error(c, errcodes.ErrInvalidRequest, message, gin.H{"reason": reason})
}

func analyticsEventsQuery(db *gorm.DB, start, end time.Time, includeKids bool) *gorm.DB {
	query := db.Model(&skillmodel.SkillUsageEvent{}).
		Where("occurred_at >= ? AND occurred_at < ?", start.UTC(), end.UTC()).
		Where("entry_point <> ?", enums.EntryPointAdminPreview)
	if !includeKids {
		query = query.Where("is_kids_session = ?", false)
	}
	return query
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
		return "ok"
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

func countWASU(db *gorm.DB, start, end time.Time, includeKids bool) (int64, error) {
	var count int64
	identities := analyticsEventsQuery(db, start, end, includeKids).
		Select("user_id, "+analyticsSessionIdentityExpr+" AS session_identity").
		Where("event_type = ? AND success = ? AND (user_id IS NOT NULL OR session_id IS NOT NULL)", enums.SkillUsageEventTypeUsed, true).
		Group("user_id, " + analyticsSessionIdentityExpr)
	err := db.Table("(?) AS analytics_identities", identities).Count(&count).Error
	return count, err
}

func countSuccessfulRuns(db *gorm.DB, start, end time.Time, includeKids bool) (int64, error) {
	var count int64
	err := analyticsEventsQuery(db, start, end, includeKids).
		Where("event_type = ? AND success = ?", enums.SkillUsageEventTypeUsed, true).
		Count(&count).Error
	return count, err
}

func countEvents(db *gorm.DB, start, end time.Time, eventType enums.SkillUsageEventType, includeKids bool) (int64, error) {
	var count int64
	err := analyticsEventsQuery(db, start, end, includeKids).
		Where("event_type = ?", eventType).
		Count(&count).Error
	return count, err
}

func countRepeatPairs(db *gorm.DB, start, end time.Time, includeKids bool) (active int64, repeat int64, err error) {
	pairs := successfulPairCountsQuery(db, start, end, includeKids, nil)
	if err = db.Table("(?) AS analytics_success_pairs", pairs).Count(&active).Error; err != nil {
		return 0, 0, err
	}
	err = db.Table("(?) AS analytics_success_pairs", pairs).
		Where("successful_runs >= ?", 2).
		Count(&repeat).Error
	return active, repeat, err
}

func countOrderedFunnel(db *gorm.DB, start, end time.Time, includeKids bool) (orderedFunnelCounts, error) {
	stages := orderedFunnelStagesQuery(db, start, end, includeKids, nil)
	impressions, err := countOrderedFunnelRows(db, stages, "impression_at IS NOT NULL")
	if err != nil {
		return orderedFunnelCounts{}, err
	}
	details, err := countOrderedFunnelRows(db, stages, "impression_at IS NOT NULL AND detail_at IS NOT NULL AND impression_at <= detail_at")
	if err != nil {
		return orderedFunnelCounts{}, err
	}
	enables, err := countOrderedFunnelRows(db, stages, "impression_at IS NOT NULL AND detail_at IS NOT NULL AND enable_at IS NOT NULL AND impression_at <= detail_at AND detail_at <= enable_at")
	if err != nil {
		return orderedFunnelCounts{}, err
	}
	firstUses, err := countOrderedFunnelRows(db, stages, "impression_at IS NOT NULL AND detail_at IS NOT NULL AND enable_at IS NOT NULL AND first_use_at IS NOT NULL AND impression_at <= detail_at AND detail_at <= enable_at AND enable_at <= first_use_at")
	if err != nil {
		return orderedFunnelCounts{}, err
	}
	return orderedFunnelCounts{
		Impressions: impressions,
		Details:     details,
		Enables:     enables,
		FirstUses:   firstUses,
	}, nil
}

func countOrderedFunnelRows(db *gorm.DB, stages *gorm.DB, condition string) (int64, error) {
	var count int64
	err := db.Table("(?) AS analytics_funnel", stages).
		Where(condition).
		Count(&count).Error
	return count, err
}

func orderedFunnelStagesQuery(db *gorm.DB, start, end time.Time, includeKids bool, skillIDs []string) *gorm.DB {
	query := analyticsEventsQuery(db, start, end, includeKids).
		Select(`
			skill_id,
			user_id,
			`+analyticsSessionIdentityExpr+` AS session_identity,
			MIN(CASE WHEN event_type = ? THEN occurred_at END) AS impression_at,
			MIN(CASE WHEN event_type = ? THEN occurred_at END) AS detail_at,
			MIN(CASE WHEN event_type = ? THEN occurred_at END) AS enable_at,
			MIN(CASE WHEN event_type = ? THEN occurred_at END) AS first_use_at
		`,
			enums.SkillUsageEventTypeImpression,
			enums.SkillUsageEventTypeDetailView,
			enums.SkillUsageEventTypeEnabled,
			enums.SkillUsageEventTypeFirstUse,
		).
		Where("event_type IN ?", []enums.SkillUsageEventType{
			enums.SkillUsageEventTypeImpression,
			enums.SkillUsageEventTypeDetailView,
			enums.SkillUsageEventTypeEnabled,
			enums.SkillUsageEventTypeFirstUse,
		}).
		Where("skill_id IS NOT NULL").
		Where("(user_id IS NOT NULL OR session_id IS NOT NULL)").
		Group("skill_id, user_id, " + analyticsSessionIdentityExpr)
	if len(skillIDs) > 0 {
		query = query.Where("skill_id IN ?", skillIDs)
	}
	return query
}

func topBlockReason(db *gorm.DB, start, end time.Time, includeKids bool) (*string, error) {
	var rows []struct {
		BlockReason *enums.BlockReason
		Count       int64
	}
	err := analyticsEventsQuery(db, start, end, includeKids).
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

func loadSkillAnalyticsPage(db *gorm.DB, start, end time.Time, includeKids bool, sort string, page skillapi.PageParams) ([]skillAnalyticsPageRow, int64, error) {
	var total int64
	if err := db.Model(&skillmodel.Skill{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	successes := analyticsEventsQuery(db, start, end, includeKids).
		Select("skill_id, count(*) AS successful_runs").
		Where("event_type = ? AND success = ? AND skill_id IS NOT NULL", enums.SkillUsageEventTypeUsed, true).
		Group("skill_id")
	saves := db.Model(&skillmodel.UserSavedSkill{}).
		Select("skill_id, count(*) AS saved_users").
		Where("saved = ?", true).
		Group("skill_id")
	orderColumn := "COALESCE(successes.successful_runs, 0)"
	if sort == "most_saved" {
		orderColumn = "COALESCE(saves.saved_users, 0)"
	}
	var rows []skillAnalyticsPageRow
	err := db.Model(&skillmodel.Skill{}).
		Select("skills.id, skills.name, skills.status, skills.required_plan, COALESCE(successes.successful_runs, 0) AS successful_runs, COALESCE(saves.saved_users, 0) AS saved_users").
		Joins("LEFT JOIN (?) AS successes ON successes.skill_id = skills.id", successes).
		Joins("LEFT JOIN (?) AS saves ON saves.skill_id = skills.id", saves).
		Order(orderColumn + " DESC").
		Order("LOWER(skills.name) ASC").
		Offset(page.Offset).
		Limit(page.Limit).
		Scan(&rows).Error
	return rows, total, err
}

func loadSavedButUnusedUsersBySkill(db *gorm.DB, skillIDs []string) (map[string]int64, error) {
	out := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := db.Model(&skillmodel.UserSavedSkill{}).
		Select("user_saved_skills.skill_id, count(*) as count").
		Joins(`LEFT JOIN user_enabled_skills AS ues
			ON ues.user_id = user_saved_skills.user_id
			AND ues.tenant_id = user_saved_skills.tenant_id
			AND ues.skill_id = user_saved_skills.skill_id`).
		Where("user_saved_skills.saved = ? AND user_saved_skills.skill_id IN ?", true, skillIDs).
		Where("ues.last_used_at IS NULL").
		Group("user_saved_skills.skill_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.SkillID] = row.Count
	}
	return out, nil
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

func countOrderedFunnelBySkill(db *gorm.DB, start, end time.Time, includeKids bool, skillIDs []string) (map[string]orderedFunnelCounts, error) {
	if len(skillIDs) == 0 {
		return map[string]orderedFunnelCounts{}, nil
	}
	result := make(map[string]orderedFunnelCounts, len(skillIDs))
	for _, skillID := range skillIDs {
		result[skillID] = orderedFunnelCounts{}
	}
	stages := orderedFunnelStagesQuery(db, start, end, includeKids, skillIDs)
	queries := []struct {
		condition string
		apply     func(*orderedFunnelCounts, int64)
	}{
		{
			condition: "impression_at IS NOT NULL",
			apply: func(counts *orderedFunnelCounts, count int64) {
				counts.Impressions = count
			},
		},
		{
			condition: "impression_at IS NOT NULL AND detail_at IS NOT NULL AND impression_at <= detail_at",
			apply: func(counts *orderedFunnelCounts, count int64) {
				counts.Details = count
			},
		},
		{
			condition: "impression_at IS NOT NULL AND detail_at IS NOT NULL AND enable_at IS NOT NULL AND impression_at <= detail_at AND detail_at <= enable_at",
			apply: func(counts *orderedFunnelCounts, count int64) {
				counts.Enables = count
			},
		},
		{
			condition: "impression_at IS NOT NULL AND detail_at IS NOT NULL AND enable_at IS NOT NULL AND first_use_at IS NOT NULL AND impression_at <= detail_at AND detail_at <= enable_at AND enable_at <= first_use_at",
			apply: func(counts *orderedFunnelCounts, count int64) {
				counts.FirstUses = count
			},
		},
	}
	for _, query := range queries {
		rows, err := countOrderedFunnelRowsBySkill(db, stages, query.condition)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			counts := result[row.SkillID]
			query.apply(&counts, row.Count)
			result[row.SkillID] = counts
		}
	}
	return result, nil
}

func countOrderedFunnelRowsBySkill(db *gorm.DB, stages *gorm.DB, condition string) ([]struct {
	SkillID string
	Count   int64
}, error) {
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := db.Table("(?) AS analytics_funnel", stages).
		Select("skill_id, count(*) AS count").
		Where(condition).
		Group("skill_id").
		Scan(&rows).Error
	return rows, err
}

func countEventsBySkill(db *gorm.DB, start, end time.Time, skillIDs []string, eventType enums.SkillUsageEventType, includeKids bool) (map[string]int64, error) {
	out := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := analyticsEventsQuery(db, start, end, includeKids).
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

func countRepeatPairsBySkill(db *gorm.DB, start, end time.Time, includeKids bool, skillIDs []string) (map[string]int64, map[string]int64, error) {
	active := make(map[string]int64, len(skillIDs))
	repeat := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return active, repeat, nil
	}
	pairs := successfulPairCountsQuery(db, start, end, includeKids, skillIDs)
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

func successfulPairCountsQuery(db *gorm.DB, start, end time.Time, includeKids bool, skillIDs []string) *gorm.DB {
	query := analyticsEventsQuery(db, start, end, includeKids).
		Select("skill_id, user_id, "+analyticsSessionIdentityExpr+" AS session_identity, count(*) AS successful_runs").
		Where("event_type = ? AND success = ? AND skill_id IS NOT NULL AND (user_id IS NOT NULL OR session_id IS NOT NULL)", enums.SkillUsageEventTypeUsed, true).
		Group("skill_id, user_id, " + analyticsSessionIdentityExpr)
	if len(skillIDs) > 0 {
		query = query.Where("skill_id IN ?", skillIDs)
	}
	return query
}

func loadMonetizationFunnelStats(db *gorm.DB, start, end time.Time, includeKids bool, skillIDs []string) (monetizationFunnelStats, error) {
	topUps, err := loadSuccessfulTopUps(db, start, end)
	if err != nil {
		return monetizationFunnelStats{}, err
	}
	firstUses, err := loadMonetizationEvents(db, start, end, includeKids, enums.SkillUsageEventTypeFirstUse, skillIDs)
	if err != nil {
		return monetizationFunnelStats{}, err
	}
	usedEvents, err := loadMonetizationEvents(db, start, end, includeKids, enums.SkillUsageEventTypeUsed, skillIDs)
	if err != nil {
		return monetizationFunnelStats{}, err
	}

	var durations []int64
	var revenue float64
	var rechargeConversions int64
	for _, topUp := range topUps {
		firstUse, ok := firstSkillUseAfter(topUp, firstUses)
		if !ok {
			continue
		}
		rechargeConversions++
		durations = append(durations, int64(firstUse.OccurredAt.Sub(topUp.OccurredAt).Seconds()))
	}

	topUpsByUser := map[int64][]successfulTopUp{}
	for _, topUp := range topUps {
		topUpsByUser[topUp.UserID] = append(topUpsByUser[topUp.UserID], topUp)
	}
	for userID := range topUpsByUser {
		sort.Slice(topUpsByUser[userID], func(i, j int) bool {
			return topUpsByUser[userID][i].OccurredAt.Before(topUpsByUser[userID][j].OccurredAt)
		})
	}
	cohort := map[string]monetizationEvent{}
	for _, used := range usedEvents {
		key := monetizationUserSkillKey(used.UserID, used.SkillID)
		if existing, ok := cohort[key]; !ok || used.OccurredAt.Before(existing.OccurredAt) {
			cohort[key] = used
		}
	}
	var repeatUsers int64
	for _, used := range cohort {
		recharge, ok := firstTopUpAfter(topUpsByUser[used.UserID], used.OccurredAt)
		if ok {
			repeatUsers++
			revenue += recharge.RevenueUS
		}
	}

	return monetizationFunnelStats{
		RechargeCount:                      int64(len(topUps)),
		RechargeToFirstUseConversions:      rechargeConversions,
		MedianTimeToFirstUseSeconds:        medianInt64(durations),
		SkillUseToRepeatRechargeUserCohort: int64(len(cohort)),
		SkillUseToRepeatRechargeUsers:      repeatUsers,
		RevenueAttributionUS:               revenue,
	}, nil
}

func loadMonetizationFunnelStatsBySkill(db *gorm.DB, start, end time.Time, includeKids bool, skillIDs []string) (map[string]monetizationFunnelStats, error) {
	topUps, err := loadSuccessfulTopUps(db, start, end)
	if err != nil {
		return nil, err
	}
	firstUses, err := loadMonetizationEvents(db, start, end, includeKids, enums.SkillUsageEventTypeFirstUse, skillIDs)
	if err != nil {
		return nil, err
	}
	usedEvents, err := loadMonetizationEvents(db, start, end, includeKids, enums.SkillUsageEventTypeUsed, skillIDs)
	if err != nil {
		return nil, err
	}

	topUpsByUser := map[int64][]successfulTopUp{}
	for _, topUp := range topUps {
		topUpsByUser[topUp.UserID] = append(topUpsByUser[topUp.UserID], topUp)
	}
	for userID := range topUpsByUser {
		sort.Slice(topUpsByUser[userID], func(i, j int) bool {
			return topUpsByUser[userID][i].OccurredAt.Before(topUpsByUser[userID][j].OccurredAt)
		})
	}

	out := map[string]monetizationFunnelStats{}
	timeToFirstUse := map[string][]int64{}
	for _, topUp := range topUps {
		firstUse, ok := firstSkillUseAfter(topUp, firstUses)
		if !ok {
			continue
		}
		stats := out[firstUse.SkillID]
		stats.RechargeToFirstUseConversions++
		seconds := int64(firstUse.OccurredAt.Sub(topUp.OccurredAt).Seconds())
		timeToFirstUse[firstUse.SkillID] = append(timeToFirstUse[firstUse.SkillID], seconds)
		out[firstUse.SkillID] = stats
	}
	for _, skillID := range skillIDsForFunnelDenominator(skillIDs, firstUses) {
		stats := out[skillID]
		stats.RechargeCount = int64(len(topUps))
		out[skillID] = stats
	}

	cohort := map[string]monetizationEvent{}
	for _, used := range usedEvents {
		key := monetizationUserSkillKey(used.UserID, used.SkillID)
		if existing, ok := cohort[key]; !ok || used.OccurredAt.Before(existing.OccurredAt) {
			cohort[key] = used
		}
	}
	for _, used := range cohort {
		stats := out[used.SkillID]
		stats.SkillUseToRepeatRechargeUserCohort++
		recharge, ok := firstTopUpAfter(topUpsByUser[used.UserID], used.OccurredAt)
		if ok {
			stats.SkillUseToRepeatRechargeUsers++
			stats.RevenueAttributionUS += recharge.RevenueUS
		}
		out[used.SkillID] = stats
	}
	for skillID, durations := range timeToFirstUse {
		stats := out[skillID]
		stats.MedianTimeToFirstUseSeconds = medianInt64(durations)
		out[skillID] = stats
	}
	return out, nil
}

func loadSuccessfulTopUps(db *gorm.DB, start, end time.Time) ([]successfulTopUp, error) {
	var rows []platformmodel.TopUp
	err := db.Model(&platformmodel.TopUp{}).
		Where("status = ?", common.TopUpStatusSuccess).
		Where("complete_time >= ? AND complete_time < ?", start.UTC().Unix(), end.UTC().Unix()).
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]successfulTopUp, 0, len(rows))
	for _, row := range rows {
		if row.UserId <= 0 || row.CompleteTime <= 0 {
			continue
		}
		out = append(out, successfulTopUp{
			UserID:     int64(row.UserId),
			OccurredAt: time.Unix(row.CompleteTime, 0).UTC(),
			RevenueUS:  row.Money,
		})
	}
	return out, nil
}

func loadMonetizationEvents(db *gorm.DB, start, end time.Time, includeKids bool, eventType enums.SkillUsageEventType, skillIDs []string) ([]monetizationEvent, error) {
	query := analyticsEventsQuery(db, start, end, includeKids).
		Select("user_id, skill_id, occurred_at").
		Where("event_type = ? AND user_id IS NOT NULL AND skill_id IS NOT NULL", eventType)
	if eventType == enums.SkillUsageEventTypeUsed {
		query = query.Where("success = ?", true)
	}
	if len(skillIDs) > 0 {
		query = query.Where("skill_id IN ?", skillIDs)
	}
	var rows []struct {
		UserID     int64
		SkillID    string
		OccurredAt time.Time
	}
	if err := query.Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]monetizationEvent, 0, len(rows))
	for _, row := range rows {
		if row.UserID == 0 || row.SkillID == "" {
			continue
		}
		out = append(out, monetizationEvent{UserID: row.UserID, SkillID: row.SkillID, OccurredAt: row.OccurredAt.UTC()})
	}
	return out, nil
}

func firstSkillUseAfter(topUp successfulTopUp, firstUses []monetizationEvent) (monetizationEvent, bool) {
	var best monetizationEvent
	found := false
	for _, firstUse := range firstUses {
		if firstUse.UserID != topUp.UserID || !firstUse.OccurredAt.After(topUp.OccurredAt) {
			continue
		}
		if !found || firstUse.OccurredAt.Before(best.OccurredAt) {
			best = firstUse
			found = true
		}
	}
	return best, found
}

func firstTopUpAfter(topUps []successfulTopUp, after time.Time) (successfulTopUp, bool) {
	for _, topUp := range topUps {
		if topUp.OccurredAt.After(after) {
			return topUp, true
		}
	}
	return successfulTopUp{}, false
}

func skillIDsForFunnelDenominator(skillIDs []string, firstUses []monetizationEvent) []string {
	if len(skillIDs) > 0 {
		return skillIDs
	}
	seen := map[string]struct{}{}
	for _, event := range firstUses {
		seen[event.SkillID] = struct{}{}
	}
	out := make([]string, 0, len(seen))
	for skillID := range seen {
		out = append(out, skillID)
	}
	return out
}

func monetizationUserSkillKey(userID int64, skillID string) string {
	return strconv.FormatInt(userID, 10) + ":" + skillID
}

func medianInt64(values []int64) *int64 {
	if len(values) == 0 {
		return nil
	}
	sort.Slice(values, func(i, j int) bool { return values[i] < values[j] })
	v := values[len(values)/2]
	if len(values)%2 == 0 {
		v = (values[len(values)/2-1] + values[len(values)/2]) / 2
	}
	return &v
}

func revenueAttributionPtr(chargingEnabled bool, value float64) *float64 {
	if !chargingEnabled {
		return nil
	}
	return &value
}

func skillAnalyticsChargingEnabled() bool {
	stripe := strings.TrimSpace(setting.StripeApiSecret) != "" &&
		strings.TrimSpace(setting.StripeWebhookSecret) != "" &&
		strings.TrimSpace(setting.StripePriceId) != ""
	creem := strings.TrimSpace(setting.CreemApiKey) != "" &&
		strings.TrimSpace(setting.CreemProducts) != "" &&
		strings.TrimSpace(setting.CreemProducts) != "[]"
	waffo := setting.WaffoEnabled &&
		((setting.WaffoSandbox &&
			strings.TrimSpace(setting.WaffoSandboxApiKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPrivateKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPublicCert) != "") ||
			(!setting.WaffoSandbox &&
				strings.TrimSpace(setting.WaffoApiKey) != "" &&
				strings.TrimSpace(setting.WaffoPrivateKey) != "" &&
				strings.TrimSpace(setting.WaffoPublicCert) != ""))
	waffoPancake := setting.WaffoPancakeEnabled &&
		strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPancakeStoreID) != "" &&
		strings.TrimSpace(setting.WaffoPancakeProductID) != "" &&
		((setting.WaffoPancakeSandbox && strings.TrimSpace(setting.WaffoPancakeWebhookTestKey) != "") ||
			(!setting.WaffoPancakeSandbox && strings.TrimSpace(setting.WaffoPancakeWebhookPublicKey) != ""))
	airwallex := setting.AirwallexEnabled &&
		strings.TrimSpace(setting.AirwallexClientId) != "" &&
		strings.TrimSpace(setting.AirwallexApiKey) != "" &&
		strings.TrimSpace(setting.AirwallexWebhookSecret) != ""
	epay := strings.TrimSpace(operation_setting.PayAddress) != "" &&
		strings.TrimSpace(operation_setting.EpayId) != "" &&
		strings.TrimSpace(operation_setting.EpayKey) != "" &&
		len(operation_setting.PayMethods) > 0
	return stripe || creem || waffo || waffoPancake || airwallex || epay
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
