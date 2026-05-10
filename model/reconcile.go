package model

import (
	"gorm.io/gorm"
)

// ReconcileHourly is the hourly aggregation of our consumption logs, organised
// by (hour_bucket × channel × model × token_type) so the file produced by the
// export endpoint mirrors the supplier's bill format. The admin downloads this
// file once per month and compares it manually against the supplier's PDF /
// xlsx — the system itself never sees the supplier numbers.
type ReconcileHourly struct {
	Id           int64   `json:"id"            gorm:"primaryKey;autoIncrement"`
	HourBucket   int64   `json:"hour_bucket"   gorm:"index:idx_rh_lookup,priority:1;not null"`
	ChannelId    int     `json:"channel_id"    gorm:"index:idx_rh_lookup,priority:2;not null"`
	ModelName    string  `json:"model_name"    gorm:"index:idx_rh_lookup,priority:3;type:varchar(128);not null"`
	TokenType    string  `json:"token_type"    gorm:"index:idx_rh_lookup,priority:4;type:varchar(16);not null"`
	Tokens       int64   `json:"tokens"        gorm:"not null;default:0"`
	Quota        int64   `json:"quota"         gorm:"not null;default:0"`
	// AmountCny: kept on the struct for PG/MySQL AutoMigrate, but for SQLite
	// the table is created via the hand-rolled ensureReconcileHourlyTableSQLite
	// (model/main.go) — GORM's SQLite driver chokes on the comma inside
	// `decimal(N,M)` both at CREATE and at every subsequent PRAGMA round-trip
	// (`invalid DDL, unbalanced brackets`). SubscriptionPlan.PriceAmount has
	// the same workaround.
	AmountCny    float64 `json:"amount_cny"    gorm:"type:decimal(20,6);not null;default:0"`
	RequestCount int     `json:"request_count" gorm:"not null;default:0"`
	Note         string  `json:"note"          gorm:"type:varchar(255);default:''"`
	AggregatedAt int64   `json:"aggregated_at" gorm:"not null;default:0"`
	Version      int     `json:"version"       gorm:"not null;default:1"`

	// ChannelName is populated at API serialization (gorm:"-" excludes it from
	// the table). Filled by ListReconcileHourlyPaged via batch-lookup against
	// the channels table. Empty string if the channel has been deleted.
	ChannelName string `json:"channel_name" gorm:"-"`
}

func (ReconcileHourly) TableName() string { return "reconcile_hourly" }

// --- aggregator-facing CRUD ---

func DeleteReconcileHourlyByHour(channelId int, hourBucket int64) error {
	return DB.Where("hour_bucket = ? AND channel_id = ?", hourBucket, channelId).
		Delete(&ReconcileHourly{}).Error
}

func InsertReconcileHourlyBatch(rows []*ReconcileHourly) error {
	if len(rows) == 0 {
		return nil
	}
	return DB.CreateInBatches(rows, 200).Error
}

func GetReconcileHourlyAggregateInfo(channelId int, hourBucket int64) (aggregatedAt int64, version int, err error) {
	var row ReconcileHourly
	err = DB.Select("aggregated_at, version").
		Where("hour_bucket = ? AND channel_id = ?", hourBucket, channelId).
		First(&row).Error
	if err == gorm.ErrRecordNotFound {
		return 0, 0, nil
	}
	return row.AggregatedAt, row.Version, err
}

// ListReconcileHourlyForExport returns every aggregated row in [from, to] for
// the given channel, ordered by hour_bucket then model_name then token_type.
// Used solely by the monthly export endpoint (no pagination — caller wants
// the entire month in one xlsx).
func ListReconcileHourlyForExport(channelId int, from, to int64, modelName string) ([]*ReconcileHourly, error) {
	q := buildReconcileQuery(channelId, from, to, modelName)
	var rows []*ReconcileHourly
	if err := q.Order("hour_bucket ASC, model_name ASC, token_type ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

// ListReconcileHourlyPaged is the paginated viewer used by the admin reconcile
// table page. Same filters as the export, plus page / pageSize. channelId == 0
// means "all channels"; otherwise filters by that single channel.
// Sorted hour_bucket DESC so the latest data appears first.
func ListReconcileHourlyPaged(channelId int, from, to int64, modelName string, page, pageSize int) ([]*ReconcileHourly, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	q := buildReconcileQuery(channelId, from, to, modelName)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []*ReconcileHourly
	err := q.Order("hour_bucket DESC, channel_id ASC, model_name ASC, token_type ASC").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	populateChannelNames(rows)
	return rows, total, nil
}

// populateChannelNames batch-looks up channel names for the given rows and
// fills ReconcileHourly.ChannelName. Rows whose channel has been deleted keep
// ChannelName="" (the frontend falls back to displaying just the id).
func populateChannelNames(rows []*ReconcileHourly) {
	if len(rows) == 0 {
		return
	}
	idSet := make(map[int]struct{})
	for _, r := range rows {
		idSet[r.ChannelId] = struct{}{}
	}
	ids := make([]int, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}
	type channelLite struct {
		Id   int
		Name string
	}
	var channels []channelLite
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", ids).Find(&channels).Error; err != nil {
		return
	}
	nameMap := make(map[int]string, len(channels))
	for _, c := range channels {
		nameMap[c.Id] = c.Name
	}
	for _, r := range rows {
		r.ChannelName = nameMap[r.ChannelId]
	}
}

// ReconcileHourlyStat returns aggregate stats for the rows that match the same
// filters as ListReconcileHourlyPaged. Used by the admin reconcile page to
// show a "金额合计" tag matching the current filter — sum is calculated across
// all matching rows, not just the current page.
func ReconcileHourlyStat(channelId int, from, to int64, modelName string) (totalAmountCny float64, err error) {
	q := buildReconcileQuery(channelId, from, to, modelName)
	row := struct{ Sum float64 }{}
	if err = q.Select("COALESCE(SUM(amount_cny), 0) AS sum").Scan(&row).Error; err != nil {
		return 0, err
	}
	return row.Sum, nil
}

// buildReconcileQuery applies the shared filters used by both viewer + export.
func buildReconcileQuery(channelId int, from, to int64, modelName string) *gorm.DB {
	q := DB.Model(&ReconcileHourly{}).
		Where("hour_bucket >= ? AND hour_bucket <= ?", from, to)
	if channelId > 0 {
		q = q.Where("channel_id = ?", channelId)
	}
	if modelName != "" {
		q = q.Where("model_name LIKE ?", "%"+modelName+"%")
	}
	return q
}
