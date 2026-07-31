package model

const (
	APIIdempotencyStatusReceiving       = "Receiving"
	APIIdempotencyStatusProcessing      = "Processing"
	APIIdempotencyStatusCallingUpstream = "CallingUpstream"
	APIIdempotencyStatusCompleted       = "Completed"
	APIIdempotencyStatusFailed          = "Failed"
	APIIdempotencyStatusOutcomeUnknown  = "OutcomeUnknown"
)

type APIIdempotencyRecord struct {
	Id                    int64  `json:"-"`
	UserId                int    `json:"-" gorm:"uniqueIndex:idx_api_idempotency_user_route_key"`
	Route                 string `json:"-" gorm:"type:varchar(96);uniqueIndex:idx_api_idempotency_user_route_key"`
	KeyHash               string `json:"-" gorm:"type:char(64);uniqueIndex:idx_api_idempotency_user_route_key"`
	RequestHash           string `json:"-" gorm:"type:char(64)"`
	Status                string `json:"-" gorm:"type:varchar(32);index"`
	ResourceType          string `json:"-" gorm:"type:varchar(32)"`
	ResourcePublicId      string `json:"-" gorm:"type:varchar(64);index"`
	ResponseStatus        int    `json:"-"`
	ResponsePayload       string `json:"-" gorm:"type:text"`
	UpstreamCallStartedAt int64  `json:"-" gorm:"bigint"`
	LeaseUpdatedTime      int64  `json:"-" gorm:"bigint;index"`
	ExpiresAt             int64  `json:"-" gorm:"bigint;index"`
	CreatedTime           int64  `json:"-" gorm:"bigint"`
	UpdatedTime           int64  `json:"-" gorm:"bigint"`
}
