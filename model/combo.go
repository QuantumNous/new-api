package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Combo bundles multiple models with a routing strategy.
// Users reference a combo via model: "combo:<name>" in their requests.
type Combo struct {
	Id          int    `json:"id"`
	Name        string `json:"name" gorm:"uniqueIndex:idx_combo_name_user_id;type:varchar(128)"`
	UserId      int    `json:"user_id" gorm:"uniqueIndex:idx_combo_name_user_id;index"`
	Models      string `json:"models" gorm:"type:text"`         // CSV: "gpt-4,claude-3,gemini-pro"
	Strategy    string `json:"strategy" gorm:"type:varchar(32)"` // fallback | random | weighted | round_robin
	Weights     string `json:"weights" gorm:"type:text"`        // JSON: {"gpt-4":3,"claude-3":2}
	Status      int    `json:"status" gorm:"default:1"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
}

func (c *Combo) TableName() string {
	return "combos"
}

// Insert creates a new combo record.
func (c *Combo) Insert() error {
	c.CreatedTime = time.Now().Unix()
	return DB.Create(c).Error
}

// Update persists changes to an existing combo.
func (c *Combo) Update() error {
	return DB.Model(c).Updates(map[string]interface{}{
		"name":     c.Name,
		"models":   c.Models,
		"strategy": c.Strategy,
		"weights":  c.Weights,
		"status":   c.Status,
	}).Error
}

// Delete removes a combo by id.
func (c *Combo) Delete() error {
	return DB.Delete(c).Error
}

// GetComboById retrieves a combo by its primary key.
func GetComboById(id int) (*Combo, error) {
	var combo Combo
	err := DB.First(&combo, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &combo, nil
}

// GetComboByNameUserId retrieves a combo by its name and user id.
func GetComboByNameUserId(name string, userId int) (*Combo, error) {
	var combo Combo
	err := DB.First(&combo, "name = ? AND user_id = ?", name, userId).Error
	if err != nil {
		return nil, err
	}
	return &combo, nil
}

// GetComboByName retrieves a combo by its name (legacy).
// Deprecated: use GetComboByNameUserId for user-scoped lookups.
func GetComboByName(name string) (*Combo, error) {
	var combo Combo
	err := DB.First(&combo, "name = ?", name).Error
	if err != nil {
		return nil, err
	}
	return &combo, nil
}

// GetCombosByUserId returns all combos owned by a specific user.
func GetCombosByUserId(userId int) ([]*Combo, error) {
	var combos []*Combo
	err := DB.Where("user_id = ?", userId).Order("id DESC").Find(&combos).Error
	return combos, err
}

// GetAllCombos returns all combos in the system (admin view).
func GetAllCombos(pageInfo *common.PageInfo) ([]*Combo, int64, error) {
	var combos []*Combo
	var total int64

	query := DB.Model(&Combo{})
	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Order("id DESC").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&combos).Error
	return combos, total, err
}

// SearchCombos searches combos by name keyword.
func SearchCombos(keyword string, pageInfo *common.PageInfo) ([]*Combo, int64, error) {
	var combos []*Combo
	var total int64

	query := DB.Model(&Combo{}).Where("name LIKE ?", "%"+keyword+"%")
	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.Order("id DESC").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&combos).Error
	return combos, total, err
}

// DeleteComboById deletes a combo by id, optionally scoped to a user.
func DeleteComboById(id int, userId ...int) error {
	query := DB.Model(&Combo{})
	if len(userId) > 0 && userId[0] > 0 {
		query = query.Where("user_id = ?", userId[0])
	}
	query = query.Delete(&Combo{}, "id = ?", id)
	return query.Error
}

// GetComboCountByUserId returns the number of combos owned by a user.
func GetComboCountByUserId(userId int) (int64, error) {
	var count int64
	err := DB.Model(&Combo{}).Where("user_id = ?", userId).Count(&count).Error
	return count, err
}
