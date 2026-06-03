package model

type DingTalkAlertCooldownRecord struct {
	ChannelID int   `gorm:"primaryKey"`
	LastAt    int64 `gorm:"not null;default:0"`
	PendingAt int64 `gorm:"not null;default:0"`
}
