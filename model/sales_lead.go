package model

// SalesLead 存储营销站「联系销售」表单提交的销售线索。
type SalesLead struct {
	Id             uint   `gorm:"primaryKey" json:"id"`
	Name           string `gorm:"type:varchar(64);not null" json:"name"`
	Email          string `gorm:"type:varchar(128);not null;index" json:"email"`
	Company        string `gorm:"type:varchar(128)" json:"company"`
	Region         string `gorm:"type:varchar(64);not null" json:"region"`
	UseCase        string `gorm:"type:varchar(256);not null" json:"use_case"`
	MonthlyVolume  string `gorm:"type:varchar(64)" json:"monthly_volume"`
	RequiredModels string `gorm:"type:varchar(512)" json:"required_models"`
	Message        string `gorm:"type:text" json:"message"`
	Status         string `gorm:"type:varchar(32);default:'new'" json:"status"`
	Source         string `gorm:"type:varchar(128)" json:"source"`
	CreatedAt      int64  `json:"created_at"`
	UpdatedAt      int64  `json:"updated_at"`
}

func (SalesLead) TableName() string { return "sales_leads" }
