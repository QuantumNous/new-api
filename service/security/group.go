package security

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"gorm.io/gorm"
)

// GetSecurityGroupById 根据ID获取分组
func GetSecurityGroupById(id int64) (*model.SecurityGroup, error) {
	var group model.SecurityGroup
	err := model.DB.Where("id = ?", id).First(&group).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

// GetSecurityGroups 获取分组列表
func GetSecurityGroups(page, pageSize int, status int, parentID int64) ([]*model.SecurityGroup, int64, error) {
	var groups []*model.SecurityGroup
	var count int64

	db := model.DB.Model(&model.SecurityGroup{})
	if status >= 0 {
		db = db.Where("status = ?", status)
	}
	if parentID >= 0 {
		db = db.Where("parent_id = ?", parentID)
	}

	err := db.Count(&count).Error
	if err != nil {
		return nil, 0, err
	}

	err = db.Order("sort_order ASC, id ASC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&groups).Error
	if err != nil {
		return nil, 0, err
	}

	return groups, count, nil
}

// CreateSecurityGroup 创建分组
func CreateSecurityGroup(req *dto.SecurityGroupRequest) (*model.SecurityGroup, error) {
	depth := 0
	path := ""

	if req.ParentID > 0 {
		parent, err := GetSecurityGroupById(req.ParentID)
		if err != nil {
			return nil, errors.New("父分组不存在")
		}
		if parent.Depth >= constant.SecurityMaxGroupDepth {
			return nil, fmt.Errorf("分组嵌套深度不能超过%d层", constant.SecurityMaxGroupDepth)
		}
		depth = parent.Depth + 1
		path = fmt.Sprintf("%s/%d", parent.Path, req.ParentID)
	} else {
		path = fmt.Sprintf("/%d", req.ParentID)
	}

	group := &model.SecurityGroup{
		Name:        req.Name,
		Description: req.Description,
		Status:      constant.SecurityStatusEnabled,
		ParentID:    req.ParentID,
		Depth:       depth,
		Path:        path,
		SortOrder:   req.SortOrder,
		CreatedAt:   time.Now().Unix(),
		UpdatedAt:   time.Now().Unix(),
	}

	err := model.DB.Create(group).Error
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return nil, errors.New("分组名称已存在")
		}
		return nil, err
	}

	// 更新 path 包含自身 ID
	group.Path = fmt.Sprintf("%s/%d", path, group.ID)
	err = model.DB.Model(group).Update("path", group.Path).Error
	if err != nil {
		common.SysLog("更新分组 path 失败: " + err.Error())
	}

	return group, nil
}

// UpdateSecurityGroup 更新分组
func UpdateSecurityGroup(id int64, req *dto.SecurityGroupRequest) error {
	group, err := GetSecurityGroupById(id)
	if err != nil {
		return errors.New("分组不存在")
	}

	updates := map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"sort_order":  req.SortOrder,
		"updated_at":  time.Now().Unix(),
	}

	return model.DB.Model(group).Updates(updates).Error
}

// DeleteSecurityGroup 删除分组（同时删除子分组和规则）
func DeleteSecurityGroup(id int64) error {
	group, err := GetSecurityGroupById(id)
	if err != nil {
		return errors.New("分组不存在")
	}

	// 删除该分组及其子分组下的所有规则
	return model.DB.Transaction(func(tx *gorm.DB) error {
		// 删除子分组规则
		if err := tx.Where("group_id IN (?)", tx.Model(&model.SecurityGroup{}).Select("id").Where("path LIKE ?", group.Path+"/%")).Delete(&model.SecurityRule{}).Error; err != nil {
			return err
		}
		// 删除当前分组规则
		if err := tx.Where("group_id = ?", id).Delete(&model.SecurityRule{}).Error; err != nil {
			return err
		}
		// 删除子分组
		if err := tx.Where("path LIKE ?", group.Path+"/%").Delete(&model.SecurityGroup{}).Error; err != nil {
			return err
		}
		// 删除当前分组
		return tx.Delete(group).Error
	})
}

// CopySecurityGroup 复制分组
func CopySecurityGroup(id int64) (*model.SecurityGroup, error) {
	srcGroup, err := GetSecurityGroupById(id)
	if err != nil {
		return nil, errors.New("源分组不存在")
	}

	newGroup := &model.SecurityGroup{
		Name:        srcGroup.Name + "_copy",
		Description: srcGroup.Description,
		Status:      constant.SecurityStatusEnabled,
		ParentID:    srcGroup.ParentID,
		Depth:       srcGroup.Depth,
		Path:        srcGroup.Path, // 临时 path，创建后会更新
		SortOrder:   srcGroup.SortOrder,
		CreatedAt:   time.Now().Unix(),
		UpdatedAt:   time.Now().Unix(),
	}

	err = model.DB.Create(newGroup).Error
	if err != nil {
		return nil, err
	}

	// 更新 path
	newGroup.Path = fmt.Sprintf("%s/%d", srcGroup.Path, newGroup.ID)
	model.DB.Model(newGroup).Update("path", newGroup.Path)

	// 复制规则
	var rules []*model.SecurityRule
	model.DB.Where("group_id = ?", id).Find(&rules)
	for _, rule := range rules {
		newRule := &model.SecurityRule{
			GroupID:     newGroup.ID,
			Name:        rule.Name,
			Type:        rule.Type,
			Content:     rule.Content,
			ExtraConfig: rule.ExtraConfig,
			Action:      rule.Action,
			Priority:    rule.Priority,
			RiskScore:   rule.RiskScore,
			Status:      rule.Status,
			CreatedAt:   time.Now().Unix(),
			UpdatedAt:   time.Now().Unix(),
		}
		model.DB.Create(newRule)
	}

	return newGroup, nil
}

// GetSecurityGroupTree 获取分组树形结构
func GetSecurityGroupTree() ([]*model.SecurityGroup, error) {
	var groups []*model.SecurityGroup
	err := model.DB.Where("status = ?", constant.SecurityStatusEnabled).Order("sort_order ASC, id ASC").Find(&groups).Error
	return groups, err
}
