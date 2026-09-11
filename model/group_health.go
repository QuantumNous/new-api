package model

import (
	"gorm.io/gorm/clause"
)

// GroupHealth stores aggregated per-group availability computed from the latest
// probe cycle. One row per (group, probe_ts). Upserted (not accumulated) each
// cycle so the row always reflects the most recent probe outcome.
type GroupHealth struct {
	Id           int64   `json:"id" gorm:"primaryKey"`
	Group        string  `json:"group" gorm:"column:group;size:64;uniqueIndex:idx_gh_group_ts,priority:1"`
	ProbeTs      int64   `json:"probe_ts" gorm:"uniqueIndex:idx_gh_group_ts,priority:2;index:idx_gh_probe_ts"`
	Availability float64 `json:"availability"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	TotalProbes  int     `json:"total_probes" gorm:"default:0"`
	OkProbes     int     `json:"ok_probes" gorm:"default:0"`
	FailedProbes int     `json:"failed_probes" gorm:"default:0"`
}

func (GroupHealth) TableName() string { return "group_health" }

// ModelHealth stores the last probe outcome for one (model, group, probe_ts).
// Written by the group_health_probe scheduled task's direct testChannel call.
type ModelHealth struct {
	Id        int64  `json:"id" gorm:"primaryKey"`
	ModelName string `json:"model_name" gorm:"size:128;uniqueIndex:idx_mh_model_group_ts,priority:1"`
	Group     string `json:"group" gorm:"column:group;size:64;uniqueIndex:idx_mh_model_group_ts,priority:2"`
	ProbeTs   int64  `json:"probe_ts" gorm:"uniqueIndex:idx_mh_model_group_ts,priority:3;index:idx_mh_probe_ts"`
	LatencyMs int64  `json:"latency_ms"`
	Ok        bool   `json:"ok"`
	ErrorCode int    `json:"error_code"`
	ErrorMsg  string `json:"error_msg" gorm:"type:varchar(512)"`
	ChannelId int    `json:"channel_id"`
}

func (ModelHealth) TableName() string { return "model_health" }

// UpsertModelHealth writes one probe result. (model, group, probe_ts) is unique,
// so re-probing the same cycle replaces the row (assign, not accumulate).
func UpsertModelHealth(m *ModelHealth) error {
	if m == nil {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "model_name"},
			{Name: "group"},
			{Name: "probe_ts"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"latency_ms": m.LatencyMs,
			"ok":         m.Ok,
			"error_code": m.ErrorCode,
			"error_msg":  m.ErrorMsg,
			"channel_id": m.ChannelId,
		}),
	}).Create(m).Error
}

// UpsertGroupHealth writes one cycle's group aggregate. Replace, not accumulate.
func UpsertGroupHealth(g *GroupHealth) error {
	if g == nil {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "group"},
			{Name: "probe_ts"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"availability":   g.Availability,
			"avg_latency_ms": g.AvgLatencyMs,
			"total_probes":   g.TotalProbes,
			"ok_probes":      g.OkProbes,
			"failed_probes":  g.FailedProbes,
		}),
	}).Create(g).Error
}

// latestPerKey returns the newest probe row per (model, group) since `since`.
// Uses a grouped MAX subquery over an explicit alias so the reserved `group`
// column resolves under both MySQL (backticks) and SQLite (backticks ok).
func latestModelHealth(group string, since int64) ([]ModelHealth, error) {
	var rows []ModelHealth
	groupCol := commonGroupCol
	subSQL := "(model_name, " + groupCol + ", probe_ts) IN (" +
		"SELECT model_name, " + groupCol + ", MAX(probe_ts) FROM model_health" +
		" WHERE probe_ts >= ?"
	args := []interface{}{since}
	if group != "" {
		subSQL += " AND " + groupCol + " = ?"
		args = append(args, group)
	}
	subSQL += " GROUP BY model_name, " + groupCol + ")"
	q := DB.Model(&ModelHealth{}).Where("probe_ts >= ?", since).Where(subSQL, args...)
	if group != "" {
		q = q.Where("model_health."+groupCol+" = ?", group)
	}
	err := q.Order("model_health.model_name ASC").Find(&rows).Error
	return rows, err
}

// GetLatestModelHealth returns the newest probe row per model in a group, since `since`.
func GetLatestModelHealth(group string, since int64) ([]ModelHealth, error) {
	return latestModelHealth(group, since)
}

// GetLatestGroupHealth returns the newest aggregate per group for the listed groups.
func GetLatestGroupHealth(groups []string, since int64) ([]GroupHealth, error) {
	var rows []GroupHealth
	groupCol := commonGroupCol
	subSQL := "(" + groupCol + ", probe_ts) IN (" +
		"SELECT " + groupCol + ", MAX(probe_ts) FROM group_health" +
		" WHERE probe_ts >= ?"
	args := []interface{}{since}
	if len(groups) > 0 {
		placeholders := ""
		for i := range groups {
			if i > 0 {
				placeholders += ","
			}
			placeholders += "?"
		}
		subSQL += " AND " + groupCol + " IN (" + placeholders + ")"
		args = append(args, asAnySlice(groups)...)
	}
	subSQL += " GROUP BY " + groupCol + ")"
	q := DB.Model(&GroupHealth{}).Where("probe_ts >= ?", since).Where(subSQL, args...)
	if len(groups) > 0 {
		q = q.Where("group_health."+groupCol+" IN ?", groups)
	}
	err := q.Order(commonGroupCol + " ASC").Find(&rows).Error
	return rows, err
}

func asAnySlice(ss []string) []interface{} {
	out := make([]interface{}, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}

// DeleteHealthBefore purges stale probe rows past the retention window.
func DeleteHealthBefore(groupCutoff int64, modelCutoff int64) error {
	if groupCutoff > 0 {
		if err := DB.Where("probe_ts < ?", groupCutoff).Delete(&GroupHealth{}).Error; err != nil {
			return err
		}
	}
	if modelCutoff > 0 {
		if err := DB.Where("probe_ts < ?", modelCutoff).Delete(&ModelHealth{}).Error; err != nil {
			return err
		}
	}
	return nil
}

// GetPerfMetricsSummaryByGroup aggregates perf_metrics across buckets per
// (model_name, group) in the [startTs, endTs] window — the group breakdown that
// GetPerfMetricsSummaryAll deliberately drops. Used to merge passive perf data
// into the status-check payload without N per-model queries.
func GetPerfMetricsSummaryByGroup(startTs int64, endTs int64, groups []string) ([]PerfMetricSummaryByGroup, error) {
	var summaries []PerfMetricSummaryByGroup
	query := DB.Model(&PerfMetric{}).
		Select("model_name, " + commonGroupCol + " as `group`, SUM(request_count) as request_count, SUM(success_count) as success_count, SUM(total_latency_ms) as total_latency_ms, SUM(output_tokens) as output_tokens, SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		if len(groups) == 0 {
			return summaries, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.
		Group("model_name, " + commonGroupCol).
		Having("SUM(request_count) > 0").
		Find(&summaries).Error
	return summaries, err
}

// PerfMetricSummaryByGroup mirrors PerfMetricSummary but keyed by (model, group).
type PerfMetricSummaryByGroup struct {
	ModelName      string `json:"model_name"`
	Group          string `json:"group" gorm:"column:group"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}
