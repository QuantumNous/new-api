package model

import (
	"errors"
	"strconv"
	"time"

	"gorm.io/gorm"
)

const (
	SeedanceAssetStatusUploaded   = "uploaded"
	SeedanceAssetStatusProcessing = "processing"
	SeedanceAssetStatusActive     = "active"
	SeedanceAssetStatusFailed     = "failed"
	SeedanceAssetStatusDeleted    = "deleted"
)

type SeedanceAsset struct {
	Id           int    `json:"id" gorm:"primaryKey"`
	UserId       int    `json:"user_id" gorm:"index;not null"`
	GroupId      string `json:"group_id" gorm:"type:varchar(128);index"`
	AiccAssetId  string `json:"aicc_asset_id" gorm:"type:varchar(128);uniqueIndex"`
	Filename     string `json:"filename" gorm:"type:varchar(255)"`
	Type         string `json:"type" gorm:"type:varchar(32)"`
	Status       string `json:"status" gorm:"type:varchar(32);index;default:'processing'"`
	URL          string `json:"url" gorm:"type:varchar(2048)"`
	AssetURI     string `json:"asset_uri" gorm:"type:varchar(256)"`
	ErrorMessage string `json:"error_message" gorm:"type:varchar(1024)"`
	ChannelId    int    `json:"channel_id" gorm:"index"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint"`
}

func (a *SeedanceAsset) Insert() error {
	now := time.Now().Unix()
	if a.CreatedAt == 0 {
		a.CreatedAt = now
	}
	a.UpdatedAt = now
	if a.Status == "" {
		a.Status = SeedanceAssetStatusProcessing
	}
	if a.AssetURI == "" && a.AiccAssetId != "" {
		a.AssetURI = "asset://" + a.AiccAssetId
	}
	return DB.Create(a).Error
}

func (a *SeedanceAsset) Update() error {
	a.UpdatedAt = time.Now().Unix()
	if a.AssetURI == "" && a.AiccAssetId != "" {
		a.AssetURI = "asset://" + a.AiccAssetId
	}
	return DB.Save(a).Error
}

func SoftDeleteSeedanceAsset(userId int, id int) error {
	return DB.Model(&SeedanceAsset{}).
		Where("id = ? AND user_id = ? AND status <> ?", id, userId, SeedanceAssetStatusDeleted).
		Updates(map[string]interface{}{
			"status":     SeedanceAssetStatusDeleted,
			"updated_at": time.Now().Unix(),
		}).Error
}

func GetSeedanceAssetByUserAndIDOrAicc(userId int, idOrAicc string) (*SeedanceAsset, error) {
	var a SeedanceAsset
	q := DB.Where("user_id = ? AND status <> ?", userId, SeedanceAssetStatusDeleted)
	if localId, err := strconv.Atoi(idOrAicc); err == nil && localId > 0 {
		q = q.Where("id = ? OR aicc_asset_id = ?", localId, idOrAicc)
	} else {
		q = q.Where("aicc_asset_id = ?", idOrAicc)
	}
	err := q.First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

type SeedanceAssetQuery struct {
	GroupId  string
	GroupIds []string
	Type     string
	Status   string
	Statuses []string
	PageNo   int
	PageSize int
}

func ListSeedanceAssetsByUser(userId int, q SeedanceAssetQuery) (items []*SeedanceAsset, total int64, err error) {
	pageNo := q.PageNo
	pageSize := q.PageSize
	if pageNo < 1 {
		pageNo = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	query := DB.Model(&SeedanceAsset{}).
		Where("user_id = ? AND status <> ?", userId, SeedanceAssetStatusDeleted)
	if q.GroupId != "" {
		query = query.Where("group_id = ?", q.GroupId)
	}
	if len(q.GroupIds) > 0 {
		query = query.Where("group_id IN ?", q.GroupIds)
	}
	if q.Type != "" {
		query = query.Where("type = ?", q.Type)
	}
	if q.Status != "" {
		query = query.Where("status = ?", q.Status)
	}
	if len(q.Statuses) > 0 {
		query = query.Where("status IN ?", q.Statuses)
	}
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("id DESC").
		Offset((pageNo - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error
	return items, total, err
}
