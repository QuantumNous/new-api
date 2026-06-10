package security

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/dlclark/regexp2"
)

// GetSecurityRuleById 根据ID获取规则
func GetSecurityRuleById(id int64) (*model.SecurityRule, error) {
	var rule model.SecurityRule
	err := model.DB.Where("id = ?", id).First(&rule).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

// GetSecurityRules 获取规则列表
func GetSecurityRules(page, pageSize int, groupID int64, ruleType int, status int) ([]*model.SecurityRuleWithGroup, int64, error) {
	var rules []*model.SecurityRuleWithGroup
	var count int64

	db := model.DB.Model(&model.SecurityRule{}).Select("security_rules.*, security_groups.name as group_name").
		Joins("LEFT JOIN security_groups ON security_rules.group_id = security_groups.id")

	if groupID > 0 {
		db = db.Where("security_rules.group_id = ?", groupID)
	}
	if ruleType > 0 {
		db = db.Where("security_rules.type = ?", ruleType)
	}
	if status >= 0 {
		db = db.Where("security_rules.status = ?", status)
	}

	err := db.Count(&count).Error
	if err != nil {
		return nil, 0, err
	}

	err = db.Order("security_rules.priority DESC, security_rules.id ASC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&rules).Error
	if err != nil {
		return nil, 0, err
	}

	return rules, count, nil
}

// CreateSecurityRule 创建规则
func CreateSecurityRule(req *dto.SecurityRuleRequest) (*model.SecurityRule, error) {
	// 验证分组存在
	_, err := GetSecurityGroupById(req.GroupID)
	if err != nil {
		return nil, errors.New("所属分组不存在")
	}

	// 验证正则表达式语法
	if req.Type == constant.SecurityRuleTypeRegex {
		_, err := regexp2.Compile(req.Content, 0)
		if err != nil {
			return nil, fmt.Errorf("正则表达式语法错误: %v", err)
		}
	}

	rule := &model.SecurityRule{
		GroupID:     req.GroupID,
		Name:        req.Name,
		Type:        req.Type,
		Content:     req.Content,
		ExtraConfig: req.ExtraConfig,
		Action:      req.Action,
		Priority:    req.Priority,
		RiskScore:   req.RiskScore,
		Status:      constant.SecurityStatusEnabled,
		CreatedAt:   time.Now().Unix(),
		UpdatedAt:   time.Now().Unix(),
	}

	err = model.DB.Create(rule).Error
	if err != nil {
		return nil, err
	}

	// 刷新缓存
	InvalidateRuleCache()

	return rule, nil
}

// UpdateSecurityRule 更新规则
func UpdateSecurityRule(id int64, req *dto.SecurityRuleRequest) error {
	rule, err := GetSecurityRuleById(id)
	if err != nil {
		return errors.New("规则不存在")
	}

	// 验证正则表达式语法
	if req.Type == constant.SecurityRuleTypeRegex {
		_, err := regexp2.Compile(req.Content, 0)
		if err != nil {
			return fmt.Errorf("正则表达式语法错误: %v", err)
		}
	}

	updates := map[string]interface{}{
		"group_id":     req.GroupID,
		"name":         req.Name,
		"type":         req.Type,
		"content":      req.Content,
		"extra_config": req.ExtraConfig,
		"action":       req.Action,
		"priority":     req.Priority,
		"risk_score":   req.RiskScore,
		"updated_at":   time.Now().Unix(),
	}

	err = model.DB.Model(rule).Updates(updates).Error
	if err != nil {
		return err
	}

	InvalidateRuleCache()
	return nil
}

// DeleteSecurityRule 删除规则
func DeleteSecurityRule(id int64) error {
	rule, err := GetSecurityRuleById(id)
	if err != nil {
		return errors.New("规则不存在")
	}

	err = model.DB.Delete(rule).Error
	if err != nil {
		return err
	}

	InvalidateRuleCache()
	return nil
}

// GetActiveRulesByGroupIds 根据分组ID列表获取启用的规则
func GetActiveRulesByGroupIds(groupIds []int64) ([]*model.SecurityRule, error) {
	var rules []*model.SecurityRule
	err := model.DB.Where("group_id IN (?) AND status = ?", groupIds, constant.SecurityStatusEnabled).
		Order("priority DESC, id ASC").Find(&rules).Error
	return rules, err
}

// ValidateRuleContent 验证规则内容
func ValidateRuleContent(ruleType int, content string) error {
	switch ruleType {
	case constant.SecurityRuleTypeKeyword:
		if strings.TrimSpace(content) == "" {
			return errors.New("关键词内容不能为空")
		}
	case constant.SecurityRuleTypeRegex:
		_, err := regexp2.Compile(content, 0)
		if err != nil {
			return fmt.Errorf("正则表达式语法错误: %v", err)
		}
	case constant.SecurityRuleTypeNER, constant.SecurityRuleTypeAI:
		if strings.TrimSpace(content) == "" {
			return errors.New("规则内容不能为空")
		}
	default:
		return errors.New("未知的规则类型")
	}
	return nil
}
