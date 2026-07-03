package model

// MediaStorageStats 媒体存储（OBS）桶用量快照。cron 每 N 分钟调 StorageInfo 写一行，
// admin 后台读最新快照 + 7 天趋势（设计 §5.7 / §12.6）。字段仅用基础类型，
// GORM AutoMigrate 兼容 SQLite / MySQL / PostgreSQL。
type MediaStorageStats struct {
	Id             int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	SnapshotAt     int64  `json:"snapshot_at" gorm:"index"`
	TotalBytes     int64  `json:"total_bytes"`
	TotalObjects   int64  `json:"total_objects"`
	Growth24hBytes int64  `json:"growth_24h_bytes" gorm:"default:0"`
	AlertLevel     string `json:"alert_level" gorm:"type:varchar(16);default:'ok'"` // ok / warn / critical
}

func (MediaStorageStats) TableName() string {
	return "media_storage_stats"
}

func (s *MediaStorageStats) Insert() error {
	return DB.Create(s).Error
}

// GetLatestMediaStorageStats 返回最新一条快照（无数据返回 nil, nil）。
func GetLatestMediaStorageStats() (*MediaStorageStats, error) {
	var s MediaStorageStats
	err := DB.Order("snapshot_at desc").First(&s).Error
	exist, err := RecordExist(err)
	if err != nil {
		return nil, err
	}
	if !exist {
		return nil, nil
	}
	return &s, nil
}

// GetMediaStorageStatsSince 返回 sinceUnix 之后的快照，按时间升序（用于趋势图）。
func GetMediaStorageStatsSince(sinceUnix int64) ([]*MediaStorageStats, error) {
	var list []*MediaStorageStats
	err := DB.Where("snapshot_at >= ?", sinceUnix).
		Order("snapshot_at asc").
		Find(&list).Error
	if err != nil {
		return nil, err
	}
	return list, nil
}

// GetMediaStorageBytesAt 返回 <= atUnix 的最近一条快照的 total_bytes，用于算增量。
// 没有更早快照时返回 (0, false, nil)。
func GetMediaStorageBytesAt(atUnix int64) (int64, bool, error) {
	var s MediaStorageStats
	err := DB.Where("snapshot_at <= ?", atUnix).
		Order("snapshot_at desc").First(&s).Error
	exist, err := RecordExist(err)
	if err != nil {
		return 0, false, err
	}
	if !exist {
		return 0, false, nil
	}
	return s.TotalBytes, true, nil
}

// GetLatestMediaStorageAlert 返回最近一条指定告警等级的快照（供 admin 展示「最近告警」）。
func GetLatestMediaStorageAlert(level string) (*MediaStorageStats, error) {
	var s MediaStorageStats
	err := DB.Where("alert_level = ?", level).
		Order("snapshot_at desc").First(&s).Error
	exist, err := RecordExist(err)
	if err != nil {
		return nil, err
	}
	if !exist {
		return nil, nil
	}
	return &s, nil
}

// GetPreviousMediaStorageAlert 返回「当前快照之前」最近一条同等级告警（id < beforeId），
// 供告警去重使用——排除刚插入的当前行，否则永远命中自己导致去重失效。
func GetPreviousMediaStorageAlert(level string, beforeId int64) (*MediaStorageStats, error) {
	var s MediaStorageStats
	err := DB.Where("alert_level = ? AND id < ?", level, beforeId).
		Order("id desc").First(&s).Error
	exist, err := RecordExist(err)
	if err != nil {
		return nil, err
	}
	if !exist {
		return nil, nil
	}
	return &s, nil
}
