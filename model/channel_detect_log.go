package model

// ChannelDetectLog records each detection run for a channel.
// source='sync' means the result was read from apimaster PG (detection_sync task).
// source='auto' means new-api triggered the detection itself (auto_detect task).
type ChannelDetectLog struct {
	Id         int64  `json:"id"`
	ChannelId  int    `json:"channel_id" gorm:"index;not null"`
	Source     string `json:"source" gorm:"type:varchar(16);not null"`
	Status     string `json:"status" gorm:"type:varchar(32);not null"` // 'pass', 'suspicious', 'notcomplete'
	BaseURL    string `json:"base_url" gorm:"type:text"`
	Model      string `json:"model" gorm:"type:varchar(256)"`
	Note       string `json:"note" gorm:"type:text"`
	DetectTime int64  `json:"detect_time" gorm:"bigint"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime"`
}
