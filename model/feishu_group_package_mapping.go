package model

import (
	"errors"
	"strings"
	"time"
)

type FeishuGroupPackageMapping struct {
	Id              int    `json:"id" gorm:"primaryKey"`
	FeishuGroupId   string `json:"feishu_group_id" gorm:"type:varchar(128);index"`
	FeishuGroupName string `json:"feishu_group_name" gorm:"type:varchar(255);index"`
	TargetGroup     string `json:"target_group" gorm:"type:varchar(64);index"`
	Enabled         bool   `json:"enabled" gorm:"index"`
	Priority        int    `json:"priority" gorm:"default:0;index"`
	Remark          string `json:"remark" gorm:"type:varchar(256)"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt       int64  `json:"updated_at" gorm:"bigint"`
}

func (FeishuGroupPackageMapping) TableName() string {
	return "feishu_group_package_mappings"
}

func GetAllFeishuGroupPackageMappings() ([]FeishuGroupPackageMapping, error) {
	var mappings []FeishuGroupPackageMapping
	err := DB.Order("priority desc, id asc").Find(&mappings).Error
	return mappings, err
}

func GetEnabledFeishuGroupPackageMappings() ([]FeishuGroupPackageMapping, error) {
	var mappings []FeishuGroupPackageMapping
	err := DB.Where("enabled = ?", true).Order("priority desc, id asc").Find(&mappings).Error
	return mappings, err
}

func GetFeishuGroupPackageMappingById(id int) (*FeishuGroupPackageMapping, error) {
	if id <= 0 {
		return nil, errors.New("invalid mapping id")
	}
	var mapping FeishuGroupPackageMapping
	err := DB.First(&mapping, id).Error
	if err != nil {
		return nil, err
	}
	return &mapping, nil
}

func CreateFeishuGroupPackageMapping(mapping *FeishuGroupPackageMapping) error {
	if mapping == nil {
		return errors.New("mapping is nil")
	}
	mapping.FeishuGroupId = strings.TrimSpace(mapping.FeishuGroupId)
	mapping.FeishuGroupName = strings.TrimSpace(mapping.FeishuGroupName)
	mapping.TargetGroup = strings.TrimSpace(mapping.TargetGroup)
	if mapping.FeishuGroupId == "" && mapping.FeishuGroupName == "" {
		return errors.New("feishu group is empty")
	}
	if mapping.TargetGroup == "" {
		return errors.New("target group is empty")
	}
	now := time.Now().Unix()
	mapping.CreatedAt = now
	mapping.UpdatedAt = now
	return DB.Create(mapping).Error
}

func UpdateFeishuGroupPackageMapping(mapping *FeishuGroupPackageMapping) error {
	if mapping == nil || mapping.Id <= 0 {
		return errors.New("invalid mapping")
	}
	mapping.FeishuGroupId = strings.TrimSpace(mapping.FeishuGroupId)
	mapping.FeishuGroupName = strings.TrimSpace(mapping.FeishuGroupName)
	mapping.TargetGroup = strings.TrimSpace(mapping.TargetGroup)
	if mapping.FeishuGroupId == "" && mapping.FeishuGroupName == "" {
		return errors.New("feishu group is empty")
	}
	if mapping.TargetGroup == "" {
		return errors.New("target group is empty")
	}
	mapping.UpdatedAt = time.Now().Unix()
	return DB.Save(mapping).Error
}

func DeleteFeishuGroupPackageMapping(id int) error {
	if id <= 0 {
		return errors.New("invalid mapping id")
	}
	return DB.Delete(&FeishuGroupPackageMapping{}, id).Error
}

func FindFeishuGroupPackageMapping(groupIds, groupNames []string) (*FeishuGroupPackageMapping, error) {
	mappings, err := GetEnabledFeishuGroupPackageMappings()
	if err != nil {
		return nil, err
	}
	idSet := map[string]bool{}
	nameSet := map[string]bool{}
	for _, id := range groupIds {
		id = strings.TrimSpace(id)
		if id != "" {
			idSet[id] = true
		}
	}
	for _, name := range groupNames {
		name = strings.TrimSpace(name)
		if name != "" {
			nameSet[name] = true
		}
	}
	for i := range mappings {
		mapping := &mappings[i]
		if mapping.FeishuGroupId != "" && idSet[mapping.FeishuGroupId] {
			return mapping, nil
		}
		if mapping.FeishuGroupName != "" && nameSet[mapping.FeishuGroupName] {
			return mapping, nil
		}
	}
	return nil, nil
}

func IsDuplicateFeishuGroupPackageMapping(id int, feishuGroupId, feishuGroupName string) (bool, error) {
	feishuGroupId = strings.TrimSpace(feishuGroupId)
	feishuGroupName = strings.TrimSpace(feishuGroupName)
	if feishuGroupId != "" {
		var count int64
		if err := DB.Model(&FeishuGroupPackageMapping{}).
			Where("id <> ? OR ? = 0", id, id).
			Where("feishu_group_id = ?", feishuGroupId).
			Count(&count).Error; err != nil {
			return false, err
		}
		if count > 0 {
			return true, nil
		}
	}
	if feishuGroupName != "" {
		var count int64
		if err := DB.Model(&FeishuGroupPackageMapping{}).
			Where("id <> ? OR ? = 0", id, id).
			Where("feishu_group_name = ?", feishuGroupName).
			Count(&count).Error; err != nil {
			return false, err
		}
		return count > 0, nil
	}
	return false, nil
}
