package model

import "gorm.io/gorm/clause"

// Ads Daily report (运营日报 → 广告日报): per-day keyword, creative and
// landing-page detail for the configured Google Ads account, synced cloud-side
// by the app itself (controller/ops_ads_daily_sync.go) — no operator machine.
//
// Two write paths feed the same rows:
//   - metrics upserts: date-segmented GAQL stats (clicks/cost/…) for every day
//     in the sync window; safe to re-upsert because past-day metrics only move
//     forward (conversion lag).
//   - snapshot upserts: the account's *current* attributes (bid, status,
//     creative content, final URLs) written only under today's date with
//     snapshot=true. The Google Ads API exposes no attribute history, so
//     day-over-day change detection works by comparing accumulated daily
//     snapshots; days before the first snapshot show metrics but no changes.
//
// Multi-node (Rule 11): concurrent syncs upsert near-identical rows keyed by
// (date, id); last writer wins on identical data, so no coordination needed.

// AdsDailyKeyword is one keyword-day: metrics for that date plus, on snapshot
// days, the then-current bid and status. Dates are the ads account's timezone.
type AdsDailyKeyword struct {
	Date         string  `json:"date" gorm:"column:date;primaryKey;size:16"`
	AdGroupId    string  `json:"ad_group_id" gorm:"column:ad_group_id;primaryKey;size:32"`
	CriterionId  string  `json:"criterion_id" gorm:"column:criterion_id;primaryKey;size:32"`
	CampaignId   string  `json:"campaign_id" gorm:"column:campaign_id;size:32"`
	CampaignName string  `json:"campaign_name" gorm:"column:campaign_name;size:128"`
	AdGroupName  string  `json:"ad_group_name" gorm:"column:ad_group_name;size:128"`
	Keyword      string  `json:"keyword" gorm:"column:keyword;size:256"`
	MatchType    string  `json:"match_type" gorm:"column:match_type;size:16"`
	Status       string  `json:"status" gorm:"column:status;size:16"` // snapshot days only
	CpcBidUSD    float64 `json:"cpc_bid_usd" gorm:"column:cpc_bid_usd"`
	Snapshot     bool    `json:"snapshot" gorm:"column:snapshot"`
	CostUSD      float64 `json:"cost_usd" gorm:"column:cost_usd"`
	Clicks       int     `json:"clicks" gorm:"column:clicks"`
	Impressions  int     `json:"impressions" gorm:"column:impressions"`
	Conversions  float64 `json:"conversions" gorm:"column:conversions"`
	UpdatedAt    int64   `json:"updated_at" gorm:"column:updated_at"`
}

func (AdsDailyKeyword) TableName() string {
	return "ads_daily_keywords"
}

// AdsDailyCreative is one ad-day: metrics plus, on snapshot days, the
// then-current creative content (RSA text, images, final URLs) as JSON arrays.
type AdsDailyCreative struct {
	Date         string  `json:"date" gorm:"column:date;primaryKey;size:16"`
	AdId         string  `json:"ad_id" gorm:"column:ad_id;primaryKey;size:32"`
	CampaignId   string  `json:"campaign_id" gorm:"column:campaign_id;size:32"`
	CampaignName string  `json:"campaign_name" gorm:"column:campaign_name;size:128"`
	AdGroupId    string  `json:"ad_group_id" gorm:"column:ad_group_id;size:32"`
	AdGroupName  string  `json:"ad_group_name" gorm:"column:ad_group_name;size:128"`
	AdType       string  `json:"ad_type" gorm:"column:ad_type;size:32"`
	Status       string  `json:"status" gorm:"column:status;size:16"` // snapshot days only
	Headlines    string  `json:"headlines" gorm:"column:headlines;type:text"`
	Descriptions string  `json:"descriptions" gorm:"column:descriptions;type:text"`
	ImageUrls    string  `json:"image_urls" gorm:"column:image_urls;type:text"`
	FinalUrls    string  `json:"final_urls" gorm:"column:final_urls;type:text"`
	Path1        string  `json:"path1" gorm:"column:path1;size:32"`
	Path2        string  `json:"path2" gorm:"column:path2;size:32"`
	Snapshot     bool    `json:"snapshot" gorm:"column:snapshot"`
	CostUSD      float64 `json:"cost_usd" gorm:"column:cost_usd"`
	Clicks       int     `json:"clicks" gorm:"column:clicks"`
	Impressions  int     `json:"impressions" gorm:"column:impressions"`
	Conversions  float64 `json:"conversions" gorm:"column:conversions"`
	UpdatedAt    int64   `json:"updated_at" gorm:"column:updated_at"`
}

func (AdsDailyCreative) TableName() string {
	return "ads_daily_creatives"
}

// AdsDailyLanding is one landing-URL-day of metrics from landing_page_view.
// URL is truncated to fit the composite primary key on all three databases.
type AdsDailyLanding struct {
	Date        string  `json:"date" gorm:"column:date;primaryKey;size:16"`
	Url         string  `json:"url" gorm:"column:url;primaryKey;size:500"`
	CostUSD     float64 `json:"cost_usd" gorm:"column:cost_usd"`
	Clicks      int     `json:"clicks" gorm:"column:clicks"`
	Impressions int     `json:"impressions" gorm:"column:impressions"`
	Conversions float64 `json:"conversions" gorm:"column:conversions"`
	UpdatedAt   int64   `json:"updated_at" gorm:"column:updated_at"`
}

