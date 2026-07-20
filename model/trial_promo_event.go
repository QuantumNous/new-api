package model

import "github.com/QuantumNous/new-api/common"

const TrialPromoEventKeyCreated = "trial_key_created"

type TrialPromoEvent struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"not null;index:idx_trial_promo_events_user_id"`
	Event     string `json:"event" gorm:"type:varchar(64);not null;index:idx_trial_promo_events_event_created_at,priority:1"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;not null;index:idx_trial_promo_events_event_created_at,priority:2"`
}

func (TrialPromoEvent) TableName() string {
	return "trial_promo_events"
}

func RecordTrialPromoEvent(userId int, event string) error {
	if userId <= 0 || event != TrialPromoEventKeyCreated {
		return nil
	}
	return DB.Create(&TrialPromoEvent{
		UserId:    userId,
		Event:     event,
		CreatedAt: common.GetTimestamp(),
	}).Error
}
