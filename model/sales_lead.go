package model

import (
	"time"
)

// SalesLead 销售线索（营销站“联系销售”表单提交后写入）。
type SalesLead struct {
	Id            int    `json:"id" gorm:"primaryKey"`
	Name          string `json:"name" gorm:"type:varchar(64);not null"`
	Email         string `json:"email" gorm:"type:varchar(128);not null;index"`
	Company       string `json:"company" gorm:"type:varchar(128)"`
	Region        string `json:"region" gorm:"type:varchar(64);not null"`
	UseCase       string `json:"use_case" gorm:"type:varchar(256);not null"`
	MonthlyVolume string `json:"monthly_volume" gorm:"type:varchar(64)"`
	RequiredModels string `json:"required_models" gorm:"type:varchar(512)"`
	Message       string `json:"message" gorm:"type:text"`
	Status        string `json:"status" gorm:"type:varchar(32);default:'new'"`
	Source        string `json:"source" gorm:"type:varchar(128)"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`
}

// CreateSalesLead 写入一条销售线索，由 service 层负责填充时间戳与默认状态。
func CreateSalesLead(lead *SalesLead) error {
	now := time.Now().Unix()
	lead.CreatedAt = now
	lead.UpdatedAt = now
	if lead.Status == "" {
		lead.Status = "new"
	}
	return DB.Create(lead).Error
}

// AllowedSalesLeadStatuses 销售线索状态流转白名单。
var AllowedSalesLeadStatuses = map[string]bool{
	"new":      true,
	"contacted": true,
	"qualified": true,
	"won":      true,
	"lost":     true,
}

// GetSalesLeads 列出销售线索，status 为空时返回全部（按创建时间倒序）。
func GetSalesLeads(status string) ([]*SalesLead, error) {
	var leads []*SalesLead
	q := DB.Order("created_at DESC")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	err := q.Find(&leads).Error
	return leads, err
}

// GetSalesLeadById 按 id 获取单条线索。
func GetSalesLeadById(id int64) (*SalesLead, error) {
	var lead SalesLead
	err := DB.Where("id = ?", id).First(&lead).Error
	if err != nil {
		return nil, err
	}
	return &lead, nil
}

// UpdateSalesLeadStatus 更新线索状态与备注（管理员操作）。
func UpdateSalesLeadStatus(id int64, status, note string) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now().Unix(),
	}
	if note != "" {
		updates["message"] = note
	}
	return DB.Model(&SalesLead{}).Where("id = ?", id).Updates(updates).Error
}
