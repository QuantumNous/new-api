package handler

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
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
	OneTimeRate          *float64           `json:"one_time_rate"`
	BlockRate            *float64           `json:"block_rate"`
	RevenueAttributionUS *float64           `json:"revenue_attribution_usd"`
	Trend                string             `json:"trend"`
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

type analyticsRequest struct {
	Period      analyticsPeriod
	IncludeKids bool
	Filters     analyticsFilters
	Sort        string
}

type analyticsFilters struct {
	Plan         *enums.RequiredPlan
	Persona      *string
	Status       *enums.SkillStatus
	RequiredPlan *enums.RequiredPlan
	Query        string
}

type orderedFunnelCounts struct {
	Impressions int64
	Details     int64
	Enables     int64
	FirstUses   int64
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
	wasu, err := countWASU(db, wasuStart, period.End, req.IncludeKids, req.Filters)
	if err != nil {
		writeDBError(c, err)
		return
	}
	funnel, err := countOrderedFunnel(db, period.Start, period.End, req.IncludeKids, req.Filters)
	if err != nil {
		writeDBError(c, err)
		return
	}
	totalRuns, err := countSuccessfulRuns(db, period.Start, period.End, req.IncludeKids, req.Filters)
	if err != nil {
		writeDBError(c, err)
		return
	}
	activePairs, repeatPairs, err := countRepeatPairs(db, period.Start, period.End, req.IncludeKids, req.Filters)
	if err != nil {
		writeDBError(c, err)
		return
	}
	blocked, err := countEvents(db, period.Start, period.End, enums.SkillUsageEventTypeBlocked, req.IncludeKids, req.Filters)
	if err != nil {
		writeDBError(c, err)
		return
	}
	topReason, err := topBlockReason(db, period.Start, period.End, req.IncludeKids, req.Filters)
	if err != nil {
		writeDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, SkillAnalyticsOverview{
		WASU:                 wasu,
		TotalSkillRuns:       totalRuns,
		DetailCTR:            ratio64(funnel.Details, funnel.Impressions),
		EnableRate:           ratio64(funnel.Enables, funnel.Details),
		FirstUseRate:         ratio64(funnel.FirstUses, funnel.Enables),
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

	pageRows, err := loadSkillAnalyticsRows(db, period.Start, period.End, req.IncludeKids, req.Filters)
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
	funnel, err := countOrderedFunnelBySkill(db, period.Start, period.End, req.IncludeKids, req.Filters, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	activePairs, repeatPairs, oneTimePairs, err := countUsePairsBySkill(db, period.Start, period.End, req.IncludeKids, req.Filters, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}
	blocked, err := countEventsBySkill(db, period.Start, period.End, req.IncludeKids, req.Filters, skillIDs, enums.SkillUsageEventTypeBlocked)
	if err != nil {
		writeDBError(c, err)
		return
	}
	trend, err := loadSkillAnalyticsTrends(db, period.Start, period.End, req.IncludeKids, req.Filters, skillIDs)
	if err != nil {
		writeDBError(c, err)
		return
	}

	allRows := make([]SkillAnalyticsSkillRow, 0, len(pageRows))
	for _, skill := range pageRows {
		allRows = append(allRows, SkillAnalyticsSkillRow{
			SkillID:              skill.ID,
			SkillName:            skill.Name,
			Status:               skill.Status,
			RequiredPlan:         skill.RequiredPlan,
			EnabledUsers:         enabledUsers[skill.ID],
			ActiveUsers:          activePairs[skill.ID],
			SuccessfulRuns:       skill.SuccessfulRuns,
			DetailCTR:            ratio64(funnel[skill.ID].Details, funnel[skill.ID].Impressions),
			EnableRate:           ratio64(funnel[skill.ID].Enables, funnel[skill.ID].Details),
			FirstUseRate:         ratio64(funnel[skill.ID].FirstUses, funnel[skill.ID].Enables),
			RepeatUseRate:        ratio64(repeatPairs[skill.ID], activePairs[skill.ID]),
			OneTimeRate:          ratio64(oneTimePairs[skill.ID], activePairs[skill.ID]),
			BlockRate:            ratio64(blocked[skill.ID], blocked[skill.ID]+skill.SuccessfulRuns),
			RevenueAttributionUS: nil,
			Trend:                trend[skill.ID],
		})
	}
	sortSkillAnalyticsRows(allRows, req.Sort)
	total := int64(len(allRows))
	rows := paginateSkillAnalyticsRows(allRows, page)

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

func parseAnalyticsRequest(c *gin.Context) (analyticsRequest, bool) {
	period, valid := parseAnalyticsPeriod(c)
	if !valid {
		return analyticsRequest{}, false
	}
	includeKids, valid := parseAnalyticsIncludeKids(c)
	if !valid {
		return analyticsRequest{}, false
	}
	filters, valid := parseAnalyticsFilters(c)
	if !valid {
		return analyticsRequest{}, false
	}
	sortKey, valid := parseAnalyticsSort(c)
	if !valid {
		return analyticsRequest{}, false
	}
	return analyticsRequest{
		Period:      period,
		IncludeKids: includeKids,
		Filters:     filters,
		Sort:        sortKey,
	}, true
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

func parseAnalyticsFilters(c *gin.Context) (analyticsFilters, bool) {
	var filters analyticsFilters
	if raw := strings.TrimSpace(c.Query("plan")); raw != "" {
		plan := enums.RequiredPlan(raw)
		if !plan.Valid() {
			writeAnalyticsQueryError(c, "INVALID_PLAN", "plan must be free, pro, or enterprise")
			return analyticsFilters{}, false
		}
		filters.Plan = &plan
	}
	if raw := strings.TrimSpace(c.Query("required_plan")); raw != "" {
		plan := enums.RequiredPlan(raw)
		if !plan.Valid() {
			writeAnalyticsQueryError(c, "INVALID_REQUIRED_PLAN", "required_plan must be free, pro, or enterprise")
			return analyticsFilters{}, false
		}
		filters.RequiredPlan = &plan
	}
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		status := enums.SkillStatus(raw)
		if !status.Valid() {
			writeAnalyticsQueryError(c, "INVALID_STATUS", "status must be draft, published, deprecated, or archived")
			return analyticsFilters{}, false
		}
		filters.Status = &status
	}
	if raw := strings.TrimSpace(c.Query("persona")); raw != "" {
		persona := strings.ToLower(raw)
		switch persona {
		case "casual", "dev", "team", "unset":
			filters.Persona = &persona
		default:
			writeAnalyticsQueryError(c, "INVALID_PERSONA", "persona must be casual, dev, team, or unset")
			return analyticsFilters{}, false
		}
	}
	filters.Query = strings.TrimSpace(c.Query("q"))
	return filters, true
}

func parseAnalyticsSort(c *gin.Context) (string, bool) {
	sortKey := strings.TrimSpace(c.Query("sort"))
	if sortKey == "" {
		return "-successful_runs", true
	}
	allowed := map[string]struct{}{
		"skill_name":      {},
		"enabled_users":   {},
		"active_users":    {},
		"successful_runs": {},
		"detail_ctr":      {},
		"enable_rate":     {},
		"first_use_rate":  {},
		"repeat_use_rate": {},
		"one_time_rate":   {},
		"block_rate":      {},
	}
	if validationErr := skillapi.ValidateSort(sortKey, allowed); validationErr != nil {
		skillapi.AbortQueryError(c, validationErr)
		return "", false
	}
	return sortKey, true
}

func writeAnalyticsQueryError(c *gin.Context, reason, message string) {
	skillapi.Error(c, errcodes.ErrInvalidRequest, message, gin.H{"reason": reason})
}

func analyticsEventsQuery(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters) *gorm.DB {
	query := db.Model(&skillmodel.SkillUsageEvent{}).
		Where("occurred_at >= ? AND occurred_at < ?", start.UTC(), end.UTC()).
		Where("entry_point <> ?", enums.EntryPointAdminPreview)
	if !includeKids {
		query = query.Where("is_kids_session = ?", false)
	}
	if filters.Plan != nil {
		query = query.Where("plan = ?", *filters.Plan)
	}
	if filters.Persona != nil {
		query = query.Where("persona = ?", *filters.Persona)
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

func countWASU(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters) (int64, error) {
	var count int64
	identities := analyticsEventsQuery(db, start, end, includeKids, filters).
		Select("user_id, "+analyticsSessionIdentityExpr+" AS session_identity").
		Where("event_type = ? AND success = ? AND (user_id IS NOT NULL OR session_id IS NOT NULL)", enums.SkillUsageEventTypeUsed, true).
		Group("user_id, " + analyticsSessionIdentityExpr)
	err := db.Table("(?) AS analytics_identities", identities).Count(&count).Error
	return count, err
}

func countSuccessfulRuns(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters) (int64, error) {
	var count int64
	err := analyticsEventsQuery(db, start, end, includeKids, filters).
		Where("event_type = ? AND success = ?", enums.SkillUsageEventTypeUsed, true).
		Count(&count).Error
	return count, err
}

func countEvents(db *gorm.DB, start, end time.Time, eventType enums.SkillUsageEventType, includeKids bool, filters analyticsFilters) (int64, error) {
	var count int64
	err := analyticsEventsQuery(db, start, end, includeKids, filters).
		Where("event_type = ?", eventType).
		Count(&count).Error
	return count, err
}

func countRepeatPairs(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters) (active int64, repeat int64, err error) {
	pairs := successfulPairCountsQuery(db, start, end, includeKids, filters, nil)
	if err = db.Table("(?) AS analytics_success_pairs", pairs).Count(&active).Error; err != nil {
		return 0, 0, err
	}
	err = db.Table("(?) AS analytics_success_pairs", pairs).
		Where("successful_runs >= ?", 2).
		Count(&repeat).Error
	return active, repeat, err
}

func countOrderedFunnel(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters) (orderedFunnelCounts, error) {
	stages := orderedFunnelStagesQuery(db, start, end, includeKids, filters, nil)
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

func orderedFunnelStagesQuery(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters, skillIDs []string) *gorm.DB {
	query := analyticsEventsQuery(db, start, end, includeKids, filters).
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

func topBlockReason(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters) (*string, error) {
	var rows []struct {
		BlockReason *enums.BlockReason
		Count       int64
	}
	err := analyticsEventsQuery(db, start, end, includeKids, filters).
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

func loadSkillAnalyticsRows(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters) ([]skillAnalyticsPageRow, error) {
	successes := analyticsEventsQuery(db, start, end, includeKids, filters).
		Select("skill_id, count(*) AS successful_runs").
		Where("event_type = ? AND success = ? AND skill_id IS NOT NULL", enums.SkillUsageEventTypeUsed, true).
		Group("skill_id")
	var rows []skillAnalyticsPageRow
	query := db.Model(&skillmodel.Skill{}).
		Select("skills.id, skills.name, skills.status, skills.required_plan, COALESCE(successes.successful_runs, 0) AS successful_runs").
		Joins("LEFT JOIN (?) AS successes ON successes.skill_id = skills.id", successes)
	if filters.Status != nil {
		query = query.Where("skills.status = ?", *filters.Status)
	}
	if filters.RequiredPlan != nil {
		query = query.Where("skills.required_plan = ?", *filters.RequiredPlan)
	}
	if filters.Query != "" {
		like := "%" + strings.ToLower(filters.Query) + "%"
		query = query.Where("LOWER(skills.name) LIKE ? OR LOWER(skills.slug) LIKE ?", like, like)
	}
	err := query.Scan(&rows).Error
	return rows, err
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

func countOrderedFunnelBySkill(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters, skillIDs []string) (map[string]orderedFunnelCounts, error) {
	if len(skillIDs) == 0 {
		return map[string]orderedFunnelCounts{}, nil
	}
	result := make(map[string]orderedFunnelCounts, len(skillIDs))
	for _, skillID := range skillIDs {
		result[skillID] = orderedFunnelCounts{}
	}
	stages := orderedFunnelStagesQuery(db, start, end, includeKids, filters, skillIDs)
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

func countEventsBySkill(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters, skillIDs []string, eventType enums.SkillUsageEventType) (map[string]int64, error) {
	out := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := analyticsEventsQuery(db, start, end, includeKids, filters).
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

func countUsePairsBySkill(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters, skillIDs []string) (map[string]int64, map[string]int64, map[string]int64, error) {
	active := make(map[string]int64, len(skillIDs))
	repeat := make(map[string]int64, len(skillIDs))
	oneTime := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return active, repeat, oneTime, nil
	}
	pairs := successfulPairCountsQuery(db, start, end, includeKids, filters, skillIDs)
	var rows []struct {
		SkillID        string
		SuccessfulRuns int64
	}
	if err := db.Table("(?) AS analytics_success_pairs", pairs).
		Select("skill_id, successful_runs").
		Scan(&rows).Error; err != nil {
		return nil, nil, nil, err
	}
	for _, row := range rows {
		active[row.SkillID]++
		if row.SuccessfulRuns >= 2 {
			repeat[row.SkillID]++
		} else if row.SuccessfulRuns == 1 {
			oneTime[row.SkillID]++
		}
	}
	return active, repeat, oneTime, nil
}

func successfulPairCountsQuery(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters, skillIDs []string) *gorm.DB {
	query := analyticsEventsQuery(db, start, end, includeKids, filters).
		Select("skill_id, user_id, "+analyticsSessionIdentityExpr+" AS session_identity, count(*) AS successful_runs").
		Where("event_type = ? AND success = ? AND skill_id IS NOT NULL AND (user_id IS NOT NULL OR session_id IS NOT NULL)", enums.SkillUsageEventTypeUsed, true).
		Group("skill_id, user_id, " + analyticsSessionIdentityExpr)
	if len(skillIDs) > 0 {
		query = query.Where("skill_id IN ?", skillIDs)
	}
	return query
}

func loadSkillAnalyticsTrends(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters, skillIDs []string) (map[string]string, error) {
	out := make(map[string]string, len(skillIDs))
	for _, skillID := range skillIDs {
		out[skillID] = "flat"
	}
	if len(skillIDs) == 0 {
		return out, nil
	}
	midpoint := start.UTC().Add(end.UTC().Sub(start.UTC()) / 2)
	firstHalf, err := countSuccessfulRunsBySkill(db, start, midpoint, includeKids, filters, skillIDs)
	if err != nil {
		return nil, err
	}
	secondHalf, err := countSuccessfulRunsBySkill(db, midpoint, end, includeKids, filters, skillIDs)
	if err != nil {
		return nil, err
	}
	for _, skillID := range skillIDs {
		switch {
		case secondHalf[skillID] > firstHalf[skillID]:
			out[skillID] = "up"
		case secondHalf[skillID] < firstHalf[skillID]:
			out[skillID] = "down"
		default:
			out[skillID] = "flat"
		}
	}
	return out, nil
}

func countSuccessfulRunsBySkill(db *gorm.DB, start, end time.Time, includeKids bool, filters analyticsFilters, skillIDs []string) (map[string]int64, error) {
	out := make(map[string]int64, len(skillIDs))
	if len(skillIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := analyticsEventsQuery(db, start, end, includeKids, filters).
		Select("skill_id, count(*) AS count").
		Where("event_type = ? AND success = ? AND skill_id IN ?", enums.SkillUsageEventTypeUsed, true, skillIDs).
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

func sortSkillAnalyticsRows(rows []SkillAnalyticsSkillRow, sortKey string) {
	desc := strings.HasPrefix(sortKey, "-")
	key := strings.TrimPrefix(sortKey, "-")
	sort.SliceStable(rows, func(i, j int) bool {
		if desc {
			return skillAnalyticsRowLess(rows[j], rows[i], key)
		}
		return skillAnalyticsRowLess(rows[i], rows[j], key)
	})
}

func skillAnalyticsRowLess(a, b SkillAnalyticsSkillRow, key string) bool {
	switch key {
	case "skill_name":
		return strings.ToLower(a.SkillName) < strings.ToLower(b.SkillName)
	case "enabled_users":
		return a.EnabledUsers < b.EnabledUsers
	case "active_users":
		return a.ActiveUsers < b.ActiveUsers
	case "detail_ctr":
		return ptrMetric(a.DetailCTR) < ptrMetric(b.DetailCTR)
	case "enable_rate":
		return ptrMetric(a.EnableRate) < ptrMetric(b.EnableRate)
	case "first_use_rate":
		return ptrMetric(a.FirstUseRate) < ptrMetric(b.FirstUseRate)
	case "repeat_use_rate":
		return ptrMetric(a.RepeatUseRate) < ptrMetric(b.RepeatUseRate)
	case "one_time_rate":
		return ptrMetric(a.OneTimeRate) < ptrMetric(b.OneTimeRate)
	case "block_rate":
		return ptrMetric(a.BlockRate) < ptrMetric(b.BlockRate)
	default:
		return a.SuccessfulRuns < b.SuccessfulRuns
	}
}

func ptrMetric(v *float64) float64 {
	if v == nil {
		return -1
	}
	return *v
}

func paginateSkillAnalyticsRows(rows []SkillAnalyticsSkillRow, page skillapi.PageParams) []SkillAnalyticsSkillRow {
	if page.Offset >= len(rows) {
		return []SkillAnalyticsSkillRow{}
	}
	end := page.Offset + page.Limit
	if end > len(rows) {
		end = len(rows)
	}
	return rows[page.Offset:end]
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
