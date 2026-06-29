package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelQuotaTestDB(t *testing.T) {
	t.Helper()
	// If model.DB is already set up (by another test), just ensure our tables exist
	if model.DB != nil {
		if !model.DB.Migrator().HasTable(&model.ModelQuotaGroupRule{}) {
			require.NoError(t, model.DB.AutoMigrate(
				&model.ModelQuotaGroupRule{},
				&model.ModelQuotaPlanRule{},
				&model.UserModelQuotaUsage{},
			))
		}
		return
	}
	// Create fresh in-memory DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(
		&model.ModelQuotaGroupRule{},
		&model.ModelQuotaPlanRule{},
		&model.UserModelQuotaUsage{},
	))
}

func TestMatchModel_Exact(t *testing.T) {
	setupModelQuotaTestDB(t)
	require.True(t, matchModel("gpt-5.5", "gpt-5.5", model.ModelQuotaMatchModeExact))
	require.False(t, matchModel("gpt-5.5-mini", "gpt-5.5", model.ModelQuotaMatchModeExact))
	require.False(t, matchModel("gpt-5.5-2025-06-30", "gpt-5.5", model.ModelQuotaMatchModeExact))
}

func TestMatchModel_Prefix(t *testing.T) {
	setupModelQuotaTestDB(t)
	require.True(t, matchModel("gpt-5.5", "gpt-5.5", model.ModelQuotaMatchModePrefix))
	require.True(t, matchModel("gpt-5.5-mini", "gpt-5.5", model.ModelQuotaMatchModePrefix))
	require.True(t, matchModel("gpt-5.5-2025-06-30", "gpt-5.5", model.ModelQuotaMatchModePrefix))
	require.False(t, matchModel("gpt-4o", "gpt-5.5", model.ModelQuotaMatchModePrefix))
}

func TestCheckModelQuota_NoRules(t *testing.T) {
	setupModelQuotaTestDB(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM model_quota_group_rules")
		model.DB.Exec("DELETE FROM user_model_quota_usage")
	})
	// No rules → no restriction, pass
	result, err := CheckModelQuota(999, "gpt-5.5", "default", 100)
	require.NoError(t, err)
	require.True(t, result.Passed)
	require.Len(t, result.UsageIds, 0)
}

func TestCheckModelQuota_GroupRulePass(t *testing.T) {
	setupModelQuotaTestDB(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM model_quota_group_rules")
		model.DB.Exec("DELETE FROM user_model_quota_usage")
	})

	// Create group rule: gpt-5.5 limit 1000
	rule := &model.ModelQuotaGroupRule{
		GroupName:    "default",
		ModelPattern: "gpt-5.5",
		MatchMode:    model.ModelQuotaMatchModeExact,
		QuotaLimit:   1000,
		Enabled:      true,
	}
	require.NoError(t, model.DB.Create(rule).Error)

	// Pre-consume 100, should pass
	result, err := CheckModelQuota(101, "gpt-5.5", "default", 100)
	require.NoError(t, err)
	require.True(t, result.Passed)
}

func TestCheckModelQuota_GroupRuleExhausted(t *testing.T) {
	setupModelQuotaTestDB(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM model_quota_group_rules")
		model.DB.Exec("DELETE FROM user_model_quota_usage")
	})

	// Create group rule: gpt-5.5 limit 500
	rule := &model.ModelQuotaGroupRule{
		GroupName:    "default",
		ModelPattern: "gpt-5.5",
		MatchMode:    model.ModelQuotaMatchModeExact,
		QuotaLimit:   500,
		Enabled:      true,
	}
	require.NoError(t, model.DB.Create(rule).Error)

	// Create existing usage: already used 450
	usage := &model.UserModelQuotaUsage{
		UserId: 201, RuleId: rule.Id, RuleSource: model.ModelQuotaRuleSourceGroup,
		ModelPattern: "gpt-5.5", QuotaLimit: 500, QuotaUsed: 450,
		PeriodStart: common.GetTimestamp() - 1000, PeriodEnd: common.GetTimestamp() + 3600, Status: model.ModelQuotaUsageStatusActive,
	}
	require.NoError(t, model.DB.Create(usage).Error)

	// Pre-consume 100, 450+100=550 > 500, should fail
	result, err := CheckModelQuota(201, "gpt-5.5", "default", 100)
	require.NoError(t, err)
	require.False(t, result.Passed)
	require.NotEmpty(t, result.ErrorMessage)
}

func TestCheckModelQuota_PrefixMatch(t *testing.T) {
	setupModelQuotaTestDB(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM model_quota_group_rules")
		model.DB.Exec("DELETE FROM user_model_quota_usage")
	})

	rule := &model.ModelQuotaGroupRule{
		GroupName:    "default",
		ModelPattern: "gpt-5.5",
		MatchMode:    model.ModelQuotaMatchModePrefix,
		QuotaLimit:   1000,
		Enabled:      true,
	}
	require.NoError(t, model.DB.Create(rule).Error)

	// gpt-5.5-mini should match the prefix rule
	result, err := CheckModelQuota(301, "gpt-5.5-mini", "default", 100)
	require.NoError(t, err)
	require.True(t, result.Passed)
}

