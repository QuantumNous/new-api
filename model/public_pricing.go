package model

// PublicPricing 营销站公开定价方案（按 locale 提供中英双语）。
type PublicPricing struct {
	Id          uint   `gorm:"primaryKey" json:"id"`
	PlanKey     string `gorm:"type:varchar(32);not null;index" json:"plan_key"`
	Locale      string `gorm:"type:varchar(8);not null;index" json:"locale"`
	Title       string `gorm:"type:varchar(128);not null" json:"title"`
	Description string `gorm:"type:text" json:"description"`
	BillingMode string `gorm:"type:varchar(32)" json:"billing_mode"` // payg/subscription/custom
	PriceText   string `gorm:"type:varchar(128)" json:"price_text"`
	Features    string `gorm:"type:text" json:"features"` // JSON 数组字符串
	Sort        int    `gorm:"default:0" json:"sort"`
	Enabled     bool   `gorm:"default:true" json:"enabled"`
}

func (PublicPricing) TableName() string { return "public_pricings" }
