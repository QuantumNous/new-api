package model

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ChannelDynamicOverride struct {
	ID              int64  `json:"id" gorm:"primaryKey"`
	ChannelID       int    `json:"channel_id" gorm:"not null;uniqueIndex:idx_dynamic_override_target,priority:1;index"`
	Group           string `json:"group" gorm:"type:varchar(64);not null;default:'';uniqueIndex:idx_dynamic_override_target,priority:2;index"`
	Model           string `json:"model" gorm:"type:varchar(255);not null;default:'';uniqueIndex:idx_dynamic_override_target,priority:3;index"`
	Provider        string `json:"provider" gorm:"type:varchar(32);not null;default:'';uniqueIndex:idx_dynamic_override_target,priority:4;index"`
	MonitorID       string `json:"monitor_id" gorm:"type:varchar(128);not null;default:'';uniqueIndex:idx_dynamic_override_target,priority:5"`
	MonitorName     string `json:"monitor_name" gorm:"type:varchar(255);not null;default:''"`
	Source          string `json:"source" gorm:"type:varchar(32);not null;default:'';uniqueIndex:idx_dynamic_override_target,priority:6;index"`
	State           string `json:"state" gorm:"type:varchar(32);not null;default:'';index"`
	BaseEnabled     bool   `json:"base_enabled" gorm:"not null;default:true"`
	BasePriority    *int64 `json:"base_priority" gorm:"bigint"`
	BaseWeight      uint   `json:"base_weight" gorm:"not null;default:0"`
	AppliedEnabled  bool   `json:"applied_enabled" gorm:"not null;default:true"`
	AppliedPriority *int64 `json:"applied_priority" gorm:"bigint"`
	AppliedWeight   uint   `json:"applied_weight" gorm:"not null;default:0"`
	DryRun          bool   `json:"dry_run" gorm:"not null;default:true;index"`
	Active          bool   `json:"active" gorm:"not null;default:true;index"`
	LastReason      string `json:"last_reason" gorm:"type:varchar(512);not null;default:''"`
	UpdatedAt       int64  `json:"updated_at" gorm:"bigint;not null;default:0;index"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint;not null;default:0"`
}

type ChannelDynamicAdjustmentLog struct {
	ID             int64  `json:"id" gorm:"primaryKey"`
	ChannelID      int    `json:"channel_id" gorm:"not null;index"`
	Group          string `json:"group" gorm:"type:varchar(64);not null;default:'';index"`
	Model          string `json:"model" gorm:"type:varchar(255);not null;default:'';index"`
	Provider       string `json:"provider" gorm:"type:varchar(32);not null;default:'';index"`
	Source         string `json:"source" gorm:"type:varchar(32);not null;default:'';index"`
	State          string `json:"state" gorm:"type:varchar(32);not null;default:'';index"`
	Action         string `json:"action" gorm:"type:varchar(64);not null;default:'';index"`
	DryRun         bool   `json:"dry_run" gorm:"not null;default:true;index"`
	Protected      bool   `json:"protected" gorm:"not null;default:false;index"`
	Reason         string `json:"reason" gorm:"type:varchar(512);not null;default:''"`
	BeforeEnabled  bool   `json:"before_enabled" gorm:"not null;default:true"`
	BeforePriority *int64 `json:"before_priority" gorm:"bigint"`
	BeforeWeight   uint   `json:"before_weight" gorm:"not null;default:0"`
	AfterEnabled   bool   `json:"after_enabled" gorm:"not null;default:true"`
	AfterPriority  *int64 `json:"after_priority" gorm:"bigint"`
	AfterWeight    uint   `json:"after_weight" gorm:"not null;default:0"`
	Error          string `json:"error" gorm:"type:varchar(512);not null;default:''"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint;not null;default:0;index"`
}

type ChannelProbeResult struct {
	ID           int64  `json:"id" gorm:"primaryKey"`
	ChannelID    int    `json:"channel_id" gorm:"not null;uniqueIndex:idx_channel_probe_target,priority:1;index"`
	Group        string `json:"group" gorm:"type:varchar(64);not null;default:'';uniqueIndex:idx_channel_probe_target,priority:2;index"`
	Model        string `json:"model" gorm:"type:varchar(255);not null;default:'';uniqueIndex:idx_channel_probe_target,priority:3;index"`
	ProbeType    string `json:"probe_type" gorm:"type:varchar(64);not null;default:'';uniqueIndex:idx_channel_probe_target,priority:4;index"`
	Status       string `json:"status" gorm:"type:varchar(32);not null;default:'';index"`
	Latency      int    `json:"latency" gorm:"not null;default:0"`
	ErrorMessage string `json:"error_message" gorm:"type:varchar(512);not null;default:''"`
	CheckedAt    int64  `json:"checked_at" gorm:"bigint;not null;default:0;index"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;not null;default:0"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint;not null;default:0"`
}

type ChannelDynamicOverrideQuery struct {
	ChannelID int
	Group     string
	Model     string
	Provider  string
	State     string
	Active    *bool
	Page      int
	Limit     int
}

type ChannelDynamicLogQuery struct {
	ChannelID int
	Group     string
	Model     string
	Provider  string
	Action    string
	State     string
	DryRun    *bool
	Protected *bool
	Page      int
	Limit     int
}

type ChannelProbeResultQuery struct {
	ChannelID int
	Group     string
	Model     string
	Status    string
	ProbeType string
	Page      int
	Limit     int
}

