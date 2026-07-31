package model

const (
	BytePlusRealPersonProfileStatusPendingVerification = "PendingVerification"
	BytePlusRealPersonProfileStatusVerifying           = "Verifying"
	BytePlusRealPersonProfileStatusActive              = "Active"
	BytePlusRealPersonProfileStatusFailed              = "Failed"
	BytePlusRealPersonProfileStatusExpired             = "Expired"
	BytePlusVisualValidationSessionStatusCreating      = "Creating"
	BytePlusVisualValidationSessionStatusPending       = "Pending"
	BytePlusVisualValidationSessionStatusChecking      = "Checking"
	BytePlusVisualValidationSessionStatusSucceeded     = "Succeeded"
	BytePlusVisualValidationSessionStatusFailed        = "Failed"
	BytePlusVisualValidationSessionStatusExpired       = "Expired"
)

type BytePlusRealPersonProfile struct {
	Id                         int64   `json:"id"`
	PublicId                   string  `json:"public_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId                     int     `json:"user_id" gorm:"index"`
	Name                       string  `json:"name" gorm:"type:varchar(128)"`
	ChannelId                  int     `json:"-" gorm:"index;uniqueIndex:idx_byteplus_real_person_channel_group"`
	UpstreamGroupId            *string `json:"-" gorm:"type:varchar(128);uniqueIndex:idx_byteplus_real_person_channel_group"`
	CurrentValidationSessionId *int64  `json:"-" gorm:"index"`
	Status                     string  `json:"status" gorm:"type:varchar(32);index"`
	ErrorCode                  string  `json:"-" gorm:"type:varchar(64)"`
	CreatedTime                int64   `json:"created_time" gorm:"bigint;index"`
	UpdatedTime                int64   `json:"updated_time" gorm:"bigint"`
}

type BytePlusVisualValidationSession struct {
	Id                      int64  `json:"id"`
	PublicId                string `json:"-" gorm:"type:varchar(64);uniqueIndex"`
	ProfileId               int64  `json:"-" gorm:"index"`
	CallbackTokenHash       string `json:"-" gorm:"type:char(64);uniqueIndex"`
	CallbackTokenCiphertext string `json:"-" gorm:"type:text"`
	BytedTokenCiphertext    string `json:"-" gorm:"type:text"`
	H5LinkCiphertext        string `json:"-" gorm:"type:text"`
	Status                  string `json:"-" gorm:"type:varchar(32);index"`
	ExpiresAt               int64  `json:"-" gorm:"bigint;index"`
	UpstreamRequestId       string `json:"-" gorm:"type:varchar(128)"`
	LeaseUpdatedTime        int64  `json:"-" gorm:"bigint;index"`
	CreatedTime             int64  `json:"-" gorm:"bigint"`
	UpdatedTime             int64  `json:"-" gorm:"bigint"`
}
