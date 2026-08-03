package model

// PublicModelCategory 营销站公开模型目录（按 locale 提供中英双语）。
type PublicModelCategory struct {
	Id          uint   `gorm:"primaryKey" json:"id"`
	Category    string `gorm:"type:varchar(32);not null;index" json:"category"` // chinese/global/image/video/audio/embedding
	Locale      string `gorm:"type:varchar(8);not null;index" json:"locale"`
	Title       string `gorm:"type:varchar(128);not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`
	Models      string `gorm:"type:text" json:"models"` // JSON 数组: [{name,capability_tags,note}]
	Sort        int    `gorm:"default:0" json:"sort"`
	Enabled     bool   `gorm:"default:true" json:"enabled"`
}

func (PublicModelCategory) TableName() string { return "public_model_categories" }
