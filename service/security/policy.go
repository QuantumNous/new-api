package security

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// GetSecurityPolicyById 根据ID获取策略
func GetSecurityPolicyById(id int64) (*model.SecurityUserPolicy, error) {
	var policy model.SecurityUserPolicy
	err := model.DB.Where("id = ?", id).First(&policy).Error
	if err != nil {
		return nil, err
	}
	return &policy, nil
}

// GetSecurityPolicies 获取策略列表
func GetSecurityPolicies(page, pageSize int, userID int, status int) ([]*model.SecurityPolicyWithGroup, int64, error) {
	var policies []*model.SecurityPolicyWithGroup
	var count int64

	db := model.DB.Model(&model.SecurityUserPolicy{}).
		Select("security_user_policies.*, users.username as user_name, security_groups.name as group_name").
		Joins("LEFT JOIN users ON security_user_policies.user_id = users.id").
		Joins("LEFT JOIN security_groups ON security_user_policies.group_id = security_groups.id")

	if userID > 0 {
		db = db.Where("security_user_policies.user_id = ?", userID)
	}
	if status >= 0 {
		db = db.Where("security_user_policies.status = ?", status)
	}

	err := db.Count(&count).Error
	if err != nil {
		return nil, 0, err
	}

	err = db.Order("security_user_policies.id DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&policies).Error
	if err != nil {
		return nil, 0, err
	}

	return policies, count, nil
}

// CreateSecurityPolicy 创建策略
func CreateSecurityPolicy(req *dto.SecurityPolicyRequest) (*model.SecurityUserPolicy, error) {
	// 验证用户存在
	var user model.User
	if err := model.DB.Where("id = ?", req.UserID).First(&user).Error; err != nil {
		return nil, errors.New("用户不存在")
	}

	// 验证分组存在
	_, err := GetSecurityGroupById(req.GroupID)
	if err != nil {
		return nil, errors.New("分组不存在")
	}

	// 检查是否已存在相同绑定
	var existing model.SecurityUserPolicy
	if err := model.DB.Where("user_id = ? AND group_id = ?", req.UserID, req.GroupID).First(&existing).Error; err == nil {
		return nil, errors.New("该用户已绑定此分组")
	}

	policy := &model.SecurityUserPolicy{
		UserID:         req.UserID,
		GroupID:        req.GroupID,
		Scope:          req.Scope,
		DefaultAction:  req.DefaultAction,
		CustomResponse: req.CustomResponse,
		WhitelistIPs:   req.WhitelistIPs,
		Status:         constant.SecurityStatusEnabled,
		CreatedAt:      time.Now().Unix(),
		UpdatedAt:      time.Now().Unix(),
	}

	err = model.DB.Create(policy).Error
	if err != nil {
		return nil, err
	}

	InvalidatePolicyCache()
	return policy, nil
}

// UpdateSecurityPolicy 更新策略
func UpdateSecurityPolicy(id int64, req *dto.SecurityPolicyRequest) error {
	policy, err := GetSecurityPolicyById(id)
	if err != nil {
		return errors.New("策略不存在")
	}

	updates := map[string]interface{}{
		"scope":           req.Scope,
		"default_action":  req.DefaultAction,
		"custom_response": req.CustomResponse,
		"whitelist_ips":   req.WhitelistIPs,
		"updated_at":      time.Now().Unix(),
	}

	err = model.DB.Model(policy).Updates(updates).Error
	if err != nil {
		return err
	}

	InvalidatePolicyCache()
	return nil
}

// DeleteSecurityPolicy 删除策略
func DeleteSecurityPolicy(id int64) error {
	policy, err := GetSecurityPolicyById(id)
	if err != nil {
		return errors.New("策略不存在")
	}

	err = model.DB.Delete(policy).Error
	if err != nil {
		return err
	}

	InvalidatePolicyCache()
	return nil
}

// GetUserPolicies 获取用户的所有策略
func GetUserPolicies(userID int) ([]*model.SecurityPolicyWithGroup, error) {
	var policies []*model.SecurityPolicyWithGroup
	err := model.DB.Model(&model.SecurityUserPolicy{}).
		Select("security_user_policies.*, users.username as user_name, security_groups.name as group_name").
		Joins("LEFT JOIN users ON security_user_policies.user_id = users.id").
		Joins("LEFT JOIN security_groups ON security_user_policies.group_id = security_groups.id").
		Where("security_user_policies.user_id = ? AND security_user_policies.status = ?", userID, constant.SecurityStatusEnabled).
		Find(&policies).Error
	return policies, err
}

// GetUserEffectiveGroups 获取用户生效的所有分组ID（包含策略绑定和子分组）
func GetUserEffectiveGroups(userID int) ([]int64, error) {
	policies, err := GetUserPolicies(userID)
	if err != nil {
		return nil, err
	}

	groupIdMap := make(map[int64]bool)
	for _, policy := range policies {
		groupIdMap[policy.GroupID] = true
		// 获取子分组
		var childGroups []*model.SecurityGroup
		model.DB.Where("path LIKE ?", "%/"+string(rune(policy.GroupID))+"/%").Find(&childGroups)
		for _, child := range childGroups {
			groupIdMap[child.ID] = true
		}
	}

	var groupIds []int64
	for id := range groupIdMap {
		groupIds = append(groupIds, id)
	}
	return groupIds, nil
}
