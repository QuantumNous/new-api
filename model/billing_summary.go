package model

import (
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/clause"
)

// BillingHourlySummary is a pre-aggregated rollup of Log accounting fields,
// grain = (hour_bucket, model_name, channel_id). Refreshed hourly by
// service.StartBillingSummaryTask(). Backs the 平台账单 dashboard's default
// view (no token/username/email filter). Lives in LOG_DB since it's built
// from the logs table, which itself may live in a separate LOG_SQL_DSN db.
type BillingHourlySummary struct {
	Id           int64   `json:"id" gorm:"primaryKey;autoIncrement"`
	HourBucket   int64   `json:"hour_bucket" gorm:"uniqueIndex:idx_bill_hour_model_ch;index;not null"` // unix seconds, floored to the hour
	ModelName    string  `json:"model_name" gorm:"size:256;uniqueIndex:idx_bill_hour_model_ch;default:''"`
	ChannelId    int     `json:"channel_id" gorm:"uniqueIndex:idx_bill_hour_model_ch;default:0"`
	CostUSD      float64 `json:"cost_usd" gorm:"type:decimal(20,10);default:0"`    // SUM(accounting_channel_cost_amount_usd)
	RevenueUSD   float64 `json:"revenue_usd" gorm:"type:decimal(20,10);default:0"` // SUM(accounting_user_final_amount_usd)
	RequestCount int64   `json:"request_count" gorm:"default:0"`
	UpdatedAt    int64   `json:"updated_at"`
}

// UpsertBillingHourlySummaries writes/merges rows keyed by (hour_bucket, model_name, channel_id).
func UpsertBillingHourlySummaries(rows []BillingHourlySummary) error {
	if len(rows) == 0 {
		return nil
	}
	return LOG_DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "hour_bucket"}, {Name: "model_name"}, {Name: "channel_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"cost_usd", "revenue_usd", "request_count", "updated_at",
		}),
	}).Create(&rows).Error
}

// BillingDailyRow is one day's aggregated cost/revenue, returned to the
// 平台账单 page. Profit and margin are derived at query time, not stored.
type BillingDailyRow struct {
	Day                      int64   `json:"day" gorm:"column:day"` // unix seconds, floored to Beijing (UTC+8) midnight
	CostUSD                  float64 `json:"cost_usd" gorm:"column:cost_usd"`
	RevenueUSD               float64 `json:"revenue_usd" gorm:"column:revenue_usd"`
	AccountingOKRequestCount int64   `json:"accounting_ok_request_count" gorm:"column:accounting_ok_request_count"`
	AccountingTargetReqCount int64   `json:"accounting_target_request_count" gorm:"column:accounting_target_request_count"`
}

type billingDailyCountRow struct {
	Day                      int64 `gorm:"column:day"`
	AccountingTargetReqCount int64 `gorm:"column:accounting_target_request_count"`
}

// 日分桶按北京时间（UTC+8，无夏令时）切天，使账单页的"每天"与使用日志页
// （浏览器本地时间筛选，团队在北京）看到的同一天严格对齐。
const billingDayTZOffsetSeconds = 8 * 3600

// billingDayExpr returns a cross-DB SQL expression flooring the given unix-seconds
// column to Beijing midnight. MySQL's `/` is float division, so it needs DIV;
// PostgreSQL and SQLite floor with plain integer `/`.
func billingDayExpr(col string) string {
	if common.UsingMySQL {
		return fmt.Sprintf("((%s + %d) DIV 86400) * 86400 - %d", col, billingDayTZOffsetSeconds, billingDayTZOffsetSeconds)
	}
	return fmt.Sprintf("((%s + %d) / 86400) * 86400 - %d", col, billingDayTZOffsetSeconds, billingDayTZOffsetSeconds)
}

func billingTargetRequestCountExpr() string {
	return "CASE WHEN quota > 0 AND accounting_status <> '' THEN 1 ELSE 0 END"
}

