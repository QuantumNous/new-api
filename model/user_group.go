package model

import (
	"one-api/common"
	"gorm.io/gorm"
)

type UserGroup struct {
	Id          int            `json:"id"`
	Name        string         `json:"name" gorm:"size:64;not null;uniqueIndex:uk_user_group_name,where:deleted_at IS NULL"`
	Description string         `json:"description,omitempty" gorm:"type:varchar(255)"`
	Ratio       float64        `json:"ratio" gorm:"default:1.0"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

// Insert 创建新的用户分组
func (g *UserGroup) Insert() error {
	now := common.GetTimestamp()
	g.CreatedTime = now
	g.UpdatedTime = now
	return DB.Create(g).Error
}

// Update 更新用户分组
 func (g *UserGroup) Update() error {
	g.UpdatedTime = common.GetTimestamp()
	return DB.Model(&UserGroup{}).
		Where("id = ?", g.Id).
		Updates(map[string]any{
			"name":         g.Name,
			"description":  g.Description,
			"ratio":        g.Ratio,
			"updated_time": g.UpdatedTime,
		}).Error
 }

// UpdateTx 在事务中更新用户分组
func (g *UserGroup) UpdateTx(tx *gorm.DB) error {
	g.UpdatedTime = common.GetTimestamp()
	return tx.Model(g).Updates(g).Error
}

// Delete 硬删除用户分组
func (g *UserGroup) Delete() error {
	return DB.Unscoped().Delete(g).Error
}

// GetAllUserGroups 获取所有用户分组
func GetAllUserGroups() ([]*UserGroup, error) {
	var groups []*UserGroup
	err := DB.Order("created_time desc").Find(&groups).Error
	return groups, err
}

// GetUserGroupById 根据ID获取用户分组
func GetUserGroupById(id int) (*UserGroup, error) {
	var group UserGroup
	err := DB.First(&group, id).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

// GetUserGroupByName 根据名称获取用户分组
func GetUserGroupByName(name string) (*UserGroup, error) {
	var group UserGroup
	err := DB.Where("name = ?", name).First(&group).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

// IsUserGroupNameDuplicated 检查用户分组名称是否重复
func IsUserGroupNameDuplicated(id int, name string) (bool, error) {
	var count int64
	query := DB.Model(&UserGroup{}).Where("name = ?", name)
	if id != 0 {
		query = query.Where("id != ?", id)
	}
	err := query.Count(&count).Error
	return count > 0, err
}

// IsUserGroupInUse 检查用户分组是否正在被使用
func IsUserGroupInUse(name string) (bool, error) {
	var count int64
	err := DB.Model(&User{}).Where("`group` = ?", name).Count(&count).Error
	return count > 0, err
}

// GetUserGroupNames 获取所有用户分组名称
func GetUserGroupNames() ([]string, error) {
	var names []string
	err := DB.Model(&UserGroup{}).Pluck("name", &names).Error
	return names, err
}

// InitDefaultUserGroups 初始化默认用户分组
func InitDefaultUserGroups() error {
	// 检查是否已经存在默认分组
	var count int64
	DB.Model(&UserGroup{}).Count(&count)
	if count > 0 {
		return nil // 已经有分组了，不需要初始化
	}

	// 创建默认分组
	defaultGroups := []*UserGroup{
		{
			Name:        "default",
			Description: "默认分组",
			Ratio:       1.0,
		},
		{
			Name:        "vip",
			Description: "VIP分组",
			Ratio:       1.0,
		},
		{
			Name:        "svip",
			Description: "SVIP分组",
			Ratio:       1.0,
		},
	}

	for _, group := range defaultGroups {
		if err := group.Insert(); err != nil {
			return err
		}
	}

	return nil
}


