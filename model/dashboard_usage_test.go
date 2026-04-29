package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupDashboardUsageTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB := DB
	oldLogDB := LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	DB = db
	LOG_DB = db

	if err := db.AutoMigrate(&Log{}); err != nil {
		t.Fatalf("failed to migrate log table: %v", err)
	}

	t.Cleanup(func() {
		DB = oldDB
		LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func TestGetDashboardQuotaDataGroupsByProviderKeyID(t *testing.T) {
	db := setupDashboardUsageTestDB(t)

	logs := []*Log{
		{
			UserId:           1,
			Username:         "admin",
			CreatedAt:        3601,
			Type:             LogTypeConsume,
			ModelName:        "grok-4",
			Quota:            10,
			PromptTokens:     5,
			CompletionTokens: 7,
			ChannelId:        3,
			TokenId:          11,
			ProviderKeyId:    101,
		},
		{
			UserId:           1,
			Username:         "admin",
			CreatedAt:        3659,
			Type:             LogTypeConsume,
			ModelName:        "grok-4",
			Quota:            20,
			PromptTokens:     2,
			CompletionTokens: 3,
			ChannelId:        3,
			TokenId:          12,
			ProviderKeyId:    101,
		},
		{
			UserId:           1,
			Username:         "admin",
			CreatedAt:        3670,
			Type:             LogTypeConsume,
			ModelName:        "grok-4",
			Quota:            30,
			PromptTokens:     11,
			CompletionTokens: 13,
			ChannelId:        4,
			TokenId:          12,
			ProviderKeyId:    202,
		},
	}
	if err := db.Create(&logs).Error; err != nil {
		t.Fatalf("failed to seed logs: %v", err)
	}

	rows, err := GetDashboardQuotaData(DashboardUsageQuery{
		StartTimestamp: 3600,
		EndTimestamp:   4000,
		ModelName:      "grok-4",
		Dimension:      DashboardDimensionProviderKey,
		Metric:         DashboardMetricOriginal,
	})
	if err != nil {
		t.Fatalf("failed to query dashboard usage data: %v", err)
	}

	if len(rows) != 2 {
		t.Fatalf("expected 2 aggregated rows, got %d", len(rows))
	}
	rowMap := make(map[string]*QuotaData, len(rows))
	for _, row := range rows {
		rowMap[row.ModelName] = row
	}
	if rowMap["101"] == nil || rowMap["101"].CreatedAt != 3600 || rowMap["101"].Count != 2 || rowMap["101"].Quota != 30 || rowMap["101"].TokenUsed != 17 {
		t.Fatalf("unexpected row for provider key 101: %#v", rowMap["101"])
	}
	if rowMap["202"] == nil || rowMap["202"].CreatedAt != 3600 || rowMap["202"].Count != 1 || rowMap["202"].Quota != 30 || rowMap["202"].TokenUsed != 24 {
		t.Fatalf("unexpected row for provider key 202: %#v", rowMap["202"])
	}
}

func TestGetDashboardQuotaDataSupportsCostMetric(t *testing.T) {
	db := setupDashboardUsageTestDB(t)

	costOne := 50
	costZero := 0
	logs := []*Log{
		{
			UserId:           1,
			Username:         "admin",
			CreatedAt:        10801,
			Type:             LogTypeConsume,
			ModelName:        "claude-sonnet",
			Quota:            100,
			CostQuota:        &costOne,
			PromptTokens:     20,
			CompletionTokens: 10,
			ChannelId:        7,
			TokenId:          33,
			ProviderKeyId:    3001,
		},
		{
			UserId:           1,
			Username:         "admin",
			CreatedAt:        10820,
			Type:             LogTypeConsume,
			ModelName:        "claude-sonnet",
			Quota:            40,
			CostQuota:        nil,
			PromptTokens:     4,
			CompletionTokens: 6,
			ChannelId:        7,
			TokenId:          33,
			ProviderKeyId:    3001,
		},
		{
			UserId:           1,
			Username:         "admin",
			CreatedAt:        10830,
			Type:             LogTypeConsume,
			ModelName:        "grok-4",
			Quota:            20,
			CostQuota:        &costZero,
			PromptTokens:     2,
			CompletionTokens: 3,
			ChannelId:        8,
			TokenId:          34,
			ProviderKeyId:    3002,
		},
	}
	if err := db.Create(&logs).Error; err != nil {
		t.Fatalf("failed to seed logs: %v", err)
	}

	rows, err := GetDashboardQuotaData(DashboardUsageQuery{
		StartTimestamp: 10800,
		EndTimestamp:   10900,
		Dimension:      DashboardDimensionModel,
		Metric:         DashboardMetricCost,
	})
	if err != nil {
		t.Fatalf("failed to query dashboard cost usage data: %v", err)
	}

	if len(rows) != 2 {
		t.Fatalf("expected 2 aggregated rows, got %d", len(rows))
	}
	rowMap := make(map[string]*QuotaData, len(rows))
	for _, row := range rows {
		rowMap[row.ModelName] = row
	}
	if rowMap["claude-sonnet"] == nil || rowMap["claude-sonnet"].Quota != 90 {
		t.Fatalf("unexpected cost row for claude-sonnet: %#v", rowMap["claude-sonnet"])
	}
	if rowMap["grok-4"] == nil || rowMap["grok-4"].Quota != 0 {
		t.Fatalf("unexpected cost row for grok-4: %#v", rowMap["grok-4"])
	}
}

func TestGetDashboardUserQuotaDataAppliesFilters(t *testing.T) {
	db := setupDashboardUsageTestDB(t)

	logs := []*Log{
		{
			UserId:           1,
			Username:         "alice",
			CreatedAt:        7201,
			Type:             LogTypeConsume,
			ModelName:        "claude-sonnet",
			Quota:            18,
			PromptTokens:     6,
			CompletionTokens: 4,
			ChannelId:        9,
			TokenId:          77,
			ProviderKeyId:    5001,
		},
		{
			UserId:           2,
			Username:         "bob",
			CreatedAt:        7220,
			Type:             LogTypeConsume,
			ModelName:        "claude-sonnet",
			Quota:            28,
			PromptTokens:     8,
			CompletionTokens: 9,
			ChannelId:        9,
			TokenId:          88,
			ProviderKeyId:    5001,
		},
		{
			UserId:           2,
			Username:         "bob",
			CreatedAt:        7250,
			Type:             LogTypeConsume,
			ModelName:        "grok-4",
			Quota:            40,
			PromptTokens:     9,
			CompletionTokens: 9,
			ChannelId:        9,
			TokenId:          88,
			ProviderKeyId:    5001,
		},
	}
	if err := db.Create(&logs).Error; err != nil {
		t.Fatalf("failed to seed logs: %v", err)
	}

	rows, err := GetDashboardUserQuotaData(DashboardUsageQuery{
		StartTimestamp: 7200,
		EndTimestamp:   7600,
		ModelName:      "claude-sonnet",
		ProviderKeyID:  5001,
		Metric:         DashboardMetricOriginal,
	})
	if err != nil {
		t.Fatalf("failed to query dashboard user usage data: %v", err)
	}

	if len(rows) != 2 {
		t.Fatalf("expected 2 user rows, got %d", len(rows))
	}
	rowMap := make(map[string]*QuotaData, len(rows))
	for _, row := range rows {
		rowMap[row.Username] = row
	}
	if rowMap["alice"] == nil || rowMap["alice"].Quota != 18 || rowMap["alice"].TokenUsed != 10 {
		t.Fatalf("unexpected user row for alice: %#v", rowMap["alice"])
	}
	if rowMap["bob"] == nil || rowMap["bob"].Quota != 28 || rowMap["bob"].TokenUsed != 17 {
		t.Fatalf("unexpected user row for bob: %#v", rowMap["bob"])
	}
}