func TestCheckModelQuota_MultipleRules(t *testing.T) {
	setupModelQuotaTestDB(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM model_quota_group_rules")
		model.DB.Exec("DELETE FROM user_model_quota_usage")
	})

	// Rule 1: gpt-5.5 prefix, limit 1000
	rule1 := &model.ModelQuotaGroupRule{
		GroupName: "default", ModelPattern: "gpt-5.5", MatchMode: model.ModelQuotaMatchModePrefix,
		QuotaLimit: 1000, Enabled: true, SortOrder: 0,
	}
	require.NoError(t, model.DB.Create(rule1).Error)

	// Rule 2: gpt-5.5 exact, limit 500
	rule2 := &model.ModelQuotaGroupRule{
		GroupName: "default", ModelPattern: "gpt-5.5", MatchMode: model.ModelQuotaMatchModeExact,
		QuotaLimit: 500, Enabled: true, SortOrder: 1,
	}
	require.NoError(t, model.DB.Create(rule2).Error)

	// Both rules match, both should pass with 100 pre-consume
	result, err := CheckModelQuota(401, "gpt-5.5", "default", 100)
	require.NoError(t, err)
	require.True(t, result.Passed)
	require.Len(t, result.UsageIds, 2)
}

func TestCheckModelQuota_DisabledRuleSkipped(t *testing.T) {
	setupModelQuotaTestDB(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM model_quota_group_rules")
		model.DB.Exec("DELETE FROM user_model_quota_usage")
	})

	rule := &model.ModelQuotaGroupRule{
		GroupName:    "default",
		ModelPattern: "gpt-5.5",
		MatchMode:    model.ModelQuotaMatchModeExact,
		QuotaLimit:   100,
		Enabled:      false,
	}
	require.NoError(t, model.DB.Create(rule).Error)

	// Disabled rule should be skipped → pass
	result, err := CheckModelQuota(501, "gpt-5.5", "default", 100)
	require.NoError(t, err)
	require.True(t, result.Passed)
}

func TestCheckModelQuota_PeriodExpiredCreatesFreshUsage(t *testing.T) {
	setupModelQuotaTestDB(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM model_quota_group_rules")
		model.DB.Exec("DELETE FROM user_model_quota_usage")
	})

	rule := &model.ModelQuotaGroupRule{
		GroupName: "default", ModelPattern: "gpt-5.5", MatchMode: model.ModelQuotaMatchModeExact,
		Period: model.ModelQuotaPeriodDaily, QuotaLimit: 500, Enabled: true,
	}
	require.NoError(t, model.DB.Create(rule).Error)

	oldUsage := &model.UserModelQuotaUsage{
		UserId: 701, RuleId: rule.Id, RuleSource: model.ModelQuotaRuleSourceGroup,
		ModelPattern: "gpt-5.5", QuotaLimit: 500, QuotaUsed: 499,
		PeriodStart: common.GetTimestamp() - 86400*2, PeriodEnd: common.GetTimestamp() - 3600,
		Status: model.ModelQuotaUsageStatusActive,
	}
	require.NoError(t, model.DB.Create(oldUsage).Error)

	result, err := CheckModelQuota(701, "gpt-5.5", "default", 100)
	require.NoError(t, err)
	require.True(t, result.Passed)
	require.Len(t, result.UsageIds, 1)
	require.NotEqual(t, oldUsage.Id, result.UsageIds[0])

	var refreshed model.UserModelQuotaUsage
	require.NoError(t, model.DB.First(&refreshed, result.UsageIds[0]).Error)
	require.Equal(t, int64(0), refreshed.QuotaUsed)
	require.Greater(t, refreshed.PeriodEnd, common.GetTimestamp())
}

func TestCheckModelQuota_ExpiredUsageIgnored(t *testing.T) {
	setupModelQuotaTestDB(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM model_quota_group_rules")
		model.DB.Exec("DELETE FROM user_model_quota_usage")
	})

	rule := &model.ModelQuotaGroupRule{
		GroupName: "default", ModelPattern: "gpt-5.5", MatchMode: model.ModelQuotaMatchModeExact,
		QuotaLimit: 500, Enabled: true,
	}
	require.NoError(t, model.DB.Create(rule).Error)

	// Expired usage (period_end < now)
	expiredUsage := &model.UserModelQuotaUsage{
		UserId: 601, RuleId: rule.Id, RuleSource: model.ModelQuotaRuleSourceGroup,
		ModelPattern: "gpt-5.5", QuotaLimit: 500, QuotaUsed: 499,
		PeriodStart: 500, PeriodEnd: 600, Status: model.ModelQuotaUsageStatusExpired,
	}
	require.NoError(t, model.DB.Create(expiredUsage).Error)

	// New check with fresh period → should pass (expired usage ignored)
	result, err := CheckModelQuota(601, "gpt-5.5", "default", 100)
	require.NoError(t, err)
	require.True(t, result.Passed)
}
