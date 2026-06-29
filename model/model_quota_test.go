package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

// --- ModelQuotaGroupRule tests ---

func TestCreateModelQuotaGroupRule(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&ModelQuotaGroupRule{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM model_quota_group_rules")
	})

	rule := &ModelQuotaGroupRule{
		GroupName:    "default",
		ModelPattern: "gpt-5.5",
		MatchMode:    ModelQuotaMatchModeExact,
		QuotaLimit:   500000,
		Enabled:      true,
		SortOrder:    0,
	}
	require.NoError(t, DB.Create(rule).Error)
	require.NotZero(t, rule.Id)

	var fetched ModelQuotaGroupRule
	require.NoError(t, DB.First(&fetched, rule.Id).Error)
	require.Equal(t, "default", fetched.GroupName)
	require.Equal(t, "gpt-5.5", fetched.ModelPattern)
	require.Equal(t, ModelQuotaMatchModeExact, fetched.MatchMode)
	require.EqualValues(t, 500000, fetched.QuotaLimit)
	require.True(t, fetched.Enabled)
}

func TestGetModelQuotaGroupRulesByGroup(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&ModelQuotaGroupRule{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM model_quota_group_rules")
	})

	require.NoError(t, DB.Create(&ModelQuotaGroupRule{GroupName: "default", ModelPattern: "gpt-5.5", MatchMode: ModelQuotaMatchModeExact, QuotaLimit: 100, Enabled: true, SortOrder: 1}).Error)
	require.NoError(t, DB.Create(&ModelQuotaGroupRule{GroupName: "default", ModelPattern: "claude-opus", MatchMode: ModelQuotaMatchModePrefix, QuotaLimit: 200, Enabled: true, SortOrder: 0}).Error)
	require.NoError(t, DB.Create(&ModelQuotaGroupRule{GroupName: "vip", ModelPattern: "gpt-5.5", MatchMode: ModelQuotaMatchModeExact, QuotaLimit: 999, Enabled: true}).Error)
	require.NoError(t, DB.Create(&ModelQuotaGroupRule{GroupName: "default", ModelPattern: "disabled-model", MatchMode: ModelQuotaMatchModeExact, QuotaLimit: 50, Enabled: false}).Error)

	rules, err := GetModelQuotaGroupRulesByGroup("default")
	require.NoError(t, err)
	require.Len(t, rules, 2, "should only return enabled rules for 'default' group")
	// sort_order ascending: claude-opus(0) before gpt-5.5(1)
	require.Equal(t, "claude-opus", rules[0].ModelPattern)
	require.Equal(t, "gpt-5.5", rules[1].ModelPattern)
}

// --- ModelQuotaPlanRule tests ---

func TestCreateModelQuotaPlanRule(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&ModelQuotaPlanRule{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM model_quota_plan_rules")
	})

	rule := &ModelQuotaPlanRule{
		PlanId:       1,
		ModelPattern: "gpt-5.5",
		MatchMode:    ModelQuotaMatchModePrefix,
		QuotaLimit:   1000000,
		Enabled:      true,
	}
	require.NoError(t, DB.Create(rule).Error)
	require.NotZero(t, rule.Id)

	rules, err := GetModelQuotaPlanRulesByPlanId(1)
	require.NoError(t, err)
	require.Len(t, rules, 1)
	require.Equal(t, "gpt-5.5", rules[0].ModelPattern)
	require.EqualValues(t, 1000000, rules[0].QuotaLimit)
}

func TestGetModelQuotaPlanRules_NoResults(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&ModelQuotaPlanRule{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM model_quota_plan_rules")
	})

	rules, err := GetModelQuotaPlanRulesByPlanId(999)
	require.NoError(t, err)
	require.Len(t, rules, 0)
}

// --- UserModelQuotaUsage tests ---

func TestCreateUserModelQuotaUsage(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserModelQuotaUsage{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM user_model_quota_usage")
	})

	usage := &UserModelQuotaUsage{
		UserId:         101,
		RuleId:         1,
		RuleSource:     ModelQuotaRuleSourceGroup,
		ModelPattern:   "gpt-5.5",
		SubscriptionId: 0,
		QuotaLimit:     500000,
		QuotaUsed:      0,
		PeriodStart:    1000,
		PeriodEnd:      2000,
		Status:         ModelQuotaUsageStatusActive,
	}
	require.NoError(t, DB.Create(usage).Error)
	require.NotZero(t, usage.Id)
}

