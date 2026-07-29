package model

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	BytePlusAssetGroupStatusCreating = "Creating"
	BytePlusAssetGroupStatusActive   = "Active"
	BytePlusAssetGroupStatusFailed   = "Failed"

	BytePlusAssetStatusCreating   = "Creating"
	BytePlusAssetStatusProcessing = "Processing"
	BytePlusAssetStatusActive     = "Active"
	BytePlusAssetStatusFailed     = "Failed"
)

type BytePlusAssetGroup struct {
	Id                int64  `json:"id"`
	UserId            int    `json:"user_id" gorm:"uniqueIndex:idx_byteplus_asset_group_user_channel;index"`
	ChannelId         int    `json:"channel_id" gorm:"uniqueIndex:idx_byteplus_asset_group_user_channel;index"`
	UpstreamGroupId   string `json:"-" gorm:"type:varchar(128)"`
	UpstreamRequestId string `json:"-" gorm:"type:varchar(128)"`
	Status            string `json:"status" gorm:"type:varchar(32);index"`
	ErrorMessage      string `json:"-" gorm:"type:text"`
	LeaseUpdatedTime  int64  `json:"-" gorm:"bigint;index"`
	CreatedTime       int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime       int64  `json:"updated_time" gorm:"bigint"`
}

type BytePlusAsset struct {
	Id                 int64  `json:"id"`
	PublicId           string `json:"public_id" gorm:"type:varchar(64);uniqueIndex;index:idx_byteplus_asset_user_public"`
	UserId             int    `json:"user_id" gorm:"index:idx_byteplus_asset_user_public;index"`
	AssetGroupId       int64  `json:"-" gorm:"index"`
	ChannelId          int    `json:"-" gorm:"index"`
	UpstreamAssetId    string `json:"-" gorm:"type:varchar(128);index"`
	UpstreamRequestId  string `json:"-" gorm:"type:varchar(128)"`
	AssetType          string `json:"asset_type" gorm:"type:varchar(32)"`
	SourceURL          string `json:"-" gorm:"type:text"`
	ModerationStrategy string `json:"moderation_strategy" gorm:"type:varchar(32)"`
	Status             string `json:"status" gorm:"type:varchar(32);index"`
	ErrorMessage       string `json:"-" gorm:"type:text"`
	CreatedTime        int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime        int64  `json:"updated_time" gorm:"bigint"`
}

func ClaimBytePlusAssetGroup(userID int, channelID int, now int64, staleBefore int64) (*BytePlusAssetGroup, bool, error) {
	group := &BytePlusAssetGroup{
		UserId:           userID,
		ChannelId:        channelID,
		Status:           BytePlusAssetGroupStatusCreating,
		LeaseUpdatedTime: now,
		CreatedTime:      now,
		UpdatedTime:      now,
	}
	insert := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(group)
	if insert.Error != nil {
		return nil, false, insert.Error
	}
	if insert.RowsAffected == 1 {
		return group, true, nil
	}

	update := DB.Model(&BytePlusAssetGroup{}).
		Where("user_id = ? AND channel_id = ? AND (status = ? OR (status = ? AND lease_updated_time < ?))",
			userID,
			channelID,
			BytePlusAssetGroupStatusFailed,
			BytePlusAssetGroupStatusCreating,
			staleBefore,
		).
		Updates(map[string]any{
			"status":              BytePlusAssetGroupStatusCreating,
			"error_message":       "",
			"upstream_group_id":   "",
			"upstream_request_id": "",
			"lease_updated_time":  now,
			"updated_time":        now,
		})
	if update.Error != nil {
		return nil, false, update.Error
	}

	var stored BytePlusAssetGroup
	if err := DB.Where("user_id = ? AND channel_id = ?", userID, channelID).First(&stored).Error; err != nil {
		return nil, false, err
	}
	return &stored, update.RowsAffected == 1, nil
}

func ActivateBytePlusAssetGroup(groupID int64, leaseUpdatedTime int64, upstreamGroupID string, upstreamRequestID string, now int64) (bool, error) {
	result := DB.Model(&BytePlusAssetGroup{}).
		Where("id = ? AND status = ? AND lease_updated_time = ?", groupID, BytePlusAssetGroupStatusCreating, leaseUpdatedTime).
		Updates(map[string]any{
			"upstream_group_id":   upstreamGroupID,
			"upstream_request_id": upstreamRequestID,
			"status":              BytePlusAssetGroupStatusActive,
			"error_message":       "",
			"updated_time":        now,
		})
	return result.RowsAffected == 1, result.Error
}

func FailBytePlusAssetGroup(groupID int64, leaseUpdatedTime int64, upstreamRequestID string, errorMessage string, now int64) (bool, error) {
	result := DB.Model(&BytePlusAssetGroup{}).
		Where("id = ? AND status = ? AND lease_updated_time = ?", groupID, BytePlusAssetGroupStatusCreating, leaseUpdatedTime).
		Updates(map[string]any{
			"upstream_request_id": upstreamRequestID,
			"status":              BytePlusAssetGroupStatusFailed,
			"error_message":       errorMessage,
			"updated_time":        now,
		})
	return result.RowsAffected == 1, result.Error
}

func CreateBytePlusAsset(asset BytePlusAsset) (*BytePlusAsset, error) {
	if err := DB.Create(&asset).Error; err != nil {
		return nil, err
	}
	return &asset, nil
}

func GetBytePlusAssetByPublicIDForUser(userID int, publicID string) (*BytePlusAsset, error) {
	var asset BytePlusAsset
	if err := DB.Where("user_id = ? AND public_id = ?", userID, publicID).First(&asset).Error; err != nil {
		return nil, err
	}
	return &asset, nil
}

func GetBytePlusAssetsByPublicIDsForUser(userID int, publicIDs []string) ([]BytePlusAsset, error) {
	if len(publicIDs) == 0 {
		return nil, nil
	}
	unique := make([]string, 0, len(publicIDs))
	seen := make(map[string]struct{}, len(publicIDs))
	for _, id := range publicIDs {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	var assets []BytePlusAsset
	err := DB.Where("user_id = ? AND public_id IN ?", userID, unique).Find(&assets).Error
	return assets, err
}

func UpdateBytePlusAssetUpstreamCreated(assetID int64, upstreamAssetID string, upstreamRequestID string, status string, now int64) error {
	return DB.Model(&BytePlusAsset{}).
		Where("id = ?", assetID).
		Updates(map[string]any{
			"upstream_asset_id":   upstreamAssetID,
			"upstream_request_id": upstreamRequestID,
			"status":              status,
			"error_message":       "",
			"updated_time":        now,
		}).Error
}

func UpdateBytePlusAssetStatus(assetID int64, status string, errorMessage string, now int64) error {
	return DB.Model(&BytePlusAsset{}).
		Where("id = ?", assetID).
		Updates(map[string]any{
			"status":        status,
			"error_message": errorMessage,
			"updated_time":  now,
		}).Error
}

func IsBytePlusAssetNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}