func EnsureChannelDynamicAdjustmentTables() error {
	if DB == nil {
		return errors.New("database is not initialized")
	}
	return DB.AutoMigrate(
		&ChannelDynamicOverride{},
		&ChannelDynamicAdjustmentLog{},
		&ChannelProbeResult{},
	)
}

func UpsertChannelDynamicOverride(override ChannelDynamicOverride) error {
	if err := EnsureChannelDynamicAdjustmentTables(); err != nil {
		return err
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "group"},
			{Name: "model"},
			{Name: "provider"},
			{Name: "monitor_id"},
			{Name: "source"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"monitor_name",
			"state",
			"base_enabled",
			"base_priority",
			"base_weight",
			"applied_enabled",
			"applied_priority",
			"applied_weight",
			"dry_run",
			"active",
			"last_reason",
			"updated_at",
		}),
	}).Create(&override).Error
}

func CreateChannelDynamicAdjustmentLog(log ChannelDynamicAdjustmentLog) error {
	if err := EnsureChannelDynamicAdjustmentTables(); err != nil {
		return err
	}
	return DB.Create(&log).Error
}

func UpsertChannelProbeResult(result ChannelProbeResult) error {
	if err := EnsureChannelDynamicAdjustmentTables(); err != nil {
		return err
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "channel_id"},
			{Name: "group"},
			{Name: "model"},
			{Name: "probe_type"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"status",
			"latency",
			"error_message",
			"checked_at",
			"updated_at",
		}),
	}).Create(&result).Error
}

func ListChannelDynamicOverrides(query ChannelDynamicOverrideQuery) ([]ChannelDynamicOverride, int64, error) {
	var records []ChannelDynamicOverride
	db := buildChannelDynamicOverrideQuery(query)
	total, err := countQuery(db)
	if err != nil {
		return records, 0, err
	}
	err = applyPagination(db, query.Page, query.Limit).Order("updated_at desc").Find(&records).Error
	return records, total, err
}

func ListChannelDynamicAdjustmentLogs(query ChannelDynamicLogQuery) ([]ChannelDynamicAdjustmentLog, int64, error) {
	var records []ChannelDynamicAdjustmentLog
	db := buildChannelDynamicLogQuery(query)
	total, err := countQuery(db)
	if err != nil {
		return records, 0, err
	}
	err = applyPagination(db, query.Page, query.Limit).Order("created_at desc").Find(&records).Error
	return records, total, err
}

func ListChannelProbeResults(query ChannelProbeResultQuery) ([]ChannelProbeResult, int64, error) {
	var records []ChannelProbeResult
	db := buildChannelProbeResultQuery(query)
	total, err := countQuery(db)
	if err != nil {
		return records, 0, err
	}
	err = applyPagination(db, query.Page, query.Limit).Order("checked_at desc").Find(&records).Error
	return records, total, err
}

func buildChannelDynamicOverrideQuery(query ChannelDynamicOverrideQuery) *gorm.DB {
	db := DB.Model(&ChannelDynamicOverride{})
	if query.ChannelID > 0 {
		db = db.Where("channel_id = ?", query.ChannelID)
	}
	if query.Group != "" {
		db = db.Where(commonGroupCol+" = ?", query.Group)
	}
	if query.Model != "" {
		db = db.Where("model = ?", query.Model)
	}
	if query.Provider != "" {
		db = db.Where("provider = ?", query.Provider)
	}
	if query.State != "" {
		db = db.Where("state = ?", query.State)
	}
	if query.Active != nil {
		db = db.Where("active = ?", *query.Active)
	}
	return db
}

func buildChannelDynamicLogQuery(query ChannelDynamicLogQuery) *gorm.DB {
	db := DB.Model(&ChannelDynamicAdjustmentLog{})
	if query.ChannelID > 0 {
		db = db.Where("channel_id = ?", query.ChannelID)
	}
	if query.Group != "" {
		db = db.Where(commonGroupCol+" = ?", query.Group)
	}
	if query.Model != "" {
		db = db.Where("model = ?", query.Model)
	}
	if query.Provider != "" {
		db = db.Where("provider = ?", query.Provider)
	}
	if query.Action != "" {
		db = db.Where("action = ?", query.Action)
	}
	if query.State != "" {
		db = db.Where("state = ?", query.State)
	}
	if query.DryRun != nil {
		db = db.Where("dry_run = ?", *query.DryRun)
	}
	if query.Protected != nil {
		db = db.Where("protected = ?", *query.Protected)
	}
	return db
}

func buildChannelProbeResultQuery(query ChannelProbeResultQuery) *gorm.DB {
	db := DB.Model(&ChannelProbeResult{})
	if query.ChannelID > 0 {
		db = db.Where("channel_id = ?", query.ChannelID)
	}
	if query.Group != "" {
		db = db.Where(commonGroupCol+" = ?", query.Group)
	}
	if query.Model != "" {
		db = db.Where("model = ?", query.Model)
	}
	if query.Status != "" {
		db = db.Where("status = ?", query.Status)
	}
	if query.ProbeType != "" {
		db = db.Where("probe_type = ?", query.ProbeType)
	}
	return db
}

func countQuery(db *gorm.DB) (int64, error) {
	var total int64
	err := db.Count(&total).Error
	return total, err
}

func applyPagination(db *gorm.DB, page int, limit int) *gorm.DB {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}
	return db.Offset((page - 1) * limit).Limit(limit)
}
