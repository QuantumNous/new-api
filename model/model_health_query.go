package model

import (
	"fmt"

	"gorm.io/gorm"
)

type ModelHealthHourlyStat struct {
	ModelName     string  `json:"model_name"`
	HourStartTs   int64   `json:"hour_start_ts"`
	SuccessSlices int64   `json:"success_slices"`
	TotalSlices   int64   `json:"total_slices"`
	SuccessRate   float64 `json:"success_rate"`
}

func hourStartExprSQL(db *gorm.DB) string {
	// Align 5m slice timestamp (seconds) to hour start, and keep the result INTEGER.
	// Notes:
	// - MySQL: `/` is floating division; use `DIV` for integer division.
	// - SQLite: `/` returns REAL; cast back to INTEGER.
	// - Postgres: int/int is integer division.
	if db != nil && db.Dialector != nil {
		switch db.Dialector.Name() {
		case "mysql":
			return "((slice_start_ts DIV 3600) * 3600)"
		case "sqlite":
			return "(CAST((slice_start_ts / 3600) AS INTEGER) * 3600)"
		}
	}
	return "((slice_start_ts / 3600) * 3600)"
}

func successRateExprSQL() string {
	// Force float division across DBs (Postgres int/int would otherwise truncate).
	return "CASE WHEN COUNT(*) = 0 THEN 0 ELSE (1.0 * SUM(has_success_qualified)) / COUNT(*) END"
}

func GetModelHealthHourlyStats(db *gorm.DB, modelName string, startHourTs int64, endHourTs int64) ([]ModelHealthHourlyStat, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if modelName == "" {
		return nil, fmt.Errorf("model_name is required")
	}
	if startHourTs <= 0 || endHourTs <= 0 || endHourTs <= startHourTs {
		return nil, fmt.Errorf("invalid hour range")
	}

	var rows []ModelHealthHourlyStat
	err := db.Table((&ModelHealthSlice5m{}).TableName()).
		Select(fmt.Sprintf(`
model_name as model_name,
%s as hour_start_ts,
SUM(has_success_qualified) as success_slices,
COUNT(*) as total_slices,
%s as success_rate`, hourStartExprSQL(db), successRateExprSQL())).
		Where("model_name = ?", modelName).
		Where("slice_start_ts >= ? AND slice_start_ts < ?", startHourTs, endHourTs).
		Group("model_name, hour_start_ts").
		Order("hour_start_ts ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func GetAllModelsHealthHourlyStats(db *gorm.DB, startHourTs int64, endHourTs int64) ([]ModelHealthHourlyStat, error) {
	if db == nil {
		return nil, fmt.Errorf("db is nil")
	}
	if startHourTs <= 0 || endHourTs <= 0 || endHourTs <= startHourTs {
		return nil, fmt.Errorf("invalid hour range")
	}

	var rows []ModelHealthHourlyStat
	err := db.Table((&ModelHealthSlice5m{}).TableName()).
		Select(fmt.Sprintf(`
model_name as model_name,
%s as hour_start_ts,
SUM(has_success_qualified) as success_slices,
COUNT(*) as total_slices,
%s as success_rate`, hourStartExprSQL(db), successRateExprSQL())).
		Where("slice_start_ts >= ? AND slice_start_ts < ?", startHourTs, endHourTs).
		Group("model_name, hour_start_ts").
		Order("model_name ASC, hour_start_ts ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}