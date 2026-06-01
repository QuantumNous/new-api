package model

// ChannelDetectLog records each detection run for a channel.
// source='sync' means the result was read from apimaster PG (detection_sync task).
// source='auto' means new-api triggered the detection itself (auto_detect task).
type ChannelDetectLog struct {
	Id             int64   `json:"id"`
	ChannelId      int     `json:"channel_id" gorm:"index;not null"`
	Source         string  `json:"source" gorm:"type:varchar(16);not null"`
	Status         string  `json:"status" gorm:"type:varchar(32);not null"` // 'pass', 'suspicious', 'notcomplete'
	BaseURL        string  `json:"base_url" gorm:"type:text"`
	GroupName      string  `json:"group_name" gorm:"type:varchar(64)"`       // channel group at time of detection
	ClaimedModel   string  `json:"claimed_model" gorm:"type:varchar(256)"`   // what channel claims to serve
	PredictedModel string  `json:"predicted_model" gorm:"type:varchar(256)"` // fingerprint top-1 result
	Top1Score      float64 `json:"top1_score" gorm:"type:double precision"`
	Top5Json                string  `json:"top5_json" gorm:"type:text"` // JSON array of {label,score,rank}; from apimaster detections.top5
	FingerprintModelVersion string  `json:"fingerprint_model_version" gorm:"type:varchar(128)"` // e.g. apimaster_fingerprint_cccli_v0.1
	LatencyMeanMs           float64 `json:"latency_mean_ms" gorm:"type:double precision"`
	Note                    string  `json:"note" gorm:"type:text"` // notcomplete_reason or error
	DetectTime     int64   `json:"detect_time" gorm:"bigint"`
	CreatedAt      int64   `json:"created_at" gorm:"autoCreateTime"`
}
