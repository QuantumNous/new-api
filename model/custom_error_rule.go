package model

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// CustomErrorRule 定义 API 错误消息的匹配和替换规则。
// 规则缓存在内存中，增删改操作后自动刷新缓存。
type CustomErrorRule struct {
	Id          int            `json:"id" gorm:"primaryKey;autoIncrement"`
	Contains    string         `json:"contains" gorm:"type:varchar(512);not null;default:''"`
	StatusCode  int            `json:"status_code" gorm:"not null;default:0"`
	NewMessage  string         `json:"new_message" gorm:"type:varchar(1024);not null;default:''"`
	Enabled     bool           `json:"enabled" gorm:"not null;default:true"`
	Priority    int            `json:"priority" gorm:"not null;default:0"`
	CreatedTime int64          `json:"created_time" gorm:"type:bigint"`
	UpdatedTime int64          `json:"updated_time" gorm:"type:bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

// TableName 返回 CustomErrorRule 的数据库表名。
func (CustomErrorRule) TableName() string {
	return "custom_error_rules"
}

// 已启用规则的内存缓存
var (
	customErrorRulesCache        []CustomErrorRule
	customErrorReplacementsCache []common.CustomErrorReplacement
	customErrorRulesCacheLock    sync.RWMutex
	customErrorRulesCacheInit    bool
)

// GetCachedCustomErrorRules 返回缓存中已启用的规则，按优先级排序。
func GetCachedCustomErrorRules() []CustomErrorRule {
	customErrorRulesCacheLock.RLock()
	if customErrorRulesCacheInit {
		rules := customErrorRulesCache
		customErrorRulesCacheLock.RUnlock()
		return rules
	}
	customErrorRulesCacheLock.RUnlock()

	// Initialize cache
	refreshCustomErrorRulesCache()

	customErrorRulesCacheLock.RLock()
	defer customErrorRulesCacheLock.RUnlock()
	return customErrorRulesCache
}

// refreshCustomErrorRulesCache 从数据库重新加载已启用的规则到缓存。
// 同时构建 []common.CustomErrorReplacement 缓存，避免每次请求重复分配。
func refreshCustomErrorRulesCache() {
	var rules []CustomErrorRule
	err := DB.Where("enabled = ?", true).Order("priority ASC").Find(&rules).Error
	if err != nil {
		common.SysLog("failed to load custom error rules: " + err.Error())
		return
	}

	replacements := make([]common.CustomErrorReplacement, len(rules))
	for i, r := range rules {
		replacements[i] = common.CustomErrorReplacement{
			Contains:   r.Contains,
			StatusCode: r.StatusCode,
			NewMessage: r.NewMessage,
		}
	}

	customErrorRulesCacheLock.Lock()
	defer customErrorRulesCacheLock.Unlock()
	customErrorRulesCache = rules
	customErrorReplacementsCache = replacements
	customErrorRulesCacheInit = true
}

// GetCachedCustomErrorReplacements 返回缓存中预构建的替换规则列表，避免每次请求重新分配。
func GetCachedCustomErrorReplacements() []common.CustomErrorReplacement {
	customErrorRulesCacheLock.RLock()
	if customErrorRulesCacheInit {
		result := customErrorReplacementsCache
		customErrorRulesCacheLock.RUnlock()
		return result
	}
	customErrorRulesCacheLock.RUnlock()

	refreshCustomErrorRulesCache()

	customErrorRulesCacheLock.RLock()
	defer customErrorRulesCacheLock.RUnlock()
	return customErrorReplacementsCache
}

// GetAllCustomErrorRules 返回所有规则（包括已禁用的），供管理员管理使用。
func GetAllCustomErrorRules() ([]CustomErrorRule, error) {
	var rules []CustomErrorRule
	err := DB.Order("priority ASC").Find(&rules).Error
	return rules, err
}

// CreateCustomErrorRule 创建新规则并刷新缓存。
func CreateCustomErrorRule(rule *CustomErrorRule) error {
	now := time.Now().Unix()
	rule.CreatedTime = now
	rule.UpdatedTime = now
	err := DB.Create(rule).Error
	if err == nil {
		refreshCustomErrorRulesCache()
	}
	return err
}

// UpdateCustomErrorRule 更新已有规则并刷新缓存。
func UpdateCustomErrorRule(rule *CustomErrorRule) error {
	rule.UpdatedTime = time.Now().Unix()
	// Use map to ensure zero-value fields like Enabled=false are updated
	err := DB.Model(&CustomErrorRule{}).Where("id = ?", rule.Id).Updates(map[string]interface{}{
		"contains":     rule.Contains,
		"status_code":  rule.StatusCode,
		"new_message":  rule.NewMessage,
		"enabled":      rule.Enabled,
		"priority":     rule.Priority,
		"updated_time": rule.UpdatedTime,
	}).Error
	if err == nil {
		refreshCustomErrorRulesCache()
	}
	return err
}

// DeleteCustomErrorRule 根据 ID 软删除规则并刷新缓存。
func DeleteCustomErrorRule(id int) error {
	err := DB.Delete(&CustomErrorRule{}, id).Error
	if err == nil {
		refreshCustomErrorRulesCache()
	}
	return err
}

// InitCustomErrorRulesCache 在启动时初始化缓存。
// 如果表中无任何记录（包括已软删除的），则插入一条示例规则。
func InitCustomErrorRulesCache() {
	var count int64
	DB.Unscoped().Model(&CustomErrorRule{}).Count(&count)
	if count == 0 {
		seedDefaultErrorRules()
	}
	refreshCustomErrorRulesCache()
}

// seedDefaultErrorRules 插入一条示例规则供参考。
func seedDefaultErrorRules() {
	now := time.Now().Unix()
	sample := CustomErrorRule{
		Contains:    "当前分组上游负载已饱和",
		StatusCode:  429,
		NewMessage:  "当前服务繁忙，请稍后重试",
		Enabled:     true,
		Priority:    1,
		CreatedTime: now,
		UpdatedTime: now,
	}
	DB.Create(&sample)
}
