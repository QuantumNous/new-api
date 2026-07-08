package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupOptionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	if err := db.AutoMigrate(&model.Option{}); err != nil {
		t.Fatalf("failed to migrate option table: %v", err)
	}
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func newOptionRequestContext(t *testing.T, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	payload, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("failed to marshal request body: %v", err)
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/option/bulk", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	return ctx, recorder
}

func TestUpdateOptionsBulkPersistsSidebarAndPlaygroundModelAtomically(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"options": []map[string]any{
			{"key": "SidebarModulesAdmin", "value": `{"chat":{"enabled":true,"playground":true}}`},
			{"key": "PlaygroundDefaultModel", "value": "gemini-2.5-flash"},
		},
	})
	UpdateOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected bulk option update to succeed, got message: %s", response.Message)
	}

	var sidebar model.Option
	if err := db.First(&sidebar, "key = ?", "SidebarModulesAdmin").Error; err != nil {
		t.Fatalf("failed to load sidebar option: %v", err)
	}
	if sidebar.Value != `{"chat":{"enabled":true,"playground":true}}` {
		t.Fatalf("unexpected sidebar value: %q", sidebar.Value)
	}

	var playground model.Option
	if err := db.First(&playground, "key = ?", model.OptionKeyPlaygroundDefaultModel).Error; err != nil {
		t.Fatalf("failed to load playground default model option: %v", err)
	}
	if playground.Value != "gemini-2.5-flash" {
		t.Fatalf("unexpected playground default model: %q", playground.Value)
	}

	common.OptionMapRWMutex.RLock()
	optionMapModel := common.OptionMap[model.OptionKeyPlaygroundDefaultModel]
	common.OptionMapRWMutex.RUnlock()
	if optionMapModel != "gemini-2.5-flash" {
		t.Fatalf("expected in-memory option map to update, got %q", optionMapModel)
	}
}

func TestUpdateOptionsBulkRejectsUnsupportedKeysWithoutPartialWrite(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"options": []map[string]any{
			{"key": "SidebarModulesAdmin", "value": `{"chat":{"enabled":true,"playground":true}}`},
			{"key": "theme.frontend", "value": "default"},
		},
	})
	UpdateOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected unsupported bulk option key to fail")
	}

	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "SidebarModulesAdmin").Count(&count).Error; err != nil {
		t.Fatalf("failed to count sidebar option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no partial sidebar option write, got %d rows", count)
	}
}

func TestUpdateOptionsBulkRejectsNonStringValuesWithoutPartialWrite(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"options": []map[string]any{
			{"key": "SidebarModulesAdmin", "value": `{"chat":{"enabled":true,"playground":true}}`},
			{"key": "PlaygroundDefaultModel", "value": 123},
		},
	})
	UpdateOptions(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected non-string bulk option value to fail")
	}

	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "SidebarModulesAdmin").Count(&count).Error; err != nil {
		t.Fatalf("failed to count sidebar option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no partial sidebar option write, got %d rows", count)
	}
}

func TestUpdateOptionRejectsNullInviterRewardLimit(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"key":   "QuotaForInviterMaxCount",
		"value": nil,
	})
	UpdateOption(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected null inviter reward limit to fail")
	}

	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "QuotaForInviterMaxCount").Count(&count).Error; err != nil {
		t.Fatalf("failed to count inviter reward limit option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected rejected inviter reward limit not to persist, got %d rows", count)
	}
}

func TestUpdateOptionRejectsInvalidGroupModelRatioAtController(t *testing.T) {
	db := setupOptionControllerTestDB(t)

	ctx, recorder := newOptionRequestContext(t, map[string]any{
		"key":   "GroupModelRatio",
		"value": `{"plg":{"gpt-5.5":-0.1}}`,
	})
	UpdateOption(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected invalid group model ratio to fail")
	}

	var count int64
	if err := db.Model(&model.Option{}).Where("key = ?", "GroupModelRatio").Count(&count).Error; err != nil {
		t.Fatalf("failed to count group model ratio option rows: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected rejected group model ratio not to persist, got %d rows", count)
	}
}
