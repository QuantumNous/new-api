package security

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

const (
	SecurityRuleCacheKey    = "security:rules:group:%d"
	SecurityPolicyCacheKey  = "security:policies:user:%d"
	SecurityCacheExpiration = 5 * time.Minute
)

var (
	securityRuleCache    map[string][]*model.SecurityRule
	securityPolicyCache  map[string][]*model.SecurityPolicyWithGroup
	securityCacheMutex   sync.RWMutex
)

func init() {
	securityRuleCache = make(map[string][]*model.SecurityRule)
	securityPolicyCache = make(map[string][]*model.SecurityPolicyWithGroup)
}

// GetCachedRulesByGroupIds 从缓存获取规则（先查 Redis，再查内存，最后查数据库）
func GetCachedRulesByGroupIds(groupIds []int64) ([]*model.SecurityRule, error) {
	if len(groupIds) == 0 {
		return nil, nil
	}

	var allRules []*model.SecurityRule
	var missingGroupIds []int64

	// 尝试从缓存获取
	securityCacheMutex.RLock()
	for _, gid := range groupIds {
		key := fmt.Sprintf(SecurityRuleCacheKey, gid)
		if rules, ok := securityRuleCache[key]; ok {
			allRules = append(allRules, rules...)
		} else {
			missingGroupIds = append(missingGroupIds, gid)
		}
	}
	securityCacheMutex.RUnlock()

	// 从数据库加载缺失的规则
	if len(missingGroupIds) > 0 {
		dbRules, err := GetActiveRulesByGroupIds(missingGroupIds)
		if err != nil {
			return nil, err
		}

		// 按分组存入缓存
		groupRuleMap := make(map[int64][]*model.SecurityRule)
		for _, rule := range dbRules {
			groupRuleMap[rule.GroupID] = append(groupRuleMap[rule.GroupID], rule)
		}

		securityCacheMutex.Lock()
		for gid, rules := range groupRuleMap {
			key := fmt.Sprintf(SecurityRuleCacheKey, gid)
			securityRuleCache[key] = rules
			allRules = append(allRules, rules...)
		}
		securityCacheMutex.Unlock()
	}

	return allRules, nil
}

// GetCachedUserPolicies 从缓存获取用户策略
func GetCachedUserPolicies(userID int) ([]*model.SecurityPolicyWithGroup, error) {
	key := fmt.Sprintf(SecurityPolicyCacheKey, userID)

	securityCacheMutex.RLock()
	if policies, ok := securityPolicyCache[key]; ok {
		securityCacheMutex.RUnlock()
		return policies, nil
	}
	securityCacheMutex.RUnlock()

	// 从数据库加载
	policies, err := GetUserPolicies(userID)
	if err != nil {
		return nil, err
	}

	securityCacheMutex.Lock()
	securityPolicyCache[key] = policies
	securityCacheMutex.Unlock()

	return policies, nil
}

// InvalidateRuleCache 使规则缓存失效
func InvalidateRuleCache() {
	securityCacheMutex.Lock()
	securityRuleCache = make(map[string][]*model.SecurityRule)
	securityCacheMutex.Unlock()
	common.SysLog("安全规则缓存已清空")
}

// InvalidatePolicyCache 使策略缓存失效
func InvalidatePolicyCache() {
	securityCacheMutex.Lock()
	securityPolicyCache = make(map[string][]*model.SecurityPolicyWithGroup)
	securityCacheMutex.Unlock()
	common.SysLog("安全策略缓存已清空")
}

// InvalidateAllSecurityCache 使所有安全缓存失效
func InvalidateAllSecurityCache() {
	securityCacheMutex.Lock()
	securityRuleCache = make(map[string][]*model.SecurityRule)
	securityPolicyCache = make(map[string][]*model.SecurityPolicyWithGroup)
	securityCacheMutex.Unlock()
	common.SysLog("所有安全缓存已清空")
}

// IsSecurityEnabled 检查安全模块是否启用
func IsSecurityEnabled() bool {
	return common.GetEnvOrDefaultString(constant.SecurityEnvEnabled, "true") == "true"
}

// GetSecurityStatus 获取安全模块状态
func GetSecurityStatus() (*dto.SecurityStatusResponse, error) {
	var groupCount, ruleCount, policyCount int64

	model.DB.Model(&model.SecurityGroup{}).Where("status = ?", constant.SecurityStatusEnabled).Count(&groupCount)
	model.DB.Model(&model.SecurityRule{}).Where("status = ?", constant.SecurityStatusEnabled).Count(&ruleCount)
	model.DB.Model(&model.SecurityUserPolicy{}).Where("status = ?", constant.SecurityStatusEnabled).Count(&policyCount)

	return &dto.SecurityStatusResponse{
		Enabled:      IsSecurityEnabled(),
		RuleCount:    ruleCount,
		GroupCount:   groupCount,
		PolicyCount:  policyCount,
		CacheEnabled: true,
	}, nil
}
