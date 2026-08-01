package model

import (
	"errors"
	"fmt"
	"strings"

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
	BytePlusAssetStatusDeleting   = "Deleting"
	BytePlusAssetStatusDeleted    = "Deleted"
)

const bytePlusAssetStatusCheckLeaseSeconds = int64(120)

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
	Id                     int64  `json:"id"`
	PublicId               string `json:"public_id" gorm:"type:varchar(64);uniqueIndex;index:idx_byteplus_asset_user_public"`
	UserId                 int    `json:"user_id" gorm:"index:idx_byteplus_asset_user_public;index"`
	AssetGroupId           int64  `json:"-" gorm:"index"`
	RealPersonProfileId    *int64 `json:"-" gorm:"index"`
	ChannelId              int    `json:"-" gorm:"index"`
	UpstreamAssetId        string `json:"-" gorm:"type:varchar(128);index"`
	UpstreamRequestId      string `json:"-" gorm:"type:varchar(128)"`
	AssetType              string `json:"asset_type" gorm:"type:varchar(32)"`
	Name                   string `json:"name,omitempty" gorm:"type:varchar(128)"`
	SourceURL              string `json:"-" gorm:"-"`
	ModerationStrategy     string `json:"moderation_strategy" gorm:"type:varchar(32)"`
	Status                 string `json:"status" gorm:"type:varchar(32);index"`
	FailureCode            string `json:"failure_code,omitempty" gorm:"type:varchar(64)"`
	ErrorMessage           string `json:"-" gorm:"type:text"`
	DeleteAttempts         int    `json:"-"`
	LeaseUntil             int64  `json:"-" gorm:"bigint;index"`
	NextDeleteAt           int64  `json:"-" gorm:"bigint;index"`
	DeleteLeaseUpdatedTime int64  `json:"-" gorm:"bigint;index"`
	DeletedTime            int64  `json:"-" gorm:"bigint"`
	CreatedTime            int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime            int64  `json:"updated_time" gorm:"bigint"`
}

var (
	ErrBytePlusAssetNotUpdatable   = errors.New("byteplus asset is not updatable")
	ErrBytePlusAssetCursorNotFound = errors.New("byteplus asset cursor not found")
)

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

