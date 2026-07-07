package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CanvasAsset 画布素材库条目。二进制存 OBS(key 命名空间 canvas/assets/{user_id}/...),
// 数据库只保存元数据与归属;ObsKey 不下发给前端。
type CanvasAsset struct {
	Id         int64  `gorm:"primaryKey" json:"id"`
	UserId     int    `gorm:"index;not null" json:"user_id"`
	AssetId    string `gorm:"size:64;uniqueIndex;not null" json:"asset_id"`
	ProjectId  string `gorm:"size:64;index" json:"project_id,omitempty"`
	Name       string `gorm:"size:255" json:"name"`
	MediaType  string `gorm:"size:32;index" json:"media_type"`
	MimeType   string `gorm:"size:128" json:"mime_type"`
	SizeBytes  int64  `gorm:"not null;default:0" json:"size_bytes"`
	Width      int    `json:"width,omitempty"`
	Height     int    `json:"height,omitempty"`
	DurationMs int64  `json:"duration_ms,omitempty"`
	ObsKey     string `gorm:"size:512;not null" json:"-"`
	Hash       string `gorm:"size:128;index" json:"hash,omitempty"`
	Source     string `gorm:"size:32;index" json:"source"`
	Status     string `gorm:"size:32;index" json:"status"`
	CreatedAt  int64  `json:"created_at"`
	UpdatedAt  int64  `json:"updated_at"`
	DeletedAt  int64  `gorm:"index" json:"deleted_at,omitempty"`
}

// CanvasStorageUsage 用户素材库容量占用(按用户总量限制,与 token quota 无关)。
type CanvasStorageUsage struct {
	UserId     int   `gorm:"primaryKey" json:"user_id"`
	UsedBytes  int64 `gorm:"not null;default:0" json:"used_bytes"`
	AssetCount int   `gorm:"not null;default:0" json:"asset_count"`
	UpdatedAt  int64 `json:"updated_at"`
}

const (
	CanvasAssetStatusActive  = "active"
	CanvasAssetStatusDeleted = "deleted"
)

var ErrCanvasStorageQuotaExceeded = errors.New("canvas storage quota exceeded")

func GetCanvasAssetsByUser(userId int, mediaType, projectId, keyword string, offset, limit int) ([]*CanvasAsset, int64, error) {
	query := DB.Model(&CanvasAsset{}).Where("user_id = ? AND status = ?", userId, CanvasAssetStatusActive)
	if mediaType != "" {
		query = query.Where("media_type = ?", mediaType)
	}
	if projectId != "" {
		query = query.Where("project_id = ?", projectId)
	}
	if keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var assets []*CanvasAsset
	err := query.Order("id desc").Offset(offset).Limit(limit).Find(&assets).Error
	return assets, total, err
}

func GetCanvasAsset(userId int, assetId string) (*CanvasAsset, error) {
	var asset CanvasAsset
	err := DB.Where("user_id = ? AND asset_id = ? AND status = ?", userId, assetId, CanvasAssetStatusActive).First(&asset).Error
	if err != nil {
		return nil, err
	}
	return &asset, nil
}

func GetCanvasStorageUsage(userId int) (*CanvasStorageUsage, error) {
	var usage CanvasStorageUsage
	err := DB.Where("user_id = ?", userId).First(&usage).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &CanvasStorageUsage{UserId: userId}, nil
	}
	if err != nil {
		return nil, err
	}
	return &usage, nil
}

// CreateCanvasAssetWithQuota 登记素材并原子扣减配额。
// 跨库安全:不使用 FOR UPDATE(SQLite 不支持),沿用项目的条件更新抢占模式——
// 先条件 UPDATE 占用行(带配额上限判断),RowsAffected=0 视为超额;再插入素材行。
// limitBytes < 0 表示不限制。超额返回 ErrCanvasStorageQuotaExceeded。
func CreateCanvasAssetWithQuota(asset *CanvasAsset, limitBytes int64) error {
	now := time.Now().Unix()
	asset.Status = CanvasAssetStatusActive
	asset.CreatedAt = now
	asset.UpdatedAt = now
	// 确保占用行存在(幂等;冲突说明已存在,忽略)
	_ = DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&CanvasStorageUsage{UserId: asset.UserId, UpdatedAt: now}).Error
	return DB.Transaction(func(tx *gorm.DB) error {
		query := tx.Model(&CanvasStorageUsage{}).Where("user_id = ?", asset.UserId)
		if limitBytes >= 0 {
			query = query.Where("used_bytes + ? <= ?", asset.SizeBytes, limitBytes)
		}
		result := query.Updates(map[string]interface{}{
			"used_bytes":  gorm.Expr("used_bytes + ?", asset.SizeBytes),
			"asset_count": gorm.Expr("asset_count + 1"),
			"updated_at":  now,
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrCanvasStorageQuotaExceeded
		}
		return tx.Create(asset).Error
	})
}

// SoftDeleteCanvasAsset 软删除素材并扣减占用,返回被删素材(供调用方异步删 OBS 对象)。
// 状态翻转用条件更新抢占(status=active → deleted),并发重复删除只有一方生效。
func SoftDeleteCanvasAsset(userId int, assetId string) (*CanvasAsset, error) {
	var asset CanvasAsset
	if err := DB.Where("user_id = ? AND asset_id = ? AND status = ?", userId, assetId, CanvasAssetStatusActive).First(&asset).Error; err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	var deleted *CanvasAsset
	err := DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&CanvasAsset{}).
			Where("id = ? AND status = ?", asset.Id, CanvasAssetStatusActive).
			Updates(map[string]interface{}{
				"status":     CanvasAssetStatusDeleted,
				"deleted_at": now,
				"updated_at": now,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		deleted = &asset
		return tx.Model(&CanvasStorageUsage{}).Where("user_id = ?", userId).
			Updates(map[string]interface{}{
				"used_bytes":  gorm.Expr("CASE WHEN used_bytes >= ? THEN used_bytes - ? ELSE 0 END", asset.SizeBytes, asset.SizeBytes),
				"asset_count": gorm.Expr("CASE WHEN asset_count >= 1 THEN asset_count - 1 ELSE 0 END"),
				"updated_at":  now,
			}).Error
	})
	return deleted, err
}
