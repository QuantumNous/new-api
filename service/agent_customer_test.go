package service

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type agentCustomerServiceFixture struct {
	now        int64
	agentID    int
	otherID    int
	customerID int
	otherCust  int
}

func setupAgentCustomerServiceTest(t *testing.T) agentCustomerServiceFixture {
	t.Helper()
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalEnabled := operation_setting.GetAgentSetting().Enabled
	originalRedisEnabled := common.RedisEnabled
	dsn := "file:" + filepath.Join(t.TempDir(), "agent-customer-service.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.AgentAccount{}, &model.SubscriptionPlan{},
		&model.UserSubscription{}, &model.Log{},
	))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	operation_setting.GetAgentSetting().Enabled = true
	common.RedisEnabled = false
	now := time.Now().Unix()
	users := []model.User{
		{Id: 9101, Username: "agent-customer-owner", DisplayName: "Owner", AffCode: "owner-aff", Status: common.UserStatusEnabled},
		{Id: 9102, Username: "agent-customer-other", DisplayName: "Other", AffCode: "other-aff", Status: common.UserStatusEnabled},
		{Id: 9201, Username: "customer-one", DisplayName: "Customer One", AffCode: "customer-one-aff", BoundAgentId: 9101, BoundAt: now - 900, Quota: 1000, UsedQuota: 300, CreatedAt: now - 1000, LastLoginAt: now - 100},
		{Id: 9202, Username: "customer-two", DisplayName: "Customer Two", AffCode: "customer-two-aff", BoundAgentId: 9101, BoundAt: now - 800, Quota: 100, UsedQuota: 120, CreatedAt: now - 700, LastLoginAt: now - 200},
		{Id: 9203, Username: "other-customer", DisplayName: "Other Customer", AffCode: "other-customer-aff", BoundAgentId: 9102, BoundAt: now - 600, Quota: 900, UsedQuota: 100},
	}
	require.NoError(t, db.Create(&users).Error)
	require.NoError(t, db.Create(&[]model.AgentAccount{
		{UserId: 9101, Status: model.AgentAccountStatusActive},
		{UserId: 9102, Status: model.AgentAccountStatusDisabled},
	}).Error)
	plan := model.SubscriptionPlan{Id: 9301, Title: "Pro Plan", Enabled: true}
	require.NoError(t, db.Create(&plan).Error)
	require.NoError(t, db.Create(&model.UserSubscription{
		UserId: 9201, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 200,
		StartTime: now - 3600, EndTime: now + 3600, Status: "active",
	}).Error)
	require.NoError(t, db.Create(&[]model.Log{
		{Id: 9401, UserId: 9201, Username: "customer-one", Type: model.LogTypeConsume, CreatedAt: now - 10, ModelName: "gpt-test", Quota: 50, PromptTokens: 10, CompletionTokens: 20},
		{Id: 9402, UserId: 9202, Username: "customer-two", Type: model.LogTypeConsume, CreatedAt: now - 20, ModelName: "gpt-test", Quota: 30, PromptTokens: 5, CompletionTokens: 15},
		{Id: 9403, UserId: 9203, Username: "other-customer", Type: model.LogTypeConsume, CreatedAt: now - 5, ModelName: "gpt-test", Quota: 999, PromptTokens: 1, CompletionTokens: 1},
	}).Error)
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		operation_setting.GetAgentSetting().Enabled = originalEnabled
		common.RedisEnabled = originalRedisEnabled
		sqlDB, dbErr := db.DB()
		require.NoError(t, dbErr)
		require.NoError(t, sqlDB.Close())
	})
	return agentCustomerServiceFixture{now: now, agentID: 9101, otherID: 9102, customerID: 9201, otherCust: 9203}
}

func TestListAgentCustomersEnforcesOwnershipAndProjectsSubscription(t *testing.T) {
	fixture := setupAgentCustomerServiceTest(t)

	customers, total, err := ListAgentCustomers(fixture.agentID, AgentCustomerQuery{
		SortBy: "remaining_quota", SortOrder: "asc", Offset: 0, Limit: 10,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, customers, 2)

	byID := make(map[int]AgentCustomer, len(customers))
	for _, customer := range customers {
		byID[customer.ID] = customer
	}
	assert.Equal(t, 1500, byID[fixture.customerID].RemainingQuota)
	assert.Equal(t, "Pro Plan", byID[fixture.customerID].SubscriptionPlanTitle)
	assert.Equal(t, fixture.now+3600, byID[fixture.customerID].SubscriptionEndTime)
	assert.Zero(t, byID[9202].RemainingQuota)
	assert.NotContains(t, byID, fixture.otherCust)
}

func TestListAgentCustomerLogsAndStatsEnforceOwnership(t *testing.T) {
	fixture := setupAgentCustomerServiceTest(t)

	logs, total, err := ListAgentCustomerLogs(fixture.agentID, AgentCustomerLogQuery{
		Type: model.LogTypeConsume, ModelName: "gpt-test", Offset: 0, Limit: 10,
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, logs, 2)
	for _, log := range logs {
		assert.NotEqual(t, fixture.otherCust, log.UserId)
	}

	logs, total, err = ListAgentCustomerLogs(fixture.agentID, AgentCustomerLogQuery{
		UserID: fixture.otherCust, Offset: 0, Limit: 10,
	})
	require.NoError(t, err)
	assert.Empty(t, logs)
	assert.Zero(t, total)

	stat, err := GetAgentCustomerLogStats(fixture.agentID, AgentCustomerLogQuery{Type: model.LogTypeConsume})
	require.NoError(t, err)
	assert.Equal(t, 80, stat.Quota)
	assert.Equal(t, 2, stat.Rpm)
	assert.Equal(t, 50, stat.Tpm)
}
