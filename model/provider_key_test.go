package model

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupProviderKeyTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	oldDB := DB
	oldLogDB := LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingMySQL := common.UsingMySQL
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldRedisEnabled := common.RedisEnabled
	oldLogConsumeEnabled := common.LogConsumeEnabled

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.LogConsumeEnabled = true

	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	DB = db
	LOG_DB = db

	if err := db.AutoMigrate(&ProviderKey{}, &User{}, &Log{}, &Channel{}); err != nil {
		t.Fatalf("failed to migrate provider key tables: %v", err)
	}

	t.Cleanup(func() {
		DB = oldDB
		LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingMySQL = oldUsingMySQL
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.RedisEnabled = oldRedisEnabled
		common.LogConsumeEnabled = oldLogConsumeEnabled
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}

func newProviderKeyLogContext(rawKey string, requestID string) *gin.Context {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	ctx.Set("username", "admin")
	ctx.Set(common.RequestIdKey, requestID)
	common.SetContextKey(ctx, constant.ContextKeyChannelKey, rawKey)
	return ctx
}

func newProviderKeyLogContextWithCostRatio(rawKey string, requestID string, costRatio float64) *gin.Context {
	ctx := newProviderKeyLogContext(rawKey, requestID)
	setting := dto.ChannelSettings{
		CostRatio: &costRatio,
	}
	common.SetContextKey(ctx, constant.ContextKeyChannelSetting, setting)
	return ctx
}

func TestGetOrCreateProviderKeyStableID(t *testing.T) {
	setupProviderKeyTestDB(t)

	first, err := GetOrCreateProviderKey("  xai-test-key-123456  ")
	if err != nil {
		t.Fatalf("failed to create provider key: %v", err)
	}
	second, err := GetOrCreateProviderKey("xai-test-key-123456")
	if err != nil {
		t.Fatalf("failed to resolve provider key: %v", err)
	}

	if first.Id == 0 {
		t.Fatal("expected non-zero provider key id")
	}
	if first.Id != second.Id {
		t.Fatalf("expected stable provider key id, got %d and %d", first.Id, second.Id)
	}
}

func TestRecordConsumeLogStoresProviderKeyMetadata(t *testing.T) {
	setupProviderKeyTestDB(t)

	ctxAlpha := newProviderKeyLogContext("xai-alpha-key-123456", "req-alpha")
	RecordConsumeLog(ctxAlpha, 1, RecordConsumeLogParams{
		ModelName: "grok-test",
		TokenName: "unit-test",
		Content:   "first request",
		Group:     "default",
		Other:     map[string]interface{}{},
	})

	ctxBeta := newProviderKeyLogContext("xai-beta-key-654321", "req-beta")
	RecordConsumeLog(ctxBeta, 1, RecordConsumeLogParams{
		ModelName: "grok-test",
		TokenName: "unit-test",
		Content:   "second request",
		Group:     "default",
		Other:     map[string]interface{}{},
	})

	alphaKey, err := GetOrCreateProviderKey("xai-alpha-key-123456")
	if err != nil {
		t.Fatalf("failed to lookup alpha key: %v", err)
	}

	adminLogs, total, err := GetAllLogs(LogTypeConsume, 0, 0, "", "", "", 0, 10, 0, "", "", alphaKey.Id)
	if err != nil {
		t.Fatalf("failed to query admin logs by provider key id: %v", err)
	}
	if total != 1 || len(adminLogs) != 1 {
		t.Fatalf("expected exactly one admin log for provider key id %d, got total=%d len=%d", alphaKey.Id, total, len(adminLogs))
	}
	if adminLogs[0].ProviderKeyId != alphaKey.Id {
		t.Fatalf("expected provider key id %d, got %d", alphaKey.Id, adminLogs[0].ProviderKeyId)
	}

	adminOther, err := common.StrToMap(adminLogs[0].Other)
	if err != nil {
		t.Fatalf("failed to parse admin log other: %v", err)
	}
	adminInfo, _ := adminOther["admin_info"].(map[string]interface{})
	if adminInfo["provider_key"] != "xai-alpha-key-123456" {
		t.Fatalf("expected raw provider key in admin info, got %#v", adminInfo["provider_key"])
	}

	userLogs, total, err := GetUserLogs(1, LogTypeConsume, 0, 0, "", "", 0, 10, "", "", alphaKey.Id)
	if err != nil {
		t.Fatalf("failed to query user logs by provider key id: %v", err)
	}
	if total != 1 || len(userLogs) != 1 {
		t.Fatalf("expected exactly one user log for provider key id %d, got total=%d len=%d", alphaKey.Id, total, len(userLogs))
	}
	if userLogs[0].ProviderKeyId != 0 {
		t.Fatalf("expected provider key id to be hidden from user logs, got %d", userLogs[0].ProviderKeyId)
	}

	userOther, err := common.StrToMap(userLogs[0].Other)
	if err != nil {
		t.Fatalf("failed to parse user log other: %v", err)
	}
	if _, ok := userOther["admin_info"]; ok {
		t.Fatalf("expected admin info to be hidden from user logs, got %#v", userOther["admin_info"])
	}
}

func TestRecordConsumeLogStoresCostQuota(t *testing.T) {
	setupProviderKeyTestDB(t)

	ctx := newProviderKeyLogContextWithCostRatio("xai-cost-key-123456", "req-cost", 0.8)
	RecordConsumeLog(ctx, 1, RecordConsumeLogParams{
		ModelName: "grok-test",
		TokenName: "unit-test",
		Content:   "cost request",
		Group:     "default",
		Quota:     125,
		Other:     map[string]interface{}{},
	})

	var log Log
	if err := LOG_DB.Order("id desc").First(&log).Error; err != nil {
		t.Fatalf("failed to query latest log: %v", err)
	}
	if log.Quota != 125 {
		t.Fatalf("expected original quota 125, got %d", log.Quota)
	}
	if log.CostQuota == nil {
		t.Fatal("expected cost quota to be stored")
	}
	if *log.CostQuota != 100 {
		t.Fatalf("expected cost quota 100, got %d", *log.CostQuota)
	}

	otherMap, err := common.StrToMap(log.Other)
	if err != nil {
		t.Fatalf("failed to parse log other: %v", err)
	}
	if otherMap["cost_ratio"] != 0.8 {
		t.Fatalf("expected cost ratio 0.8 in other, got %#v", otherMap["cost_ratio"])
	}
}
