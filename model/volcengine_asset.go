package model

import (
	"time"

	"gorm.io/gorm"
)

// VolcengineAsset records ownership for logical assets created through a
// shared upstream credential. The provider remains the source of truth for
// media bytes and physical channel copies.
type VolcengineAsset struct {
	LogicalID       string         `json:"logical_id" gorm:"primaryKey;type:varchar(191)"`
	UserID          int            `json:"-" gorm:"index:idx_volcengine_asset_owner_group,priority:1"`
	ChannelID       int            `json:"-" gorm:"index"`
	LogicalGroupID  string         `json:"logical_group_id,omitempty" gorm:"type:varchar(128);index:idx_volcengine_asset_owner_group,priority:2"`
	GroupName       string         `json:"group_name,omitempty" gorm:"type:varchar(200)"`
	AssetGroupID    string         `json:"asset_group_id,omitempty" gorm:"type:varchar(191);index"`
	AssetType       string         `json:"asset_type" gorm:"type:varchar(16)"`
	Name            string         `json:"name" gorm:"type:varchar(64)"`
	Status          string         `json:"status" gorm:"type:varchar(32);index"`
	UpstreamCreated int64          `json:"created_at" gorm:"index"`
	CreatedAt       time.Time      `json:"-"`
	UpdatedAt       time.Time      `json:"-"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
}

// VolcengineAuthSession stores only a digest of the one-time human-verification
// token so it can be scoped to the New-API user without retaining the secret.
type VolcengineAuthSession struct {
	TokenHash string    `json:"-" gorm:"primaryKey;type:char(64)"`
	UserID    int       `json:"-" gorm:"index"`
	ChannelID int       `json:"-"`
	ExpiresAt time.Time `json:"-" gorm:"index"`
	CreatedAt time.Time `json:"-"`
}

// VolcenginePersonGroup records the owner of real-person groups obtained from
// an authenticated session. It prevents one gateway user from attaching media
// to another user's upstream group while all users share a channel key.
type VolcenginePersonGroup struct {
	GroupID   string    `json:"-" gorm:"primaryKey;type:varchar(191)"`
	UserID    int       `json:"-" gorm:"index"`
	ChannelID int       `json:"-"`
	CreatedAt time.Time `json:"-"`
}
