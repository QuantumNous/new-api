package handler

import (
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
	wasuWindow             = 7 * 24 * time.Hour
)

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

type analyticsEvent struct {
	EventType   enums.SkillUsageEventType
	OccurredAt  time.Time
	UserID      *int64
	SkillID     *string
	EntryPoint  enums.EntryPoint
	Success     *bool
	BlockReason *enums.BlockReason
}

type analyticsCounters struct {
	impressions  map[string]struct{}
	details      map[string]struct{}
	enables      map[string]struct{}
	firstUses    map[string]struct{}
	successes    map[string]int64
	blocked      int64
	blockReasons map[string]int64
}

func newAnalyticsCounters() analyticsCounters {
	return analyticsCounters{
		impressions:  map[string]struct{}{},
		details:      map[string]struct{}{},
		enables:      map[string]struct{}{},
		firstUses:    map[string]struct{}{},
		successes:    map[string]int64{},
		blockReasons: map[string]int64{},
	}
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
	queryStart := period.Start
	wasuStart := period.End.Add(-wasuWindow)
	if wasuStart.Before(queryStart) {
		queryStart = wasuStart
	}
	events, err := loadAnalyticsEvents(db, queryStart, period.End)
	if err != nil {
		writeDBError(c, err)
		return
	}

	selected := newAnalyticsCounters()
	wasuUsers := map[int64]struct{}{}
	for _, event := range events {
		if event.EntryPoint == enums.EntryPointAdminPreview {
			continue
		}
		successfulRun := isSuccessfulSkillRun(event)
		if !event.OccurredAt.Before(period.Start) {
			selected.add(event)
		}
		if successfulRun && !event.OccurredAt.Before(wasuStart) && event.UserID != nil {
			wasuUsers[*event.UserID] = struct{}{}
		}
	}

	overview := SkillAnalyticsOverview{
		WASU:                 int64(len(wasuUsers)),
		TotalSkillRuns:       selected.successfulRuns(),
		DetailCTR:            ratio(len(selected.details), len(selected.impressions)),
		EnableRate:           ratio(len(selected.enables), len(selected.details)),
		FirstUseRate:         ratio(len(selected.firstUses), len(selected.enables)),
		RepeatUseRate:        selected.repeatUseRate(),
		BlockRate:            ratio64(selected.blocked, selected.blocked+selected.successfulRuns()),
		TopBlockReason:       selected.topBlockReason(),
		RevenueAttributionUS: nil,
		ChargingEnabled:      false,
		DataFreshness:        "ok",
		PeriodStart:          period.Start.Format(time.RFC3339),
		PeriodEnd:            period.End.Format(time.RFC3339),
	}
	c.JSON(http.StatusOK, overview)
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

	events, err := loadAnalyticsEvents(db, period.Start, period.End)
	if err != nil {
		writeDBError(c, err)
		return
	}
	bySkill := map[string]analyticsCounters{}
	for _, event := range events {
		if event.SkillID == nil || event.EntryPoint == enums.EntryPointAdminPreview {
			continue
		}
		counters, exists := bySkill[*event.SkillID]
		if !exists {
			counters = newAnalyticsCounters()
		}
		counters.add(event)
		bySkill[*event.SkillID] = counters
	}

	enabledUsers, err := loadEnabledUsersBySkill(db)
	if err != nil {
		writeDBError(c, err)
		return
	}

	var skills []skillmodel.Skill
	if err := db.Model(&skillmodel.Skill{}).
		Select("id, name, status, required_plan").
		Find(&skills).Error; err != nil {
		writeDBError(c, err)
		return
	}

	rows := make([]SkillAnalyticsSkillRow, 0, len(skills))
	for _, skill := range skills {
		counters, exists := bySkill[skill.ID]
		if !exists {
			counters = newAnalyticsCounters()
		}
		rows = append(rows, SkillAnalyticsSkillRow{
			SkillID:              skill.ID,
			SkillName:            skill.Name,
			Status:               skill.Status,
			RequiredPlan:         skill.RequiredPlan,
			EnabledUsers:         enabledUsers[skill.ID],
			ActiveUsers:          int64(len(counters.successes)),
			SuccessfulRuns:       counters.successfulRuns(),
			DetailCTR:            ratio(len(counters.details), len(counters.impressions)),
			EnableRate:           ratio(len(counters.enables), len(counters.details)),
			FirstUseRate:         ratio(len(counters.firstUses), len(counters.enables)),
			RepeatUseRate:        counters.repeatUseRate(),
			BlockRate:            ratio64(counters.blocked, counters.blocked+counters.successfulRuns()),
			RevenueAttributionUS: nil,
		})
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].SuccessfulRuns != rows[j].SuccessfulRuns {
			return rows[i].SuccessfulRuns > rows[j].SuccessfulRuns
		}
		return strings.ToLower(rows[i].SkillName) < strings.ToLower(rows[j].SkillName)
	})

	total := int64(len(rows))
	start := page.Offset
	if start > len(rows) {
		start = len(rows)
	}
	end := start + page.Limit
	if end > len(rows) {
		end = len(rows)
	}

	c.JSON(http.StatusOK, SkillAnalyticsSkillsResponse{
		Skills:          rows[start:end],
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
	now := time.Now().UTC()
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
	return analyticsPeriod{Start: start, End: end}, true
}

func writeAnalyticsQueryError(c *gin.Context, reason, message string) {
	skillapi.Error(c, errcodes.ErrInvalidRequest, message, gin.H{"reason": reason})
}

func loadAnalyticsEvents(db *gorm.DB, start, end time.Time) ([]analyticsEvent, error) {
	var events []analyticsEvent
	err := db.Model(&skillmodel.SkillUsageEvent{}).
		Select("event_type, occurred_at, user_id, skill_id, entry_point, success, block_reason").
		Where("occurred_at >= ? AND occurred_at < ?", start.UTC(), end.UTC()).
		Find(&events).Error
	return events, err
}

func loadEnabledUsersBySkill(db *gorm.DB) (map[string]int64, error) {
	var rows []struct {
		SkillID string
		Count   int64
	}
	err := db.Model(&skillmodel.UserEnabledSkill{}).
		Select("skill_id, count(*) as count").
		Where("enabled = ?", true).
		Group("skill_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[string]int64, len(rows))
	for _, row := range rows {
		out[row.SkillID] = row.Count
	}
	return out, nil
}

func (c *analyticsCounters) add(event analyticsEvent) {
	pair, hasPair := analyticsPairKey(event)
	switch event.EventType {
	case enums.SkillUsageEventTypeImpression:
		if hasPair {
			c.impressions[pair] = struct{}{}
		}
	case enums.SkillUsageEventTypeDetailView:
		if hasPair {
			c.details[pair] = struct{}{}
		}
	case enums.SkillUsageEventTypeEnabled:
		if hasPair {
			c.enables[pair] = struct{}{}
		}
	case enums.SkillUsageEventTypeFirstUse:
		if hasPair {
			c.firstUses[pair] = struct{}{}
		}
	case enums.SkillUsageEventTypeUsed:
		if isSuccessfulSkillRun(event) && hasPair {
			c.successes[pair]++
		}
	case enums.SkillUsageEventTypeBlocked:
		c.blocked++
		reason := analyticsBlockReason(event.BlockReason)
		c.blockReasons[reason]++
	}
}

func analyticsPairKey(event analyticsEvent) (string, bool) {
	if event.UserID == nil || event.SkillID == nil || *event.SkillID == "" {
		return "", false
	}
	return *event.SkillID + ":" + strconv.FormatInt(*event.UserID, 10), true
}

func isSuccessfulSkillRun(event analyticsEvent) bool {
	return event.EventType == enums.SkillUsageEventTypeUsed && event.Success != nil && *event.Success
}

func (c analyticsCounters) successfulRuns() int64 {
	var total int64
	for _, count := range c.successes {
		total += count
	}
	return total
}

func (c analyticsCounters) repeatUseRate() *float64 {
	var repeat int
	for _, count := range c.successes {
		if count >= 2 {
			repeat++
		}
	}
	return ratio(repeat, len(c.successes))
}

func (c analyticsCounters) topBlockReason() *string {
	var top string
	var topCount int64
	for reason, count := range c.blockReasons {
		if count > topCount || (count == topCount && reason < top) {
			top = reason
			topCount = count
		}
	}
	if top == "" {
		return nil
	}
	return &top
}

func ratio(numerator, denominator int) *float64 {
	return ratio64(int64(numerator), int64(denominator))
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
