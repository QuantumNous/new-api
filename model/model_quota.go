package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/bytedance/gopkg/util/gopool"
	"gorm.io/gorm"
)

// Match modes
const (
	ModelQuotaMatchModeExact  = "exact"
	ModelQuotaMatchModePrefix = "prefix"
)

// Rule sources
const (
	ModelQuotaRuleSourceGroup = "group"
	ModelQuotaRuleSourcePlan  = "plan"
)

// Usage status
const (
	ModelQuotaUsageStatusActive  = "active"
	ModelQuotaUsageStatusExpired = "expired"
)

// ---------------------------------------------------------------------------
// ModelQuotaGroupRule — 分组级规则定义
// ---------------------------------------------------------------------------

type ModelQuotaGroupRule struct {
	Id           int    `json:"id" gorm:"primaryKey"`
	GroupName    string `json:"group_name" gorm:"column:group_name;type:varchar(64);not null;index:idx_group_rules"`
	ModelPattern string `json:"model_pattern" gorm:"column:model_pattern;type:varchar(128);not null"`
	MatchMode    string `json:"match_mode" gorm:"column:match_mode;type:varchar(16);not null;default:'exact'"`
	QuotaLimit   int64  `json:"quota_limit" gorm:"column:quota_limit;type:bigint;not null;default:0"`
	Enabled      bool   `json:"enabled" gorm:"column:enabled;index:idx_group_rules"`
	SortOrder    int    `json:"sort_order" gorm:"column:sort_order;type:int;default:0"`
	CreatedAt    int64  `json:"created_at" gorm:"column:created_at;type:bigint"`
	UpdatedAt    int64  `json:"updated_at" gorm:"column:updated_at;type:bigint"`
}

func (r *ModelQuotaGroupRule) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *ModelQuotaGroupRule) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

func (r *ModelQuotaGroupRule) TableName() string {
	return "model_quota_group_rules"
}

// GetModelQuotaGroupRulesByGroup returns all enabled rules for a given group, ordered by sort_order
func GetModelQuotaGroupRulesByGroup(groupName string) ([]*ModelQuotaGroupRule, error) {
	var rules []*ModelQuotaGroupRule
	err := DB.Where("group_name = ? AND enabled = ?", groupName, true).
		Order("sort_order ASC, id ASC").
		Find(&rules).Error
	return rules, err
}

// ---------------------------------------------------------------------------
// ModelQuotaPlanRule — 套餐级规则定义
// ---------------------------------------------------------------------------

type ModelQuotaPlanRule struct {
	Id           int    `json:"id" gorm:"primaryKey"`
	PlanId       int    `json:"plan_id" gorm:"column:plan_id;type:int;not null;index:idx_plan_rules"`
	ModelPattern string `json:"model_pattern" gorm:"column:model_pattern;type:varchar(128);not null"`
	MatchMode    string `json:"match_mode" gorm:"column:match_mode;type:varchar(16);not null;default:'exact'"`
	QuotaLimit   int64  `json:"quota_limit" gorm:"column:quota_limit;type:bigint;not null;default:0"`
	Enabled      bool   `json:"enabled" gorm:"column:enabled;index:idx_plan_rules"`
	SortOrder    int    `json:"sort_order" gorm:"column:sort_order;type:int;default:0"`
	CreatedAt    int64  `json:"created_at" gorm:"column:created_at;type:bigint"`
	UpdatedAt    int64  `json:"updated_at" gorm:"column:updated_at;type:bigint"`
}

func (r *ModelQuotaPlanRule) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *ModelQuotaPlanRule) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

func (r *ModelQuotaPlanRule) TableName() string {
	return "model_quota_plan_rules"
}

// GetModelQuotaPlanRulesByPlanId returns all enabled rules for a given plan, ordered by sort_order
func GetModelQuotaPlanRulesByPlanId(planId int) ([]*ModelQuotaPlanRule, error) {
	var rules []*ModelQuotaPlanRule
	err := DB.Where("plan_id = ? AND enabled = ?", planId, true).
		Order("sort_order ASC, id ASC").
		Find(&rules).Error
	return rules, err
}

// ---------------------------------------------------------------------------
// UserModelQuotaUsage — 用户级实时消耗计数器
// ---------------------------------------------------------------------------

