package model

import "gorm.io/gorm/clause"

// AdsSpendDaily holds one row per ads-account day: total paid-ads spend and
// clicks across flatkey-* campaigns (the ads account is shared with other
// business lines, which are excluded). Dates are the ads account's timezone
// (America/New_York), joined to the report's Pacific day buckets by date
// string — a 3-hour edge skew day-level stats can tolerate.
//
// Rows are synced by the app itself from the Google Ads REST API
// (controller/ops_ads_sync.go) — no operator machine involved. Multi-node:
// concurrent syncs upsert identical rows keyed by date, so no coordination is
// needed.
type AdsSpendDaily struct {
	Date        string  `json:"date" gorm:"column:date;primaryKey;size:16"`
	CostUSD     float64 `json:"cost_usd" gorm:"column:cost_usd"`
	Clicks      int     `json:"clicks" gorm:"column:clicks"`
	Impressions int     `json:"impressions" gorm:"column:impressions"`
	Conversions float64 `json:"conversions" gorm:"column:conversions"`
	UpdatedAt   int64   `json:"updated_at" gorm:"column:updated_at"`
}

func (AdsSpendDaily) TableName() string {
	return "ads_spend_daily"
}

// GetOpsAdsSpendDaily returns ads spend rows for dates >= sinceDate
// (YYYY-MM-DD; lexicographic order equals date order).
func GetOpsAdsSpendDaily(sinceDate string) ([]*AdsSpendDaily, error) {
	var rows []*AdsSpendDaily
	err := DB.Where("date >= ?", sinceDate).Find(&rows).Error
	return rows, err
}

// GetOpsAdsSpendLastUpdated returns the newest updated_at across all rows
// (0 when the table is empty), used as the sync freshness marker.
func GetOpsAdsSpendLastUpdated() (int64, error) {
	var last int64
	err := DB.Model(&AdsSpendDaily{}).
		Select("COALESCE(MAX(updated_at), 0)").Scan(&last).Error
	return last, err
}

// UpsertAdsSpendDaily inserts or replaces per-day rows by date primary key.
func UpsertAdsSpendDaily(rows []*AdsSpendDaily) error {
	if len(rows) == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "date"}},
		DoUpdates: clause.AssignmentColumns([]string{"cost_usd", "clicks", "impressions", "conversions", "updated_at"}),
	}).Create(&rows).Error
}
