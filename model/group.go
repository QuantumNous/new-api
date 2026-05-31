package model

import (
	"strings"

	"gorm.io/gorm"
)

type Group struct {
	Id             uint    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name           string  `json:"name" gorm:"type:varchar(64);uniqueIndex;not null"`
	Ratio          float64 `json:"ratio" gorm:"default:1"`
	SortOrder      int     `json:"sort_order" gorm:"default:0"`
	Category       string  `json:"category" gorm:"type:varchar(64);default:''"`
	UserSelectable bool    `json:"user_selectable" gorm:"default:false"`
	Description    string  `json:"description" gorm:"type:text"`
	AllowedPaths   string  `json:"allowed_paths" gorm:"type:text;default:''"`
	CreatedAt      int64   `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt      int64   `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

func (g *Group) GetAllowedPathsList() []string {
	if g.AllowedPaths == "" {
		return nil
	}
	parts := strings.Split(g.AllowedPaths, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func (g *Group) IsPathAllowed(requestPath string) bool {
	paths := g.GetAllowedPathsList()
	if paths == nil {
		return true
	}
	for _, p := range paths {
		if strings.HasPrefix(requestPath, p) {
			return true
		}
	}
	return false
}

func (Group) TableName() string {
	return "api_groups"
}

type GroupSortOrder struct {
	Id        uint `json:"id"`
	SortOrder int  `json:"sort_order"`
}

func GetAllGroups() ([]Group, error) {
	var groups []Group
	err := DB.Order("sort_order ASC, id ASC").Find(&groups).Error
	return groups, err
}

func GetGroupByName(name string) (*Group, error) {
	var group Group
	err := DB.Where("name = ?", name).First(&group).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

func GetGroupById(id uint) (*Group, error) {
	var group Group
	err := DB.First(&group, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

func CreateGroup(group *Group) error {
	return DB.Create(group).Error
}

func UpdateGroup(group *Group) error {
	return DB.Save(group).Error
}

func DeleteGroup(id uint) error {
	return DB.Delete(&Group{}, "id = ?", id).Error
}

// DeleteGroupTx deletes a group and all aliases pointing to it atomically.
func DeleteGroupTx(id uint) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var group Group
		if err := tx.First(&group, "id = ?", id).Error; err != nil {
			return err
		}
		if err := tx.Delete(&GroupAlias{}, "target_group = ?", group.Name).Error; err != nil {
			return err
		}
		return tx.Delete(&Group{}, "id = ?", id).Error
	})
}

func UpdateGroupSortOrders(orders []GroupSortOrder) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		for _, o := range orders {
			if err := tx.Model(&Group{}).Where("id = ?", o.Id).Update("sort_order", o.SortOrder).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func GetGroupCategories() ([]string, error) {
	var categories []string
	err := DB.Model(&Group{}).Where("category != ''").Distinct("category").Pluck("category", &categories).Error
	return categories, err
}

func GetGroupCount() (int64, error) {
	var count int64
	err := DB.Model(&Group{}).Count(&count).Error
	return count, err
}

// RenameGroupTx renames a group and atomically:
//  1. updates all aliases pointing to oldName to point to newName
//  2. creates (or updates) an alias oldName -> newName for backward compatibility
func RenameGroupTx(group *Group, oldName string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(group).Error; err != nil {
			return err
		}

		// Re-point existing aliases that targeted the old name
		var pointingAliases []GroupAlias
		if err := tx.Where("target_group = ?", oldName).Find(&pointingAliases).Error; err != nil {
			return err
		}
		for i := range pointingAliases {
			pointingAliases[i].TargetGroup = group.Name
			if err := tx.Save(&pointingAliases[i]).Error; err != nil {
				return err
			}
		}

		// Create backward-compat alias oldName -> newName only if no alias exists yet.
		// If an admin already configured oldName -> someOtherGroup, preserve that.
		var existingAlias GroupAlias
		err := tx.Where("alias = ?", oldName).First(&existingAlias).Error
		if err != nil {
			// not found — create
			newAlias := GroupAlias{Alias: oldName, TargetGroup: group.Name}
			if err := tx.Create(&newAlias).Error; err != nil {
				return err
			}
		}
		// already exists — leave it untouched to preserve admin configuration
		return nil
	})
}
