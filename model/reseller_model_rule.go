package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ResellerModelRule struct {
	Id            int     `json:"id" gorm:"primaryKey;autoIncrement"`
	ResellerId    int     `json:"reseller_user_id" gorm:"column:reseller_user_id;not null;uniqueIndex:idx_reseller_downline_model,priority:1;index"`
	DownlineId    int     `json:"downline_user_id" gorm:"column:downline_user_id;not null;uniqueIndex:idx_reseller_downline_model,priority:2;index"`
	ModelName     string  `json:"model_name" gorm:"type:varchar(256);not null;uniqueIndex:idx_reseller_downline_model,priority:3;index"`
	DiscountRatio float64 `json:"discount_ratio" gorm:"not null"`
	Enabled       bool    `json:"enabled" gorm:"type:bool;default:true;index"`
	CreatedAt     int64   `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt     int64   `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	CreatedBy     int     `json:"created_by" gorm:"column:created_by;default:0"`
	UpdatedBy     int     `json:"updated_by" gorm:"column:updated_by;default:0"`
}

func GetResellerRules(resellerId int, downlineId int) ([]ResellerModelRule, error) {
	if resellerId <= 0 {
		return nil, errors.New("分销商账号为空")
	}
	tx := DB.Where("reseller_user_id = ?", resellerId)
	if downlineId > 0 {
		tx = tx.Where("downline_user_id = ?", downlineId)
	}
	var rules []ResellerModelRule
	err := tx.Order("downline_user_id asc, model_name asc").Find(&rules).Error
	return rules, err
}

func GetEnabledResellerRule(resellerId int, downlineId int, modelName string) (*ResellerModelRule, error) {
	modelName = strings.TrimSpace(modelName)
	if resellerId <= 0 || downlineId <= 0 || modelName == "" {
		return nil, nil
	}
	var rule ResellerModelRule
	err := DB.Where("reseller_user_id = ? AND downline_user_id = ? AND model_name = ? AND enabled = ?",
		resellerId, downlineId, modelName, true).First(&rule).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func UpsertResellerRules(resellerId int, downlineId int, rules []ResellerModelRule, operatorId int) error {
	if resellerId <= 0 || downlineId <= 0 {
		return errors.New("分销商或下线账号为空")
	}
	if len(rules) == 0 {
		return errors.New("至少需要配置一个模型的折扣比例")
	}
	now := common.GetTimestamp()
	rows := make([]ResellerModelRule, 0, len(rules))
	for _, rule := range rules {
		modelName := strings.TrimSpace(rule.ModelName)
		if modelName == "" {
			return errors.New("模型名称不能为空")
		}
		if rule.DiscountRatio <= 0 || rule.DiscountRatio > 1 {
			return errors.New("折扣比例必须大于 0 且小于等于 1")
		}
		rows = append(rows, ResellerModelRule{
			ResellerId:    resellerId,
			DownlineId:    downlineId,
			ModelName:     modelName,
			DiscountRatio: rule.DiscountRatio,
			Enabled:       rule.Enabled,
			CreatedAt:     now,
			UpdatedAt:     now,
			CreatedBy:     operatorId,
			UpdatedBy:     operatorId,
		})
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "reseller_user_id"},
			{Name: "downline_user_id"},
			{Name: "model_name"},
		},
		DoUpdates: clause.AssignmentColumns([]string{
			"discount_ratio", "enabled", "updated_at", "updated_by",
		}),
	}).Create(&rows).Error
}
