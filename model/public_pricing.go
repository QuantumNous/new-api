package model

// PublicPricing 营销站定价方案（按 locale 提供双语内容）。
type PublicPricing struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	PlanKey     string `json:"plan_key" gorm:"type:varchar(32);not null;index"`
	Locale      string `json:"locale" gorm:"type:varchar(8);not null;index"`
	Title       string `json:"title" gorm:"type:varchar(128);not null"`
	Description string `json:"description" gorm:"type:text"`
	BillingMode string `json:"billing_mode" gorm:"type:varchar(32)"` // payg/subscription/custom
	PriceText   string `json:"price_text" gorm:"type:varchar(128)"`
	Features    string `json:"features" gorm:"type:text"` // JSON 数组字符串
	Sort        int    `json:"sort" gorm:"default:0"`
	Enabled     bool   `json:"enabled" gorm:"default:true"`
}

// GetEnabledPublicPricings 返回某 locale 下启用且按 sort 升序的定价方案。
func GetEnabledPublicPricings(locale string) ([]*PublicPricing, error) {
	var pricings []*PublicPricing
	err := DB.Where("locale = ? AND enabled = ?", locale, true).
		Order("sort ASC").
		Find(&pricings).Error
	return pricings, err
}
