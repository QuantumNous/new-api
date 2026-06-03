package model

type DingTalkAlertCooldownRecord struct {
	ChannelID int   `gorm:"primaryKey"`
	LastAt    int64 `gorm:"not null"`
}