func TestGetActiveUserModelQuotaUsage(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserModelQuotaUsage{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM user_model_quota_usage")
	})

	// Active usage for user 101
	require.NoError(t, DB.Create(&UserModelQuotaUsage{UserId: 101, RuleId: 1, RuleSource: ModelQuotaRuleSourceGroup, ModelPattern: "gpt-5.5", QuotaLimit: 500, QuotaUsed: 100, PeriodStart: 1000, PeriodEnd: 99999, Status: ModelQuotaUsageStatusActive}).Error)
	// Expired usage for user 101
	require.NoError(t, DB.Create(&UserModelQuotaUsage{UserId: 101, RuleId: 2, RuleSource: ModelQuotaRuleSourceGroup, ModelPattern: "claude-opus", QuotaLimit: 300, QuotaUsed: 50, PeriodStart: 500, PeriodEnd: 600, Status: ModelQuotaUsageStatusExpired}).Error)
	// Active usage for user 102
	require.NoError(t, DB.Create(&UserModelQuotaUsage{UserId: 102, RuleId: 1, RuleSource: ModelQuotaRuleSourceGroup, ModelPattern: "gpt-5.5", QuotaLimit: 500, QuotaUsed: 0, PeriodStart: 1000, PeriodEnd: 99999, Status: ModelQuotaUsageStatusActive}).Error)

	usages, err := GetActiveUserModelQuotaUsage(101)
	require.NoError(t, err)
	require.Len(t, usages, 1, "should only return active usages for user 101")
	require.Equal(t, "gpt-5.5", usages[0].ModelPattern)
	require.EqualValues(t, 100, usages[0].QuotaUsed)
}

func TestIncreaseUserModelQuotaUsage(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserModelQuotaUsage{}))
	common.BatchUpdateEnabled = false
	t.Cleanup(func() {
		DB.Exec("DELETE FROM user_model_quota_usage")
	})

	usage := &UserModelQuotaUsage{
		UserId: 201, RuleId: 1, RuleSource: ModelQuotaRuleSourceGroup,
		ModelPattern: "gpt-5.5", QuotaLimit: 1000, QuotaUsed: 100,
		PeriodStart: 1000, PeriodEnd: 99999, Status: ModelQuotaUsageStatusActive,
	}
	require.NoError(t, DB.Create(usage).Error)

	require.NoError(t, IncreaseUserModelQuotaUsage(usage.Id, 50))

	var updated UserModelQuotaUsage
	require.NoError(t, DB.First(&updated, usage.Id).Error)
	require.EqualValues(t, 150, updated.QuotaUsed)
}

func TestIncreaseUserModelQuotaUsage_Negative(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserModelQuotaUsage{}))
	common.BatchUpdateEnabled = false
	t.Cleanup(func() {
		DB.Exec("DELETE FROM user_model_quota_usage")
	})

	usage := &UserModelQuotaUsage{
		UserId: 202, RuleId: 1, RuleSource: ModelQuotaRuleSourceGroup,
		ModelPattern: "gpt-5.5", QuotaLimit: 1000, QuotaUsed: 200,
		PeriodStart: 1000, PeriodEnd: 99999, Status: ModelQuotaUsageStatusActive,
	}
	require.NoError(t, DB.Create(usage).Error)

	require.NoError(t, IncreaseUserModelQuotaUsage(usage.Id, -100))

	var updated UserModelQuotaUsage
	require.NoError(t, DB.First(&updated, usage.Id).Error)
	require.EqualValues(t, 100, updated.QuotaUsed)
}

func TestResetUserModelQuotaUsage(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserModelQuotaUsage{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM user_model_quota_usage")
	})

	usage := &UserModelQuotaUsage{
		UserId: 301, RuleId: 1, RuleSource: ModelQuotaRuleSourceGroup,
		ModelPattern: "gpt-5.5", QuotaLimit: 1000, QuotaUsed: 800,
		PeriodStart: 1000, PeriodEnd: 99999, Status: ModelQuotaUsageStatusActive,
	}
	require.NoError(t, DB.Create(usage).Error)

	require.NoError(t, ResetUserModelQuotaUsage(usage.Id))

	var updated UserModelQuotaUsage
	require.NoError(t, DB.First(&updated, usage.Id).Error)
	require.EqualValues(t, 0, updated.QuotaUsed)
}

func TestExpireUserModelQuotaUsage(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&UserModelQuotaUsage{}))
	t.Cleanup(func() {
		DB.Exec("DELETE FROM user_model_quota_usage")
	})

	usage := &UserModelQuotaUsage{
		UserId: 401, RuleId: 1, RuleSource: ModelQuotaRuleSourceGroup,
		ModelPattern: "gpt-5.5", QuotaLimit: 1000, QuotaUsed: 500,
		PeriodStart: 1000, PeriodEnd: 99999, Status: ModelQuotaUsageStatusActive,
	}
	require.NoError(t, DB.Create(usage).Error)

	require.NoError(t, ExpireUserModelQuotaUsage(usage.Id))

	var updated UserModelQuotaUsage
	require.NoError(t, DB.First(&updated, usage.Id).Error)
	require.Equal(t, ModelQuotaUsageStatusExpired, updated.Status)
}
