package model

type RecallTranslationTask struct {
	Id                      int64  `json:"id" gorm:"primaryKey"`
	CampaignId              int64  `json:"campaign_id" gorm:"index;not null"`
	RequestedConfigRevision int64  `json:"requested_config_revision"`
	ResultConfigRevision    int64  `json:"result_config_revision"`
	SourceHash              string `json:"source_hash" gorm:"type:char(64);not null"`
	IdempotencyKey          string `json:"idempotency_key" gorm:"type:char(64);uniqueIndex"`
	Status                  string `json:"status" gorm:"type:varchar(16);index:idx_recall_translation_due,priority:1"`
	AttemptCount            int    `json:"attempt_count"`
	NextAttemptAt           int64  `json:"next_attempt_at" gorm:"index:idx_recall_translation_due,priority:2"`
	LeaseOwner              string `json:"-" gorm:"type:varchar(96)"`
	LeaseExpiresAt          int64  `json:"-" gorm:"index"`
	LeaseEpoch              int64  `json:"-"`
	SourceSnapshot          string `json:"-" gorm:"type:text"`
	ResultSnapshot          string `json:"-" gorm:"type:text"`
	ErrorCode               string `json:"error_code" gorm:"type:varchar(64)"`
	ErrorMessage            string `json:"-" gorm:"type:varchar(512)"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime"`
	StartedAt               int64  `json:"started_at"`
	FinishedAt              int64  `json:"finished_at"`
}
