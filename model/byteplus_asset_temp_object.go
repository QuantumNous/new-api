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

func GetBytePlusAssetTempObjectByAssetID(assetID int64) (*BytePlusAssetTempObject, error) {
	var object BytePlusAssetTempObject
	err := DB.Where("asset_id = ?", assetID).First(&object).Error
	return &object, err
}

func ExtendBytePlusAssetTempObjectSignedURL(id int64, assetID int64, signedURLExpiresAt int64, now int64) (*BytePlusAssetTempObject, error) {
	result := DB.Model(&BytePlusAssetTempObject{}).
		Where("id = ? AND asset_id = ? AND cleanup_status = ? AND cleanup_lease_updated_time = ?", id, assetID, BytePlusTempObjectCleanupPending, int64(0)).
		Updates(map[string]any{
			"signed_url_expires_at": signedURLExpiresAt,
			"next_cleanup_at":       signedURLExpiresAt,
			"updated_time":          now,
		})
	if err := requireOneBytePlusTempObjectCAS(result); err != nil {
		return nil, err
	}
	var object BytePlusAssetTempObject
	err := DB.First(&object, id).Error
	return &object, err
}

func ClaimDueBytePlusTempObjectCleanups(now, staleBefore int64, limit int) ([]BytePlusAssetTempObject, error) {
	if limit <= 0 {
		return nil, nil
	}
	var candidates []BytePlusAssetTempObject
	if err := reclaimableBytePlusTempObjectCleanupScope(DB, now, staleBefore).
		Order("next_cleanup_at ASC, id ASC").
		Limit(limit).
		Find(&candidates).Error; err != nil {
		return nil, err
	}
	claimed := make([]BytePlusAssetTempObject, 0, len(candidates))
	for _, candidate := range candidates {
		result := DB.Model(&BytePlusAssetTempObject{}).
			Where(
				"id = ? AND cleanup_status = ? AND cleanup_lease_updated_time = ? AND ((cleanup_status = ? AND next_cleanup_at <= ? AND (cleanup_lease_updated_time = ? OR cleanup_lease_updated_time < ?)) OR (cleanup_status = ? AND cleanup_lease_updated_time < ?))",
				candidate.Id, candidate.CleanupStatus, candidate.CleanupLeaseUpdatedTime,
				BytePlusTempObjectCleanupPending, now, int64(0), staleBefore,
				BytePlusTempObjectCleanupCleaning, staleBefore,
			).
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

func dueBytePlusTempObjectCleanupScope(db *gorm.DB, now, staleBefore int64) *gorm.DB {
	return db.Where(
		"cleanup_status = ? AND next_cleanup_at <= ? AND (cleanup_lease_updated_time = ? OR cleanup_lease_updated_time < ?)",
		BytePlusTempObjectCleanupPending, now, int64(0), staleBefore,
	)
}

func reclaimableBytePlusTempObjectCleanupScope(db *gorm.DB, now, staleBefore int64) *gorm.DB {
	return dueBytePlusTempObjectCleanupScope(db, now, staleBefore).
		Or("cleanup_status = ? AND cleanup_lease_updated_time < ?", BytePlusTempObjectCleanupCleaning, staleBefore)
}

func ClaimBytePlusAssetTempObjectImmediateCleanup(id int64, now int64) (bool, error) {
	result := DB.Model(&BytePlusAssetTempObject{}).
		Where("id = ? AND asset_id IS NULL AND cleanup_status = ?", id, BytePlusTempObjectCleanupPending).
		Updates(map[string]any{
			"cleanup_status":             BytePlusTempObjectCleanupCleaning,
			"cleanup_lease_updated_time": now,
			"updated_time":               now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

type BytePlusRealPersonBacklogSnapshot struct {
	DeletingCount                       int64
	DeletingOldestUpdateAgeSeconds      int64
	TOSCleanupDueCount                  int64
	TOSCleanupDueOldestUpdateAgeSeconds int64
}

func GetBytePlusRealPersonBacklogSnapshot(now, staleBefore int64) (BytePlusRealPersonBacklogSnapshot, error) {
	var snapshot BytePlusRealPersonBacklogSnapshot
	var deletingOldest *int64
	deletingQuery := DB.Model(&BytePlusAsset{}).
		Where("status = ?", BytePlusAssetStatusDeleting)
	if err := deletingQuery.Count(&snapshot.DeletingCount).Error; err != nil {
		return snapshot, err
	}
	if err := DB.Model(&BytePlusAsset{}).
		Where("status = ?", BytePlusAssetStatusDeleting).
		Select("MIN(updated_time)").
		Scan(&deletingOldest).Error; err != nil {
		return snapshot, err
	}
	if snapshot.DeletingCount > 0 && deletingOldest != nil {
		snapshot.DeletingOldestUpdateAgeSeconds = nonNegativeAge(now, *deletingOldest)
	}
	var tosOldest *int64
	if err := reclaimableBytePlusTempObjectCleanupScope(DB.Model(&BytePlusAssetTempObject{}), now, staleBefore).Count(&snapshot.TOSCleanupDueCount).Error; err != nil {
		return snapshot, err
	}
	if err := reclaimableBytePlusTempObjectCleanupScope(DB.Model(&BytePlusAssetTempObject{}), now, staleBefore).
		Select("MIN(updated_time)").
		Scan(&tosOldest).Error; err != nil {
		return snapshot, err
	}
	if snapshot.TOSCleanupDueCount > 0 && tosOldest != nil {
		snapshot.TOSCleanupDueOldestUpdateAgeSeconds = nonNegativeAge(now, *tosOldest)
	}
	return snapshot, nil
}

func nonNegativeAge(now, then int64) int64 {
	if now <= then {
		return 0
	}
	return now - then
}

func CompleteBytePlusAssetTempObjectCleanup(id int64, leaseUpdatedTime int64, now int64) (bool, error) {
	result := DB.Model(&BytePlusAssetTempObject{}).
		Where("id = ? AND cleanup_status = ? AND cleanup_lease_updated_time = ?",
			id, BytePlusTempObjectCleanupCleaning, leaseUpdatedTime).
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
		Where("id = ? AND cleanup_status = ? AND cleanup_lease_updated_time = ?",
			id, BytePlusTempObjectCleanupCleaning, leaseUpdatedTime).
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
