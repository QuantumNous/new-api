package model

import (
	"strings"

	"gorm.io/gorm"
)

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
	Bucket                  string `json:"-" gorm:"type:varchar(255);uniqueIndex:idx_byteplus_temp_bucket_key"`
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

func CreateBytePlusAssetTempObject(object BytePlusAssetTempObject) (*BytePlusAssetTempObject, error) {
	object.Bucket = strings.TrimSpace(object.Bucket)
	object.ObjectKey = strings.TrimSpace(object.ObjectKey)
	if err := DB.Create(&object).Error; err != nil {
		return nil, err
	}
	return &object, nil
}

func UpdateBytePlusAssetTempObjectMetadata(id int64, sha256Hex string, size int64, mimeType string, now int64) error {
	result := DB.Model(&BytePlusAssetTempObject{}).
		Where("id = ? AND asset_id IS NULL AND cleanup_status = ?", id, BytePlusTempObjectCleanupPending).
		Updates(map[string]any{
			"content_sha256":             strings.TrimSpace(sha256Hex),
			"size_bytes":                 size,
			"mime_type":                  strings.TrimSpace(mimeType),
			"cleanup_lease_updated_time": now,
			"updated_time":               now,
		})
	return requireOneBytePlusTempObjectCAS(result)
}

func BindBytePlusAssetTempObject(id int64, assetID int64, signedURLExpiresAt int64, now int64) (bool, error) {
	result := DB.Model(&BytePlusAssetTempObject{}).
		Where("id = ? AND asset_id IS NULL AND cleanup_status = ?", id, BytePlusTempObjectCleanupPending).
		Updates(map[string]any{
			"asset_id":                   assetID,
			"signed_url_expires_at":      signedURLExpiresAt,
			"next_cleanup_at":            signedURLExpiresAt,
			"cleanup_lease_updated_time": int64(0),
			"updated_time":               now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ClaimDueBytePlusTempObjectCleanups(now, staleBefore int64, limit int) ([]BytePlusAssetTempObject, error) {
	if limit <= 0 {
		return nil, nil
	}
	var candidates []BytePlusAssetTempObject
	if err := DB.Where("cleanup_status = ? AND next_cleanup_at <= ? AND (cleanup_lease_updated_time = ? OR cleanup_lease_updated_time < ?)",
		BytePlusTempObjectCleanupPending, now, int64(0), staleBefore).
		Order("next_cleanup_at ASC, id ASC").
		Limit(limit).
		Find(&candidates).Error; err != nil {
		return nil, err
	}
	claimed := make([]BytePlusAssetTempObject, 0, len(candidates))
	for _, candidate := range candidates {
		result := DB.Model(&BytePlusAssetTempObject{}).
			Where("id = ? AND cleanup_status = ? AND next_cleanup_at <= ? AND (cleanup_lease_updated_time = ? OR cleanup_lease_updated_time < ?)",
				candidate.Id, BytePlusTempObjectCleanupPending, now, int64(0), staleBefore).
			Updates(map[string]any{
				"cleanup_status":             BytePlusTempObjectCleanupCleaning,
				"cleanup_lease_updated_time": now,
				"updated_time":               now,
			})
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected != 1 {
			continue
		}
		candidate.CleanupStatus = BytePlusTempObjectCleanupCleaning
		candidate.CleanupLeaseUpdatedTime = now
		candidate.UpdatedTime = now
		claimed = append(claimed, candidate)
	}
	return claimed, nil
}

func CompleteBytePlusAssetTempObjectCleanup(id int64, leaseUpdatedTime int64, now int64) (bool, error) {
	result := DB.Model(&BytePlusAssetTempObject{}).
		Where("id = ? AND cleanup_status IN ? AND cleanup_lease_updated_time = ?",
			id, []string{BytePlusTempObjectCleanupPending, BytePlusTempObjectCleanupCleaning}, leaseUpdatedTime).
		Updates(map[string]any{
			"cleanup_status":             BytePlusTempObjectCleanupCleaned,
			"cleaned_time":               now,
			"cleanup_lease_updated_time": int64(0),
			"updated_time":               now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func RetryBytePlusAssetTempObjectCleanup(id int64, leaseUpdatedTime int64, nextAttempt int64, now int64) (bool, error) {
	result := DB.Model(&BytePlusAssetTempObject{}).
		Where("id = ? AND cleanup_status IN ? AND cleanup_lease_updated_time = ?",
			id, []string{BytePlusTempObjectCleanupPending, BytePlusTempObjectCleanupCleaning}, leaseUpdatedTime).
		Updates(map[string]any{
			"cleanup_status":             BytePlusTempObjectCleanupPending,
			"cleanup_attempts":           gorm.Expr("cleanup_attempts + ?", 1),
			"next_cleanup_at":            nextAttempt,
			"cleanup_lease_updated_time": int64(0),
			"updated_time":               now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func requireOneBytePlusTempObjectCAS(result *gorm.DB) error {
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrAPIIdempotencyCASLost
	}
	return nil
}
