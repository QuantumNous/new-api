package model

import "github.com/QuantumNous/new-api/common"

const (
	InvitePromoEventImpression = "invite_popup_impression"
	InvitePromoEventCopy       = "invite_popup_copy"
)

var allowedInvitePromoEvents = map[string]struct{}{
	InvitePromoEventImpression: {},
	InvitePromoEventCopy:       {},
}

type InvitePromoEvent struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"not null;index:idx_invite_promo_events_user_id"`
	Event     string `json:"event" gorm:"type:varchar(64);not null;index:idx_invite_promo_events_event_created_at,priority:1"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;not null;index:idx_invite_promo_events_event_created_at,priority:2"`
}

func (InvitePromoEvent) TableName() string {
	return "invite_promo_events"
}

func IsValidInvitePromoEvent(event string) bool {
	_, ok := allowedInvitePromoEvents[event]
	return ok
}

func RecordInvitePromoEvent(userId int, event string) error {
	if userId <= 0 || !IsValidInvitePromoEvent(event) {
		return nil
	}
	record := InvitePromoEvent{
		UserId:    userId,
		Event:     event,
		CreatedAt: common.GetTimestamp(),
	}
	return DB.Create(&record).Error
}
