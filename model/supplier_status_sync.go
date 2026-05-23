package model

import (
	"errors"

	"gorm.io/gorm/clause"
)

// SupplierStatusSync stores normalized upstream provider status samples.
type SupplierStatusSync struct {
	ID           int64   `json:"id" gorm:"primaryKey"`
	Provider     string  `json:"provider" gorm:"type:varchar(32);not null;uniqueIndex:idx_supplier_status_point,priority:1;index:idx_supplier_status_recent,priority:1"`
	DisplayName  string  `json:"display_name" gorm:"type:varchar(64);not null;default:''"`
	GroupName    string  `json:"group_name" gorm:"type:varchar(128);not null;default:'';index:idx_supplier_status_group_model,priority:1"`
	MonitorID    string  `json:"monitor_id" gorm:"type:varchar(128);not null;uniqueIndex:idx_supplier_status_point,priority:2"`
	MonitorName  string  `json:"monitor_name" gorm:"type:varchar(255);not null;default:''"`
	ModelName    string  `json:"model_name" gorm:"type:varchar(255);not null;default:'';index:idx_supplier_status_group_model,priority:2"`
	Status       int     `json:"status" gorm:"not null;default:0"`
	Availability float64 `json:"availability" gorm:"not null;default:0"`
	Latency      int     `json:"latency" gorm:"not null;default:0"`
	Message      string  `json:"message" gorm:"type:varchar(512);not null;default:''"`
	Raw          string  `json:"raw" gorm:"type:text"`
	CheckedAt    int64   `json:"checked_at" gorm:"bigint;not null;uniqueIndex:idx_supplier_status_point,priority:3;index:idx_supplier_status_recent,priority:2"`
	CreatedAt    int64   `json:"created_at" gorm:"bigint;not null;default:0"`
}

func BatchUpsertSupplierStatusSync(records []SupplierStatusSync) error {
	if len(records) == 0 {
		return nil
	}
	if DB == nil {
		return errors.New("database is not initialized")
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "provider"},
			{Name: "monitor_id"},
			{Name: "checked_at"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"display_name",
			"group_name",
			"monitor_name",
			"model_name",
			"status",
			"availability",
			"latency",
			"message",
			"raw",
		}),
	}).Create(&records).Error
}

func GetRecentSupplierStatusSync(since int64) ([]SupplierStatusSync, error) {
	var records []SupplierStatusSync
	if DB == nil {
		return records, errors.New("database is not initialized")
	}
	err := DB.
		Where("checked_at >= ?", since).
		Order("provider asc").
		Order("group_name asc").
		Order("model_name asc").
		Order("checked_at asc").
		Find(&records).Error
	return records, err
}