func (AdsDailyLanding) TableName() string {
	return "ads_daily_landings"
}

var adsDailyMetricCols = []string{"cost_usd", "clicks", "impressions", "conversions", "updated_at"}

func adsDailyKeywordConflict() clause.OnConflict {
	return clause.OnConflict{
		Columns: []clause.Column{{Name: "date"}, {Name: "ad_group_id"}, {Name: "criterion_id"}},
	}
}

func adsDailyCreativeConflict() clause.OnConflict {
	return clause.OnConflict{
		Columns: []clause.Column{{Name: "date"}, {Name: "ad_id"}},
	}
}

// UpsertAdsDailyKeywordMetrics writes date-segmented keyword stats without
// touching snapshot-owned columns (status, cpc_bid_usd, snapshot).
func UpsertAdsDailyKeywordMetrics(rows []*AdsDailyKeyword) error {
	if len(rows) == 0 {
		return nil
	}
	conflict := adsDailyKeywordConflict()
	conflict.DoUpdates = clause.AssignmentColumns(append([]string{
		"campaign_id", "campaign_name", "ad_group_name", "keyword", "match_type",
	}, adsDailyMetricCols...))
	return DB.Clauses(conflict).CreateInBatches(&rows, 200).Error
}

// UpsertAdsDailyKeywordSnapshot writes today's attribute snapshot without
// touching metric columns (a metrics upsert may already have filled them).
func UpsertAdsDailyKeywordSnapshot(rows []*AdsDailyKeyword) error {
	if len(rows) == 0 {
		return nil
	}
	conflict := adsDailyKeywordConflict()
	conflict.DoUpdates = clause.AssignmentColumns([]string{
		"campaign_id", "campaign_name", "ad_group_name", "keyword", "match_type",
		"status", "cpc_bid_usd", "snapshot", "updated_at",
	})
	return DB.Clauses(conflict).CreateInBatches(&rows, 200).Error
}

// UpsertAdsDailyCreativeMetrics writes date-segmented ad stats without
// touching snapshot-owned columns (content, status, snapshot).
func UpsertAdsDailyCreativeMetrics(rows []*AdsDailyCreative) error {
	if len(rows) == 0 {
		return nil
	}
	conflict := adsDailyCreativeConflict()
	conflict.DoUpdates = clause.AssignmentColumns(append([]string{
		"campaign_id", "campaign_name", "ad_group_id", "ad_group_name", "ad_type",
	}, adsDailyMetricCols...))
	return DB.Clauses(conflict).CreateInBatches(&rows, 200).Error
}

// UpsertAdsDailyCreativeSnapshot writes today's creative content snapshot
// without touching metric columns.
func UpsertAdsDailyCreativeSnapshot(rows []*AdsDailyCreative) error {
	if len(rows) == 0 {
		return nil
	}
	conflict := adsDailyCreativeConflict()
	conflict.DoUpdates = clause.AssignmentColumns([]string{
		"campaign_id", "campaign_name", "ad_group_id", "ad_group_name", "ad_type",
		"status", "headlines", "descriptions", "image_urls", "final_urls",
		"path1", "path2", "snapshot", "updated_at",
	})
	return DB.Clauses(conflict).CreateInBatches(&rows, 200).Error
}

// UpsertAdsDailyLandings inserts or replaces landing-page day rows.
func UpsertAdsDailyLandings(rows []*AdsDailyLanding) error {
	if len(rows) == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "date"}, {Name: "url"}},
		DoUpdates: clause.AssignmentColumns(adsDailyMetricCols),
	}).CreateInBatches(&rows, 200).Error
}

// GetAdsDailyKeywords returns keyword rows for dates >= sinceDate
// (YYYY-MM-DD; lexicographic order equals date order).
func GetAdsDailyKeywords(sinceDate string) ([]*AdsDailyKeyword, error) {
	var rows []*AdsDailyKeyword
	err := DB.Where("date >= ?", sinceDate).Find(&rows).Error
	return rows, err
}

// GetAdsDailyCreatives returns creative rows for dates >= sinceDate.
func GetAdsDailyCreatives(sinceDate string) ([]*AdsDailyCreative, error) {
	var rows []*AdsDailyCreative
	err := DB.Where("date >= ?", sinceDate).Find(&rows).Error
	return rows, err
}

// GetAdsDailyLandings returns landing-page rows for dates >= sinceDate.
func GetAdsDailyLandings(sinceDate string) ([]*AdsDailyLanding, error) {
	var rows []*AdsDailyLanding
	err := DB.Where("date >= ?", sinceDate).Find(&rows).Error
	return rows, err
}

// GetAdsDailyLastUpdated returns the newest updated_at across the keyword
// table (0 when empty), used as the sync freshness marker for the whole
// ads-daily dataset (all three tables are written in the same sync pass).
func GetAdsDailyLastUpdated() (int64, error) {
	var last int64
	err := DB.Model(&AdsDailyKeyword{}).
		Select("COALESCE(MAX(updated_at), 0)").Scan(&last).Error
	return last, err
}
