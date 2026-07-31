package model

// PublicModelCategory 营销站模型能力分类（按 locale 提供双语内容）。
type PublicModelCategory struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	Category    string `json:"category" gorm:"type:varchar(32);not null;index"` // chinese/global/image/video/audio/embedding
	Locale      string `json:"locale" gorm:"type:varchar(8);not null;index"`
	Title       string `json:"title" gorm:"type:varchar(128);not null"`
	Description string `json:"description" gorm:"type:text"`
	Models      string `json:"models" gorm:"type:text"` // JSON 数组: [{name,capability_tags,note}]
	Sort        int    `json:"sort" gorm:"default:0"`
	Enabled     bool   `json:"enabled" gorm:"default:true"`
}

// GetEnabledPublicModelCategories 返回某 locale 下启用且按 sort 升序的模型分类。
func GetEnabledPublicModelCategories(locale string) ([]*PublicModelCategory, error) {
	var categories []*PublicModelCategory
	err := DB.Where("locale = ? AND enabled = ?", locale, true).
		Order("sort ASC").
		Find(&categories).Error
	return categories, err
}
