package model

import (
	"github.com/QuantumNous/new-api/common"
)

// AnalyticsEvent records first-party product/Marketing funnel events
// (visit, signup, pricing_click, lead_submit, ...). Lightweight, no PII beyond
// what the client voluntarily sends; used for conversion analytics (P1-06).
type AnalyticsEvent struct {
	Id       int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Event    string `json:"event" gorm:"type:varchar(32);index"` // visit|signup|pricing_click|lead_submit|...
	Path     string `json:"path" gorm:"type:varchar(512)"`
	Locale   string `json:"locale" gorm:"type:varchar(16)"`
	Referrer string `json:"referrer" gorm:"type:varchar(512)"`
	UserId   int64  `json:"user_id" gorm:"index;default:0"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;index"`
}

// Allowed analytics event names (defense against junk/abuse).
var allowedAnalyticsEvents = map[string]bool{
	"visit":        true,
	"signup":       true,
	"pricing_click": true,
	"lead_submit":  true,
	"page_view":    true,
}

func IsValidAnalyticsEvent(name string) bool {
	return allowedAnalyticsEvents[name]
}

func CreateAnalyticsEvent(event *AnalyticsEvent) error {
	if event.CreatedAt == 0 {
		event.CreatedAt = common.GetTimestamp()
	}
	return DB.Create(event).Error
}
