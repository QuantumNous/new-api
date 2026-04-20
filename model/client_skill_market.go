package model

import (
	"encoding/json"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ClientSkillMarketItem 存储 myclaw 技能商店的公开技能。
// 供 /api/client/skills 直接读取，后续可以通过数据库配置技能商店内容。
type ClientSkillMarketItem struct {
	Id              int            `json:"id"`
	Name            string         `json:"name" gorm:"size:128;not null;uniqueIndex:uk_client_skill_name_delete_at,priority:1"`
	DisplayName     string         `json:"display_name" gorm:"size:191;default:''"`
	DisplayNameZh   string         `json:"display_name_zh" gorm:"size:191;default:''"`
	Description     string         `json:"description" gorm:"type:text"`
	DescriptionZh   string         `json:"description_zh" gorm:"type:text"`
	Category        string         `json:"category" gorm:"size:64;index"`
	Tags            JSONValue      `json:"tags" gorm:"type:json"`
	Source          string         `json:"source" gorm:"size:32;default:'community'"`
	SourcePlatform  string         `json:"source_platform" gorm:"size:64;not null;default:'manual';index;uniqueIndex:uk_client_skill_source_slug_delete_at,priority:1"`
	SourceSkillID   string         `json:"source_skill_id" gorm:"size:128;index"`
	SourceSlug      string         `json:"source_slug" gorm:"size:191;not null;default:'';uniqueIndex:uk_client_skill_source_slug_delete_at,priority:2"`
	SourceUpdatedAt int64          `json:"source_updated_at" gorm:"bigint;default:0;index"`
	RawPayload      JSONValue      `json:"raw_payload" gorm:"type:json"`
	URL             string         `json:"url" gorm:"type:text"`
	DownloadURL     string         `json:"download_url,omitempty" gorm:"type:text"`
	Author          string         `json:"author,omitempty" gorm:"size:128"`
	Version         string         `json:"version,omitempty" gorm:"size:64"`
	Downloads       int            `json:"downloads,omitempty" gorm:"default:0"`
	Enabled         bool           `json:"enabled" gorm:"default:true;index"`
	IsPublic        bool           `json:"is_public" gorm:"default:true;index"`
	SortOrder       int            `json:"sort_order" gorm:"default:0;index"`
	CreatedTime     int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime     int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_client_skill_name_delete_at,priority:2;uniqueIndex:uk_client_skill_source_slug_delete_at,priority:3"`
}

func (s *ClientSkillMarketItem) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if s.CreatedTime == 0 {
		s.CreatedTime = now
	}
	s.UpdatedTime = now
	return nil
}

func (s *ClientSkillMarketItem) BeforeUpdate(_ *gorm.DB) error {
	s.UpdatedTime = common.GetTimestamp()
	return nil
}

func (s *ClientSkillMarketItem) TagList() []string {
	if len(s.Tags) == 0 {
		return []string{}
	}
	var tags []string
	if err := json.Unmarshal(s.Tags, &tags); err != nil {
		return []string{}
	}
	return tags
}

func ListPublicClientSkillMarketItems() ([]*ClientSkillMarketItem, error) {
	var items []*ClientSkillMarketItem
	err := DB.Model(&ClientSkillMarketItem{}).
		Where("enabled = ? AND is_public = ?", true, true).
		Order("sort_order ASC, id ASC").
		Find(&items).Error
	return items, err
}

func GetPublicClientSkillMarketItemByID(id int) (*ClientSkillMarketItem, error) {
	var item ClientSkillMarketItem
	err := DB.Model(&ClientSkillMarketItem{}).
		Where("id = ? AND enabled = ? AND is_public = ?", id, true, true).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func ListClientSkillMarketItems() ([]*ClientSkillMarketItem, error) {
	var items []*ClientSkillMarketItem
	err := DB.Model(&ClientSkillMarketItem{}).
		Order("sort_order ASC, id ASC").
		Find(&items).Error
	return items, err
}

func GetClientSkillMarketItemByID(id int) (*ClientSkillMarketItem, error) {
	var item ClientSkillMarketItem
	err := DB.Model(&ClientSkillMarketItem{}).
		Where("id = ?", id).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func FindClientSkillMarketItemBySource(platform string, slug string) (*ClientSkillMarketItem, error) {
	var item ClientSkillMarketItem
	err := DB.Model(&ClientSkillMarketItem{}).
		Where("source_platform = ? AND source_slug = ?", platform, slug).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func IncrementClientSkillMarketDownload(id int) error {
	return DB.Model(&ClientSkillMarketItem{}).
		Where("id = ? AND enabled = ? AND is_public = ?", id, true, true).
		Update("downloads", gorm.Expr("downloads + ?", 1)).Error
}