// GetBillingDailyFromSummary aggregates the small pre-computed
// billing_hourly_summaries table down to daily rows. Fast regardless of how
// large the raw logs table has grown, since this table's size only depends
// on (hours × distinct models × distinct channels).
func GetBillingDailyFromSummary(startTimestamp, endTimestamp int64, modelName string, channel int) ([]BillingDailyRow, error) {
	dayExpr := billingDayExpr("hour_bucket")
	tx := LOG_DB.Table("billing_hourly_summaries").
		Select(dayExpr + ` as day,
			SUM(cost_usd) as cost_usd,
			SUM(revenue_usd) as revenue_usd,
			SUM(request_count) as accounting_ok_request_count`)
	if startTimestamp != 0 {
		tx = tx.Where("hour_bucket >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("hour_bucket <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	var rows []BillingDailyRow
	err := tx.Group(dayExpr).Order("day desc").Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	counts, err := getBillingDailyTargetRequestCounts(startTimestamp, endTimestamp, modelName, channel, "", "", "")
	if err != nil {
		return nil, err
	}
	mergeBillingDailyTargetRequestCounts(&rows, counts)
	return rows, nil
}

// GetBillingDailyFromRawLogs aggregates directly from the logs table, for
// filter combinations (token name / username / email) not covered by the
// summary table's grain. Filters directly on logs' own denormalized
// username/token_name columns (both indexed) — same idiom as GetAllLogs,
// no need to resolve names to ids first. Email is resolved to username via
// model.DB (not LOG_DB) first, so this still works when LOG_SQL_DSN points
// LOG_DB at a separate database from the one holding the users table.
func GetBillingDailyFromRawLogs(startTimestamp, endTimestamp int64, modelName string, channel int, tokenName, username, email string) ([]BillingDailyRow, error) {
	dayExpr := billingDayExpr("created_at")
	tx := LOG_DB.Table("logs").
		Select(dayExpr+` as day,
			SUM(CASE WHEN quota > 0 AND accounting_status = 'ok' THEN accounting_channel_cost_amount_usd ELSE 0 END) as cost_usd,
			SUM(CASE WHEN quota > 0 AND accounting_status = 'ok' THEN accounting_user_final_amount_usd ELSE 0 END) as revenue_usd,
			SUM(CASE WHEN quota > 0 AND accounting_status = 'ok' THEN 1 ELSE 0 END) as accounting_ok_request_count,
			SUM(`+billingTargetRequestCountExpr()+`) as accounting_target_request_count`).
		Where("type = ?", LogTypeConsume)

	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if email != "" {
		var resolvedUsername string
		err := DB.Table("users").Select("username").Where("email = ?", email).Limit(1).Scan(&resolvedUsername).Error
		if err != nil {
			return nil, err
		}
		if resolvedUsername == "" {
			// No user matches this email — return no rows rather than an
			// unfiltered aggregate.
			return []BillingDailyRow{}, nil
		}
		tx = tx.Where("username = ?", resolvedUsername)
	}

	var rows []BillingDailyRow
	err := tx.Group(dayExpr).Order("day desc").Scan(&rows).Error
	return rows, err
}

func getBillingDailyTargetRequestCounts(startTimestamp, endTimestamp int64, modelName string, channel int, tokenName, username, email string) (map[int64]int64, error) {
	dayExpr := billingDayExpr("created_at")
	tx := LOG_DB.Table("logs").
		Select(dayExpr+" as day, COUNT(*) as accounting_target_request_count").
		Where("type = ? AND quota > 0 AND accounting_status <> ''", LogTypeConsume)

	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}
	if modelName != "" {
		tx = tx.Where("model_name = ?", modelName)
	}
	if channel != 0 {
		tx = tx.Where("channel_id = ?", channel)
	}
	if tokenName != "" {
		tx = tx.Where("token_name = ?", tokenName)
	}
	if username != "" {
		tx = tx.Where("username = ?", username)
	}
	if email != "" {
		var resolvedUsername string
		err := DB.Table("users").Select("username").Where("email = ?", email).Limit(1).Scan(&resolvedUsername).Error
		if err != nil {
			return nil, err
		}
		if resolvedUsername == "" {
			return map[int64]int64{}, nil
		}
		tx = tx.Where("username = ?", resolvedUsername)
	}

	var rows []billingDailyCountRow
	if err := tx.Group(dayExpr).Scan(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[int64]int64, len(rows))
	for _, row := range rows {
		counts[row.Day] = row.AccountingTargetReqCount
	}
	return counts, nil
}

func mergeBillingDailyTargetRequestCounts(rows *[]BillingDailyRow, counts map[int64]int64) {
	if rows == nil {
		return
	}
	byDay := make(map[int64]*BillingDailyRow, len(*rows))
	for i := range *rows {
		row := &(*rows)[i]
		row.AccountingTargetReqCount = counts[row.Day]
		byDay[row.Day] = row
	}
	for day, count := range counts {
		if _, ok := byDay[day]; ok {
			continue
		}
		*rows = append(*rows, BillingDailyRow{
			Day:                      day,
			AccountingTargetReqCount: count,
		})
	}
	sort.Slice(*rows, func(i, j int) bool {
		return (*rows)[i].Day > (*rows)[j].Day
	})
}