func CreateRealPersonBytePlusAssetForIdempotency(recordID, leaseUpdatedTime int64, asset BytePlusAsset, tempObjectID *int64, signedURLExpiresAt int64, now int64) (*BytePlusAsset, error) {
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&asset).Error; err != nil {
			return err
		}
		if tempObjectID != nil {
			updated := tx.Model(&BytePlusAssetTempObject{}).
				Where("id = ? AND asset_id IS NULL AND cleanup_status = ?", *tempObjectID, BytePlusTempObjectCleanupPending).
				Updates(map[string]any{
					"asset_id":                   asset.Id,
					"signed_url_expires_at":      signedURLExpiresAt,
					"next_cleanup_at":            signedURLExpiresAt,
					"cleanup_lease_updated_time": int64(0),
					"updated_time":               now,
				})
			if err := requireOneBytePlusTempObjectCAS(updated); err != nil {
				return err
			}
		}
		return BindAPIIdempotencyResourceTx(tx, recordID, leaseUpdatedTime, asset.PublicId, now)
	})
	if err != nil {
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

func GetBytePlusAssetByID(assetID int64) (*BytePlusAsset, error) {
	var asset BytePlusAsset
	if err := DB.First(&asset, assetID).Error; err != nil {
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

func ListBytePlusAssetsForRealPerson(userID int, profileID int64, limit int, afterPublicID string) ([]BytePlusAsset, bool, error) {
	if limit <= 0 {
		return nil, false, nil
	}
	query := DB.Where("user_id = ? AND real_person_profile_id = ? AND status <> ?", userID, profileID, BytePlusAssetStatusDeleted)
	afterPublicID = strings.TrimSpace(afterPublicID)
	if afterPublicID != "" {
		var cursor BytePlusAsset
		err := DB.Where("user_id = ? AND real_person_profile_id = ? AND public_id = ? AND status <> ?", userID, profileID, afterPublicID, BytePlusAssetStatusDeleted).
			First(&cursor).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, false, ErrBytePlusAssetCursorNotFound
			}
			return nil, false, err
		}
		query = query.Where("created_time < ? OR (created_time = ? AND id < ?)", cursor.CreatedTime, cursor.CreatedTime, cursor.Id)
	}
	var assets []BytePlusAsset
	if err := query.Order("created_time DESC, id DESC").Limit(limit + 1).Find(&assets).Error; err != nil {
		return nil, false, err
	}
	hasMore := len(assets) > limit
	if hasMore {
		assets = assets[:limit]
	}
	return assets, hasMore, nil
}

func UpdateBytePlusAssetUpstreamCreated(assetID int64, upstreamAssetID string, upstreamRequestID string, status string, now int64) error {
	result := DB.Model(&BytePlusAsset{}).
		Where("id = ? AND status = ?", assetID, BytePlusAssetStatusCreating).
		Updates(map[string]any{
			"upstream_asset_id":   upstreamAssetID,
			"upstream_request_id": upstreamRequestID,
			"status":              status,
			"error_message":       "",
			"updated_time":        now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return fmt.Errorf("%w: id=%d", ErrBytePlusAssetNotUpdatable, assetID)
	}
	return nil
}

func UpdateBytePlusAssetStatus(assetID int64, status string, errorMessage string, now int64) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&BytePlusAsset{}).
			Where("id = ?", assetID).
			Where("status NOT IN ?", bytePlusAssetTerminalStatuses()).
			Updates(map[string]any{
				"status":        status,
				"error_message": errorMessage,
				"updated_time":  now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return fmt.Errorf("%w: id=%d", ErrBytePlusAssetNotUpdatable, assetID)
		}
		if status == BytePlusAssetStatusActive || status == BytePlusAssetStatusFailed {
			if err := tx.Model(&BytePlusAssetTempObject{}).
				Where("asset_id = ? AND cleanup_status = ?", assetID, BytePlusTempObjectCleanupPending).
				Updates(map[string]any{"next_cleanup_at": now, "cleanup_lease_updated_time": int64(0), "updated_time": now}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func MarkBytePlusRealPersonAssetFailedForIdempotency(recordID, leaseUpdatedTime, assetID int64, publicID string, failureCode string, responseStatus int, responsePayload string, now int64) error {
	failureCode = strings.TrimSpace(failureCode)
	if failureCode == "" {
		failureCode = "asset_failed"
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		updatedAsset := tx.Model(&BytePlusAsset{}).
			Where("id = ? AND status NOT IN ?", assetID, bytePlusAssetTerminalStatuses()).
			Updates(map[string]any{
				"status":       BytePlusAssetStatusFailed,
				"failure_code": failureCode,
				"updated_time": now,
			})
		if err := requireOneBytePlusAssetCAS(updatedAsset, assetID); err != nil {
			return err
		}
		updatedRecord := tx.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status IN ? AND lease_updated_time = ? AND (resource_public_id = ? OR resource_public_id = ?)", recordID, []string{APIIdempotencyStatusProcessing, APIIdempotencyStatusCallingUpstream}, leaseUpdatedTime, "", publicID).
			Updates(map[string]any{
				"status":             APIIdempotencyStatusFailed,
				"resource_public_id": publicID,
				"response_status":    responseStatus,
				"response_payload":   responsePayload,
				"updated_time":       now,
			})
		return requireOneAPIIdempotencyCAS(updatedRecord)
	})
}

func MarkBytePlusRealPersonAssetOutcomeUnknownForIdempotency(recordID, leaseUpdatedTime, assetID int64, failureCode string, now int64) error {
	failureCode = strings.TrimSpace(failureCode)
	if failureCode == "" {
		failureCode = "idempotency_outcome_unknown"
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		updatedAsset := tx.Model(&BytePlusAsset{}).
			Where("id = ? AND status NOT IN ?", assetID, bytePlusAssetTerminalStatuses()).
			Updates(map[string]any{
				"status":       BytePlusAssetStatusFailed,
				"failure_code": failureCode,
				"updated_time": now,
			})
		if err := requireOneBytePlusAssetCAS(updatedAsset, assetID); err != nil {
			return err
		}
		updatedRecord := tx.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status IN ? AND lease_updated_time = ?", recordID, []string{APIIdempotencyStatusProcessing, APIIdempotencyStatusCallingUpstream}, leaseUpdatedTime).
			Updates(map[string]any{"status": APIIdempotencyStatusOutcomeUnknown, "updated_time": now})
		return requireOneAPIIdempotencyCAS(updatedRecord)
	})
}

func MarkBytePlusAssetOutcomeUnknown(publicID string, now int64) (bool, error) {
	publicID = strings.TrimSpace(publicID)
	if publicID == "" {
		return false, nil
	}
	result := DB.Model(&BytePlusAsset{}).
		Where("public_id = ? AND status = ?", publicID, BytePlusAssetStatusCreating).
		Updates(map[string]any{
			"status":       BytePlusAssetStatusFailed,
			"failure_code": "idempotency_outcome_unknown",
			"updated_time": now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func BeginBytePlusAssetDeletion(userID int, publicID string, now int64) (*BytePlusAsset, bool, error) {
	var asset BytePlusAsset
	if err := DB.Where("user_id = ? AND public_id = ?", userID, strings.TrimSpace(publicID)).First(&asset).Error; err != nil {
		return nil, false, err
	}
	if asset.Status == BytePlusAssetStatusDeleting || asset.Status == BytePlusAssetStatusDeleted {
		return &asset, false, nil
	}
	nextDeleteAt := now
	if asset.LeaseUntil > nextDeleteAt {
		nextDeleteAt = asset.LeaseUntil
	}
	updated := DB.Model(&BytePlusAsset{}).
		Where("id = ? AND status NOT IN ?", asset.Id, []string{BytePlusAssetStatusDeleting, BytePlusAssetStatusDeleted}).
		Updates(map[string]any{
			"status":                    BytePlusAssetStatusDeleting,
			"next_delete_at":            nextDeleteAt,
			"delete_lease_updated_time": int64(0),
			"updated_time":              now,
		})
	if updated.Error != nil {
		return nil, false, updated.Error
	}
	if err := DB.First(&asset, asset.Id).Error; err != nil {
		return nil, false, err
	}
	return &asset, updated.RowsAffected == 1, nil
}

func ClaimBytePlusAssetDeletion(assetID int64, now, staleBefore int64) (*BytePlusAsset, bool, error) {
	var asset BytePlusAsset
	if err := DB.First(&asset, assetID).Error; err != nil {
		return nil, false, err
	}
	if asset.Status != BytePlusAssetStatusDeleting || asset.NextDeleteAt > now ||
		(asset.DeleteLeaseUpdatedTime != 0 && asset.DeleteLeaseUpdatedTime >= staleBefore) {
		return &asset, false, nil
	}
	updated := DB.Model(&BytePlusAsset{}).
		Where("id = ? AND status = ? AND next_delete_at <= ? AND delete_lease_updated_time = ?",
			asset.Id, BytePlusAssetStatusDeleting, now, asset.DeleteLeaseUpdatedTime).
		Updates(map[string]any{
			"delete_lease_updated_time": now,
			"updated_time":              now,
		})
	if updated.Error != nil {
		return nil, false, updated.Error
	}
	if err := DB.First(&asset, assetID).Error; err != nil {
		return nil, false, err
	}
	return &asset, updated.RowsAffected == 1, nil
}

func ClaimDueBytePlusAssetStatusChecks(now, staleBefore int64, limit int) ([]BytePlusAsset, error) {
	if limit <= 0 {
		return nil, nil
	}
	var candidates []BytePlusAsset
	if err := DB.Where("status = ? AND upstream_asset_id <> ? AND updated_time <= ?",
		BytePlusAssetStatusProcessing, "", staleBefore,
	).Where("NOT EXISTS (SELECT 1 FROM byte_plus_asset_temp_objects WHERE byte_plus_asset_temp_objects.asset_id = byte_plus_assets.id AND cleanup_status = ? AND next_cleanup_at <= ? AND (cleanup_lease_updated_time = ? OR cleanup_lease_updated_time < ?))",
		BytePlusTempObjectCleanupPending, now, int64(0), staleBefore,
	).Order("updated_time ASC, id ASC").Limit(limit).Find(&candidates).Error; err != nil {
		return nil, err
	}
	claimed := make([]BytePlusAsset, 0, len(candidates))
	for _, candidate := range candidates {
		result := DB.Model(&BytePlusAsset{}).
			Where("id = ? AND status = ? AND upstream_asset_id <> ? AND updated_time = ?",
				candidate.Id, BytePlusAssetStatusProcessing, "", candidate.UpdatedTime).
			Where("NOT EXISTS (SELECT 1 FROM byte_plus_asset_temp_objects WHERE byte_plus_asset_temp_objects.asset_id = byte_plus_assets.id AND cleanup_status = ? AND next_cleanup_at <= ? AND (cleanup_lease_updated_time = ? OR cleanup_lease_updated_time < ?))",
				BytePlusTempObjectCleanupPending, now, int64(0), staleBefore).
			Update("updated_time", now)
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected != 1 {
			continue
		}
		candidate.UpdatedTime = now
		claimed = append(claimed, candidate)
	}
	return claimed, nil
}

func ClaimDueBytePlusAssetDeletions(now, staleBefore int64, limit int) ([]BytePlusAsset, error) {
	if limit <= 0 {
		return nil, nil
	}
	var candidates []BytePlusAsset
	if err := DB.Where("status = ? AND next_delete_at <= ? AND (delete_lease_updated_time = ? OR delete_lease_updated_time < ?)",
		BytePlusAssetStatusDeleting, now, int64(0), staleBefore,
	).Order("next_delete_at ASC, id ASC").Limit(limit).Find(&candidates).Error; err != nil {
		return nil, err
	}
	claimed := make([]BytePlusAsset, 0, len(candidates))
	for _, candidate := range candidates {
		asset, owner, err := ClaimBytePlusAssetDeletion(candidate.Id, now, staleBefore)
		if err != nil {
			return nil, err
		}
		if owner && asset != nil {
			claimed = append(claimed, *asset)
		}
	}
	return claimed, nil
}

func CompleteBytePlusAssetDeletion(assetID int64, leaseUpdatedTime int64, now int64) (bool, error) {
	changed := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		updated := tx.Model(&BytePlusAsset{}).
			Where("id = ? AND status = ? AND delete_lease_updated_time = ? AND lease_until <= ?", assetID, BytePlusAssetStatusDeleting, leaseUpdatedTime, now).
			Updates(map[string]any{
				"status":                    BytePlusAssetStatusDeleted,
				"delete_lease_updated_time": int64(0),
				"deleted_time":              now,
				"updated_time":              now,
			})
		if updated.Error != nil {
			return updated.Error
		}
		if updated.RowsAffected != 1 {
			return nil
		}
		changed = true
		return tx.Model(&BytePlusAssetTempObject{}).
			Where("asset_id = ? AND cleanup_status = ?", assetID, BytePlusTempObjectCleanupPending).
			Updates(map[string]any{"next_cleanup_at": now, "cleanup_lease_updated_time": int64(0), "updated_time": now}).Error
	})
	return changed, err
}

func RetryBytePlusAssetStatusCheck(assetID int64, claimedUpdatedTime int64, nextAttempt int64) (bool, error) {
	nextEligibleMarker := nextAttempt - bytePlusAssetStatusCheckLeaseSeconds
	updated := DB.Model(&BytePlusAsset{}).
		Where("id = ? AND status = ? AND updated_time = ?", assetID, BytePlusAssetStatusProcessing, claimedUpdatedTime).
		Update("updated_time", nextEligibleMarker)
	if updated.Error != nil {
		return false, updated.Error
	}
	return updated.RowsAffected == 1, nil
}

func RetryBytePlusAssetDeletion(assetID int64, leaseUpdatedTime int64, nextAttempt int64, now int64) (bool, error) {
	updated := DB.Model(&BytePlusAsset{}).
		Where("id = ? AND status = ? AND delete_lease_updated_time = ?", assetID, BytePlusAssetStatusDeleting, leaseUpdatedTime).
		Updates(map[string]any{
			"delete_attempts":           gorm.Expr("delete_attempts + ?", 1),
			"delete_lease_updated_time": int64(0),
			"next_delete_at":            gorm.Expr("CASE WHEN lease_until > ? THEN lease_until ELSE ? END", nextAttempt, nextAttempt),
			"updated_time":              now,
		})
	return updated.RowsAffected == 1, updated.Error
}

func ExtendBytePlusAssetLeasesForSubmit(userID int, publicIDs []string, leaseUntil int64, now int64) ([]BytePlusAsset, error) {
	unique := make([]string, 0, len(publicIDs))
	seen := make(map[string]struct{}, len(publicIDs))
	for _, publicID := range publicIDs {
		publicID = strings.TrimSpace(publicID)
		if publicID == "" {
			continue
		}
		if _, ok := seen[publicID]; ok {
			continue
		}
		seen[publicID] = struct{}{}
		unique = append(unique, publicID)
	}
	if len(unique) == 0 {
		return nil, nil
	}
	var assets []BytePlusAsset
	err := DB.Transaction(func(tx *gorm.DB) error {
		update := tx.Model(&BytePlusAsset{}).
			Where("user_id = ? AND public_id IN ?", userID, unique).
			Where("status = ? OR (status = ? AND delete_lease_updated_time = ?)", BytePlusAssetStatusActive, BytePlusAssetStatusDeleting, int64(0)).
			Updates(map[string]any{
				"lease_until":    gorm.Expr("CASE WHEN lease_until < ? THEN ? ELSE lease_until END", leaseUntil, leaseUntil),
				"next_delete_at": gorm.Expr("CASE WHEN status = ? AND next_delete_at < ? THEN ? ELSE next_delete_at END", BytePlusAssetStatusDeleting, leaseUntil, leaseUntil),
				"updated_time":   now,
			})
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected != int64(len(unique)) {
			return ErrAPIIdempotencyCASLost
		}
		return tx.Where("user_id = ? AND public_id IN ?", userID, unique).Find(&assets).Error
	})
	return assets, err
}

func IsBytePlusAssetNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}

func bytePlusAssetTerminalStatuses() []string {
	return []string{BytePlusAssetStatusActive, BytePlusAssetStatusFailed, BytePlusAssetStatusDeleting, BytePlusAssetStatusDeleted}
}

func requireOneBytePlusAssetCAS(result *gorm.DB, assetID int64) error {
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return fmt.Errorf("%w: id=%d", ErrBytePlusAssetNotUpdatable, assetID)
	}
	return nil
}
