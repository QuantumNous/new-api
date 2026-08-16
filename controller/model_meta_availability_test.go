package controller

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupModelMetaStatusControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Option{},
		&model.Model{},
		&model.Ability{},
		&model.Channel{},
		&model.Vendor{},
	))

	originalDB := model.DB
	originalDatabaseType := common.MainDatabaseType()
	originalDisable := common.AutomaticDisableModelEnabled
	originalEnable := common.AutomaticEnableModelEnabled
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.AutomaticDisableModelEnabled = false
	common.AutomaticEnableModelEnabled = false
	model.InvalidatePricingCache()
	t.Cleanup(func() {
		model.InvalidatePricingCache()
		model.DB = originalDB
		common.SetMainDatabaseType(originalDatabaseType)
		common.AutomaticDisableModelEnabled = originalDisable
		common.AutomaticEnableModelEnabled = originalEnable
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestCreateModelMetaReturnsReconciledAvailability(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.Option{},
		&model.Model{},
		&model.Ability{},
		&model.Channel{},
	))
	require.NoError(t, db.Create(&[]model.Option{
		{Key: "AutomaticDisableModelEnabled", Value: "true"},
		{Key: "AutomaticEnableModelEnabled", Value: "false"},
	}).Error)

	originalDB := model.DB
	originalDatabaseType := common.MainDatabaseType()
	originalDisable := common.AutomaticDisableModelEnabled
	originalEnable := common.AutomaticEnableModelEnabled
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.AutomaticDisableModelEnabled = false
	common.AutomaticEnableModelEnabled = false
	t.Cleanup(func() {
		model.DB = originalDB
		common.SetMainDatabaseType(originalDatabaseType)
		common.AutomaticDisableModelEnabled = originalDisable
		common.AutomaticEnableModelEnabled = originalEnable
	})

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/models", bytes.NewBufferString(
		`{"model_name":"gpt-4","status":1,"sync_official":1,"auto_disabled_by_rule":true}`,
	))
	ctx.Request.Header.Set("Content-Type", "application/json")

	CreateModelMeta(ctx)

	var response struct {
		Success bool        `json:"success"`
		Data    model.Model `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, 0, response.Data.Status)
	assert.True(t, response.Data.AutoDisabledByRule)
}

func TestBatchModelAvailabilityEndpointsReturnReconcileErrors(t *testing.T) {
	brokenDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	originalDB := model.DB
	originalDatabaseType := common.MainDatabaseType()
	model.DB = brokenDB
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB = originalDB
		common.SetMainDatabaseType(originalDatabaseType)
	})

	gin.SetMode(gin.TestMode)
	tests := []struct {
		name    string
		handler gin.HandlerFunc
	}{
		{name: "disable models without channels", handler: BatchDisableModelsNoChannels},
		{name: "enable models with channels", handler: BatchEnableModelsWithChannels},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)

			test.handler(ctx)

			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			assert.False(t, response.Success)
			assert.Contains(t, response.Message, "reconcile model channel availability")
		})
	}
}

func TestUpdateModelMetaStatusOnlyReturnsNotFoundForMissingModel(t *testing.T) {
	setupModelMetaStatusControllerTestDB(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/models?status_only=true", bytes.NewBufferString(
		`{"id":404,"status":1}`,
	))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateModelMeta(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Equal(t, gorm.ErrRecordNotFound.Error(), response.Message)
}

func TestUpdateModelMetaStatusOnlyReturnsReloadError(t *testing.T) {
	db := setupModelMetaStatusControllerTestDB(t)
	entry := &model.Model{ModelName: "reload-error-model", Status: 0, SyncOfficial: 1}
	require.NoError(t, entry.Insert())

	reloadErr := errors.New("forced model reload failure")
	updateCompleted := false
	require.NoError(t, db.Callback().Update().After("gorm:update").Register("test:mark_model_status_update", func(tx *gorm.DB) {
		if tx.Statement.Table == "models" {
			updateCompleted = true
		}
	}))
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("test:fail_model_reload", func(tx *gorm.DB) {
		if !updateCompleted || tx.Statement.Table != "models" {
			return
		}
		if _, ok := tx.Statement.Dest.(*model.Model); ok {
			tx.AddError(reloadErr)
		}
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/models?status_only=true", bytes.NewBufferString(fmt.Sprintf(
		`{"id":%d,"status":1}`,
		entry.Id,
	)))
	ctx.Request.Header.Set("Content-Type", "application/json")

	UpdateModelMeta(ctx)

	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.ErrorContains(t, errors.New(response.Message), reloadErr.Error())
}

func TestBatchUpdateModelStatusReturnsFinalStatuses(t *testing.T) {
	db := setupModelMetaStatusControllerTestDB(t)
	require.NoError(t, db.Create(&model.Option{Key: "AutomaticDisableModelEnabled", Value: "true"}).Error)

	first := &model.Model{ModelName: "batch-status-first", Status: 0, SyncOfficial: 1}
	second := &model.Model{ModelName: "batch-status-second", Status: 0, SyncOfficial: 1}
	require.NoError(t, first.Insert())
	require.NoError(t, second.Insert())

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/models/batch_status", bytes.NewBufferString(fmt.Sprintf(
		`{"ids":[%d,%d,404],"status":1}`,
		first.Id,
		second.Id,
	)))
	ctx.Request.Header.Set("Content-Type", "application/json")

	BatchUpdateModelStatus(ctx)

	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Updated   int   `json:"updated"`
			FailedIDs []int `json:"failed_ids"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Zero(t, response.Data.Updated)
	assert.ElementsMatch(t, []int{first.Id, second.Id, 404}, response.Data.FailedIDs)

	var persisted []model.Model
	require.NoError(t, db.Where("id IN ?", []int{first.Id, second.Id}).Order("id ASC").Find(&persisted).Error)
	require.Len(t, persisted, 2)
	assert.Equal(t, 0, persisted[0].Status)
	assert.True(t, persisted[0].AutoDisabledByRule)
	assert.Equal(t, 0, persisted[1].Status)
	assert.True(t, persisted[1].AutoDisabledByRule)
}

func TestBatchUpdateModelStatusRejectsMoreThanHundredIDs(t *testing.T) {
	setupModelMetaStatusControllerTestDB(t)
	ids := make([]int, 101)
	for i := range ids {
		ids[i] = i + 1
	}
	body, err := common.Marshal(gin.H{"ids": ids, "status": 0})
	require.NoError(t, err)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/models/batch_status", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	BatchUpdateModelStatus(ctx)

	var response struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
}