type UserModelQuotaUsage struct {
	Id             int    `json:"id" gorm:"primaryKey"`
	UserId         int    `json:"user_id" gorm:"column:user_id;type:int;not null;index:idx_user_period,priority:1"`
	RuleId         int    `json:"rule_id" gorm:"column:rule_id;type:int;not null"`
	RuleSource     string `json:"rule_source" gorm:"column:rule_source;type:varchar(16);not null;default:'group'"`
	ModelPattern   string `json:"model_pattern" gorm:"column:model_pattern;type:varchar(128);not null"`
	SubscriptionId int    `json:"subscription_id" gorm:"column:subscription_id;type:int;default:0"`
	QuotaLimit     int64  `json:"quota_limit" gorm:"column:quota_limit;type:bigint;not null;default:0"`
	QuotaUsed      int64  `json:"quota_used" gorm:"column:quota_used;type:bigint;not null;default:0"`
	PeriodStart    int64  `json:"period_start" gorm:"column:period_start;type:bigint"`
	PeriodEnd      int64  `json:"period_end" gorm:"column:period_end;type:bigint;index:idx_user_period,priority:2"`
	Status         string `json:"status" gorm:"column:status;type:varchar(16);not null;default:'active';index:idx_user_period,priority:3"`
	CreatedAt      int64  `json:"created_at" gorm:"column:created_at;type:bigint"`
	UpdatedAt      int64  `json:"updated_at" gorm:"column:updated_at;type:bigint"`
}

func (u *UserModelQuotaUsage) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	u.CreatedAt = now
	u.UpdatedAt = now
	return nil
}

func (u *UserModelQuotaUsage) BeforeUpdate(tx *gorm.DB) error {
	u.UpdatedAt = common.GetTimestamp()
	return nil
}

func (u *UserModelQuotaUsage) TableName() string {
	return "user_model_quota_usage"
}

// GetActiveUserModelQuotaUsage returns all active usage records for a user
func GetActiveUserModelQuotaUsage(userId int) ([]*UserModelQuotaUsage, error) {
	var usages []*UserModelQuotaUsage
	err := DB.Where("user_id = ? AND status = ?", userId, ModelQuotaUsageStatusActive).
		Find(&usages).Error
	return usages, err
}

// GetUserModelQuotaUsageByUserAndRule returns the active usage for a specific user+rule combination
func GetUserModelQuotaUsageByUserAndRule(userId int, ruleId int, ruleSource string) (*UserModelQuotaUsage, error) {
	var usage UserModelQuotaUsage
	err := DB.Where("user_id = ? AND rule_id = ? AND rule_source = ? AND status = ?",
		userId, ruleId, ruleSource, ModelQuotaUsageStatusActive).
		First(&usage).Error
	if err != nil {
		return nil, err
	}
	return &usage, nil
}

// GetUserModelQuotaUsageByUserId returns all usage records (including expired) for a user
func GetUserModelQuotaUsageByUserId(userId int) ([]*UserModelQuotaUsage, error) {
	var usages []*UserModelQuotaUsage
	err := DB.Where("user_id = ?", userId).
		Order("status DESC, updated_at DESC").
		Find(&usages).Error
	return usages, err
}

// IncreaseUserModelQuotaUsage atomically increments quota_used by delta
func IncreaseUserModelQuotaUsage(usageId int, delta int64) error {
	// Redis cache update (async, non-blocking)
	gopool.Go(func() {
		CacheIncrModelQuotaUsage(usageId, delta)
	})

	if common.BatchUpdateEnabled {
		addNewRecord(BatchUpdateTypeModelQuotaUsage, usageId, int(delta))
		return nil
	}

	return increaseModelQuotaUsageDB(usageId, delta)
}

func increaseModelQuotaUsageDB(usageId int, delta int64) error {
	return DB.Model(&UserModelQuotaUsage{}).
		Where("id = ?", usageId).
		UpdateColumn("quota_used", gorm.Expr("quota_used + ?", delta)).Error
}

// ResetUserModelQuotaUsage resets quota_used to 0
func ResetUserModelQuotaUsage(usageId int) error {
	// Invalidate Redis cache
	CacheDeleteModelQuotaUsage(usageId)

	return DB.Model(&UserModelQuotaUsage{}).
		Where("id = ?", usageId).
		UpdateColumn("quota_used", 0).Error
}

// ExpireUserModelQuotaUsage marks a usage record as expired
func ExpireUserModelQuotaUsage(usageId int) error {
	CacheDeleteModelQuotaUsage(usageId)

	return DB.Model(&UserModelQuotaUsage{}).
		Where("id = ?", usageId).
		UpdateColumn("status", ModelQuotaUsageStatusExpired).Error
}

// BatchUpdateModelQuotaUsage is called by the batch updater to flush accumulated deltas
func BatchUpdateModelQuotaUsage(store map[int]int) {
	for usageId, delta := range store {
		if err := increaseModelQuotaUsageDB(usageId, int64(delta)); err != nil {
			common.SysLog("failed to batch update model quota usage: " + err.Error())
		}
	}
}
