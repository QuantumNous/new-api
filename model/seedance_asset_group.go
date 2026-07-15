package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

const (
	SeedanceGroupTypeAIGC          = "AIGC"
	SeedanceGroupTypeLivenessFace  = "LivenessFace"
	SeedanceGroupStatusActive      = "active"
	SeedanceGroupStatusDeleted     = "deleted"
)

type SeedanceAssetGroup struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	UserId      int    `json:"user_id" gorm:"index;not null"`
	GroupId     string `json:"group_id" gorm:"type:varchar(128);uniqueIndex;not null"`
	GroupType   string `json:"group_type" gorm:"type:varchar(32);default:'AIGC'"`
	GroupName   string `json:"group_name" gorm:"type:varchar(255)"`
	Description string `json:"description" gorm:"type:varchar(512)"`
	Status      string `json:"status" gorm:"type:varchar(32);index;default:'active'"`
	ChannelId   int    `json:"channel_id" gorm:"index"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

func (g *SeedanceAssetGroup) Insert() error {
	now := time.Now().Unix()
	if g.CreatedAt == 0 {
		g.CreatedAt = now
	}
	g.UpdatedAt = now
	if g.Status == "" {
		g.Status = SeedanceGroupStatusActive
	}
	if g.GroupType == "" {
		g.GroupType = SeedanceGroupTypeAIGC
	}
	return DB.Create(g).Error
}

func (g *SeedanceAssetGroup) Update() error {
	g.UpdatedAt = time.Now().Unix()
	return DB.Save(g).Error
}

func SoftDeleteSeedanceAssetGroup(userId int, groupId string) error {
	return DB.Model(&SeedanceAssetGroup{}).
		Where("user_id = ? AND group_id = ? AND status = ?", userId, groupId, SeedanceGroupStatusActive).
		Updates(map[string]interface{}{
			"status":     SeedanceGroupStatusDeleted,
			"updated_at": time.Now().Unix(),
		}).Error
}

func GetSeedanceAssetGroupByUserAndGroupID(userId int, groupId string) (*SeedanceAssetGroup, error) {
	var g SeedanceAssetGroup
	err := DB.Where("user_id = ? AND group_id = ? AND status = ?", userId, groupId, SeedanceGroupStatusActive).
		First(&g).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

type SeedanceAssetGroupQuery struct {
	GroupType string
	GroupIds  []string
	PageNo    int
	PageSize  int
}

func ListSeedanceAssetGroupsByUser(userId int, q SeedanceAssetGroupQuery) (items []*SeedanceAssetGroup, total int64, err error) {
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

	query := DB.Model(&SeedanceAssetGroup{}).
		Where("user_id = ? AND status = ?", userId, SeedanceGroupStatusActive)
	if q.GroupType != "" {
		query = query.Where("group_type = ?", q.GroupType)
	}
	if len(q.GroupIds) > 0 {
		query = query.Where("group_id IN ?", q.GroupIds)
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

func UpsertSeedanceAssetGroup(g *SeedanceAssetGroup) error {
	existing, err := GetSeedanceAssetGroupByAnyGroupID(g.GroupId)
	if err != nil {
		return err
	}
	now := time.Now().Unix()
	if existing == nil {
		return g.Insert()
	}
	if existing.UserId != g.UserId {
		return errors.New("group_owned_by_other")
	}
	existing.Status = SeedanceGroupStatusActive
	if g.GroupType != "" {
		existing.GroupType = g.GroupType
	}
	if g.GroupName != "" {
		existing.GroupName = g.GroupName
	}
	if g.Description != "" {
		existing.Description = g.Description
	}
	if g.ChannelId > 0 {
		existing.ChannelId = g.ChannelId
	}
	existing.UpdatedAt = now
	return existing.Update()
}

func GetSeedanceAssetGroupByAnyGroupID(groupId string) (*SeedanceAssetGroup, error) {
	var g SeedanceAssetGroup
	err := DB.Where("group_id = ?", groupId).First(&g).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}
