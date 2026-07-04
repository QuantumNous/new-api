package model

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// CommissionRule 返佣规则表
type CommissionRule struct {
	Id              int            `json:"id" gorm:"primaryKey;autoIncrement"`
	RuleName        string         `json:"rule_name" gorm:"size:64;not null"`                    // 规则名称
	RuleCode        string         `json:"rule_code" gorm:"size:32;uniqueIndex;not null"`        // 规则代码

	// 规则类型
	RuleType        string         `json:"rule_type" gorm:"size:20;not null"`                    // percentage/fixed/hybrid

	// 返佣配置
	Level1Rate      float64        `json:"level1_rate" gorm:"type:decimal(5,4);default:0"`      // 一级返佣比例
	Level2Rate      float64        `json:"level2_rate" gorm:"type:decimal(5,4);default:0"`      // 二级返佣比例
	Level3Rate      float64        `json:"level3_rate" gorm:"type:decimal(5,4);default:0"`      // 三级返佣比例
	FixedAmount     int            `json:"fixed_amount" gorm:"default:0"`                       // 固定返佣金额（仅fixed类型）

	// 限制条件
	MinConsumption  int            `json:"min_consumption" gorm:"default:0"`                    // 最低消费门槛
	MaxCommission   int            `json:"max_commission" gorm:"default:0"`                     // 单次返佣上限（0=不限）
	DailyLimit      int            `json:"daily_limit" gorm:"default:0"`                        // 每日返佣上限（0=不限）
	MonthlyLimit    int            `json:"monthly_limit" gorm:"default:0"`                      // 每月返佣上限（0=不限）

	// 适用范围
	ApplicableModels string        `json:"applicable_models" gorm:"type:text"`                  // 适用模型（JSON数组，空=全部）
	ExcludedModels   string        `json:"excluded_models" gorm:"type:text"`                    // 排除模型（JSON数组）

	// 状态
	IsActive        bool           `json:"is_active" gorm:"default:true"`
	Priority        int            `json:"priority" gorm:"default:0"`                           // 优先级（数字越大优先级越高）

	// 时间
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
}

func (CommissionRule) TableName() string {
	return "commission_rules"
}

// CreateCommissionRule 创建返佣规则
func CreateCommissionRule(rule *CommissionRule) error {
	return DB.Create(rule).Error
}

// GetCommissionRuleById 根据ID获取返佣规则
func GetCommissionRuleById(id int) (*CommissionRule, error) {
	var rule CommissionRule
	err := DB.First(&rule, id).Error
	return &rule, err
}

// GetCommissionRuleByCode 根据代码获取返佣规则
func GetCommissionRuleByCode(code string) (*CommissionRule, error) {
	var rule CommissionRule
	err := DB.Where("rule_code = ? AND is_active = ?", code, true).First(&rule).Error
	return &rule, err
}

// GetAllCommissionRules 获取所有返佣规则
func GetAllCommissionRules(activeOnly bool) ([]CommissionRule, error) {
	var rules []CommissionRule
	query := DB.Model(&CommissionRule{})
	if activeOnly {
		query = query.Where("is_active = ?", true)
	}
	err := query.Order("priority DESC, created_at ASC").Find(&rules).Error
	return rules, err
}

// UpdateCommissionRule 更新返佣规则
func UpdateCommissionRule(rule *CommissionRule) error {
	return DB.Save(rule).Error
}

// DeleteCommissionRule 删除返佣规则（软删除）
func DeleteCommissionRule(id int) error {
	return DB.Delete(&CommissionRule{}, id).Error
}

// ToggleCommissionRule 切换返佣规则状态
func ToggleCommissionRule(id int, isActive bool) error {
	return DB.Model(&CommissionRule{}).
		Where("id = ?", id).
		Update("is_active", isActive).Error
}

// GetApplicableRule 获取适用的返佣规则
func GetApplicableRule(modelName string, consumption int) (*CommissionRule, error) {
	var rules []CommissionRule

	// 查询所有活跃规则，按优先级排序
	err := DB.Where("is_active = ?", true).
		Order("priority DESC").
		Find(&rules).Error
	if err != nil {
		return nil, err
	}

	// 找到第一个匹配的规则
	for _, rule := range rules {
		if rule.matches(modelName, consumption) {
			return &rule, nil
		}
	}

	// 返回默认规则（如果有）
	return getDefaultRule()
}

// matches 检查规则是否匹配
func (r *CommissionRule) matches(modelName string, consumption int) bool {
	// 检查消费门槛
	if consumption < r.MinConsumption {
		return false
	}

	// 检查适用模型
	if r.ApplicableModels != "" {
		var models []string
		if err := json.Unmarshal([]byte(r.ApplicableModels), &models); err == nil {
			found := false
			for _, model := range models {
				if model == modelName {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		}
	}

	// 检查排除模型
	if r.ExcludedModels != "" {
		var models []string
		if err := json.Unmarshal([]byte(r.ExcludedModels), &models); err == nil {
			for _, model := range models {
				if model == modelName {
					return false
				}
			}
		}
	}

	return true
}

// getDefaultRule 获取默认规则
func getDefaultRule() (*CommissionRule, error) {
	var rule CommissionRule
	err := DB.Where("rule_code = ?", "default").First(&rule).Error
	if err != nil {
		// 如果没有默认规则，返回一个基础规则
		return &CommissionRule{
			RuleName:   "Default",
			RuleCode:   "default",
			RuleType:   "percentage",
			Level1Rate: 0,
			Level2Rate: 0,
			Level3Rate: 0,
			IsActive:   true,
		}, nil
	}
	return &rule, nil
}

// GetDefaultCommissionRules 获取默认的返佣规则列表
func GetDefaultCommissionRules() []CommissionRule {
	return []CommissionRule{
		{
			RuleName:        "标准返佣规则",
			RuleCode:        "standard",
			RuleType:        "percentage",
			Level1Rate:      0.10, // 10%
			Level2Rate:      0.05, // 5%
			Level3Rate:      0.02, // 2%
			MinConsumption:  1000,
			MaxCommission:   50000,
			DailyLimit:      100000,
			MonthlyLimit:    1000000,
			IsActive:        false, // 安全默认：管理员显式启用
			Priority:        100,
		},
		{
			RuleName:        "高级返佣规则",
			RuleCode:        "premium",
			RuleType:        "percentage",
			Level1Rate:      0.15, // 15%
			Level2Rate:      0.08, // 8%
			Level3Rate:      0.03, // 3%
			MinConsumption:  5000,
			MaxCommission:   100000,
			DailyLimit:      200000,
			MonthlyLimit:    2000000,
			IsActive:        false, // 安全默认：管理员显式启用
			Priority:        200,
		},
		{
			RuleName:        "GPT-4专属规则",
			RuleCode:        "gpt4_special",
			RuleType:        "percentage",
			Level1Rate:      0.20, // 20%
			Level2Rate:      0.10, // 10%
			Level3Rate:      0.05, // 5%
			MinConsumption:  0,
			MaxCommission:   200000,
			DailyLimit:      500000,
			MonthlyLimit:    5000000,
			ApplicableModels: `["gpt-4", "gpt-4-turbo", "gpt-4o"]`,
			IsActive:        false, // 安全默认：管理员显式启用
			Priority:        300,
		},
	}
}

// SeedCommissionRules 初始化默认返佣规则（仅在表为空时插入）
func SeedCommissionRules() {
	var count int64
	DB.Model(&CommissionRule{}).Count(&count)
	if count > 0 {
		return
	}
	for _, r := range GetDefaultCommissionRules() {
		DB.Create(&r)
	}
}
