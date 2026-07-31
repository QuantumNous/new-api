package model

const (
	BytePlusTempObjectCleanupPending  = "Pending"
	BytePlusTempObjectCleanupCleaning = "Cleaning"
	BytePlusTempObjectCleanupCleaned  = "Cleaned"
)

type BytePlusAssetTempObject struct {
	Id                      int64  `json:"-"`
	AssetId                 *int64 `json:"-" gorm:"uniqueIndex"`
	UserId                  int    `json:"-" gorm:"index"`
	ChannelId               int    `json:"-" gorm:"index"`
	Bucket                  string `json:"-" gorm:"type:varchar(255)"`
	ObjectKey               string `json:"-" gorm:"type:varchar(512);uniqueIndex:idx_byteplus_temp_bucket_key"`
	ContentSHA256           string `json:"-" gorm:"type:char(64)"`
	SizeBytes               int64  `json:"-" gorm:"bigint"`
	MimeType                string `json:"-" gorm:"type:varchar(128)"`
	SignedURLExpiresAt      int64  `json:"-" gorm:"bigint"`
	CleanupStatus           string `json:"-" gorm:"type:varchar(32);index"`
	CleanupAttempts         int    `json:"-"`
	NextCleanupAt           int64  `json:"-" gorm:"bigint;index"`
	CleanupLeaseUpdatedTime int64  `json:"-" gorm:"bigint;index"`
	CleanedTime             int64  `json:"-" gorm:"bigint"`
	CreatedTime             int64  `json:"-" gorm:"bigint"`
	UpdatedTime             int64  `json:"-" gorm:"bigint"`
}
