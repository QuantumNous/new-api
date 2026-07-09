package model

import "gorm.io/gorm/clause"

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
	Day        int64   `json:"day" gorm:"column:day"` // unix seconds, floored to the day (UTC)
	CostUSD    float64 `json:"cost_usd" gorm:"column:cost_usd"`
	RevenueUSD float64 `json:"revenue_usd" gorm:"column:revenue_usd"`
}

// GetBillingDailyFromSummary aggregates the small pre-computed
// billing_hourly_summaries table down to daily rows. Fast regardless of how
// large the raw logs table has grown, since this table's size only depends
// on (hours × distinct models × distinct channels).
func GetBillingDailyFromSummary(startTimestamp, endTimestamp int64, modelName string, channel int) ([]BillingDailyRow, error) {
	tx := LOG_DB.Table("billing_hourly_summaries").
		Select("(hour_bucket / 86400 * 86400) as day, SUM(cost_usd) as cost_usd, SUM(revenue_usd) as revenue_usd")
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
	err := tx.Group("(hour_bucket / 86400 * 86400)").Order("day asc").Scan(&rows).Error
	return rows, err
}

// GetBillingDailyFromRawLogs aggregates directly from the logs table, for
// filter combinations (token name / username / email) not covered by the
// summary table's grain. Filters directly on logs' own denormalized
// username/token_name columns (both indexed) — same idiom as GetAllLogs,
// no need to resolve names to ids first. Email is resolved to username via
// model.DB (not LOG_DB) first, so this still works when LOG_SQL_DSN points
// LOG_DB at a separate database from the one holding the users table.
func GetBillingDailyFromRawLogs(startTimestamp, endTimestamp int64, modelName string, channel int, tokenName, username, email string) ([]BillingDailyRow, error) {
	tx := LOG_DB.Table("logs").
		Select("(created_at / 86400 * 86400) as day, SUM(accounting_channel_cost_amount_usd) as cost_usd, SUM(accounting_user_final_amount_usd) as revenue_usd").
		Where("accounting_status = ?", "ok")

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
	err := tx.Group("(created_at / 86400 * 86400)").Order("day asc").Scan(&rows).Error
	return rows, err
}
