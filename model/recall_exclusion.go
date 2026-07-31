package model

type RecallExclusionBatch struct {
	Id                      int64  `json:"id" gorm:"primaryKey"`
	CampaignId              int64  `json:"campaign_id" gorm:"index;not null"`
	Status                  string `json:"status" gorm:"type:varchar(16);not null;index"`
	FileSHA256              string `json:"file_sha256" gorm:"type:char(64);not null;index"`
	TotalRows               int64  `json:"total_rows"`
	ResolvedUsers           int64  `json:"resolved_users"`
	DuplicateRows           int64  `json:"duplicate_rows"`
	UnresolvedRows          int64  `json:"unresolved_rows"`
	ConflictRows            int64  `json:"conflict_rows"`
	CancelledMessages       int64  `json:"cancelled_messages"`
	ResolvedUserIDsSnapshot []byte `json:"-"`
	UploadedBy              int    `json:"uploaded_by"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime"`
	AppliedAt               int64  `json:"applied_at"`
}

type RecallCampaignExclusion struct {
	Id                   int64  `json:"id" gorm:"primaryKey"`
	CampaignId           int64  `json:"campaign_id" gorm:"uniqueIndex:idx_recall_exclusion_campaign_identity,priority:1;index"`
	RecipientIdentity    string `json:"recipient_identity" gorm:"type:varchar(96);uniqueIndex:idx_recall_exclusion_campaign_identity,priority:2"`
	UserId               int    `json:"user_id" gorm:"index"`
	Persistent           bool   `json:"persistent" gorm:"index"`
	PersistentReasonCode string `json:"persistent_reason_code" gorm:"type:varchar(64)"`
	LastRunReasonCode    string `json:"last_run_reason_code" gorm:"type:varchar(64)"`
	SourceBatchId        int64  `json:"source_batch_id" gorm:"index"`
	FirstRunEventId      int64  `json:"first_run_event_id" gorm:"index"`
	LastRunEventId       int64  `json:"last_run_event_id" gorm:"index"`
	FirstSeenAt          int64  `json:"first_seen_at"`
	LastSeenAt           int64  `json:"last_seen_at" gorm:"index"`
	CreatedBy            int    `json:"created_by"`
}
