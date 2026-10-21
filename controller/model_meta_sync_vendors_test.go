package controller

import (
	"encoding/json"
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
	"gorm.io/gorm/logger"
)

// setupSyncVendorsTestDB 建立独立的内存 SQLite 实例，隔离 SyncModelVendors 的测试。
func setupSyncVendorsTestDB(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	oldDB := model.DB
	oldMain := common.MainDatabaseType()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Model{}, &model.Vendor{}, &model.Option{}))
	model.DB = db

	t.Cleanup(func() {
		model.DB = oldDB
		common.SetDatabaseTypes(oldMain, oldMain)
	})
}

type syncVendorsResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Updated        int `json:"updated"`
		Unchanged      int `json:"unchanged"`
		Unmatched      int `json:"unmatched"`
		VendorsCreated int `json:"vendors_created"`
	} `json:"data"`
	Message string `json:"message"`
}

// TestSyncModelVendors_MatchesByIconAndName 覆盖 SyncModelVendors 的三种关键路径：
//   - icon 命中：doubao 模型有 `Doubao.Color` 图标 → 关联 ByteDance vendor
//   - 仅名称命中：`gpt-4o` 无图标 → 通过名称模式关联 OpenAI vendor
//   - 未命中：`some-custom-model` → unmatched，保留原 vendor_id=0
//   - 幂等：连跑两次，第二次 updated=0，unchanged=命中数
func TestSyncModelVendors_MatchesByIconAndName(t *testing.T) {
	setupSyncVendorsTestDB(t)

	// 预置模型：一个带图标、一个仅有可推断名称、一个完全不匹配
	require.NoError(t, model.DB.Create(&model.Model{ModelName: "doubao-seed-2.0-pro", Icon: "Doubao.Color", ModelType: model.ModelTypeText, Status: 1}).Error)
	require.NoError(t, model.DB.Create(&model.Model{ModelName: "gpt-4o", ModelType: model.ModelTypeText, Status: 1}).Error)
	require.NoError(t, model.DB.Create(&model.Model{ModelName: "some-custom-model", ModelType: model.ModelTypeText, Status: 1}).Error)

	// 首次调用：应种子化 vendors 并回填 2 条
	rr := doSyncVendors(t)
	require.True(t, rr.Success, "sync should succeed, msg=%s", rr.Message)
	assert.Equal(t, 2, rr.Data.Updated, "should update doubao + gpt-4o")
	assert.Equal(t, 0, rr.Data.Unchanged)
	assert.Equal(t, 1, rr.Data.Unmatched)
	assert.Greater(t, rr.Data.VendorsCreated, 0, "seed should create at least one vendor")

	// 校验实际写库的 vendor_id 确实指向 ByteDance / OpenAI
	var bytedance, openai model.Vendor
	require.NoError(t, model.DB.Where("name = ?", "ByteDance").First(&bytedance).Error)
	require.NoError(t, model.DB.Where("name = ?", "OpenAI").First(&openai).Error)

	var doubao model.Model
	require.NoError(t, model.DB.Where("model_name = ?", "doubao-seed-2.0-pro").First(&doubao).Error)
	assert.Equal(t, bytedance.Id, doubao.VendorID)

	var gpt model.Model
	require.NoError(t, model.DB.Where("model_name = ?", "gpt-4o").First(&gpt).Error)
	assert.Equal(t, openai.Id, gpt.VendorID)

	var unknown model.Model
	require.NoError(t, model.DB.Where("model_name = ?", "some-custom-model").First(&unknown).Error)
	assert.Equal(t, 0, unknown.VendorID, "unmatched model must retain original vendor_id")

	// 幂等：再跑一次，updated=0，unchanged=2
	rr2 := doSyncVendors(t)
	require.True(t, rr2.Success)
	assert.Equal(t, 0, rr2.Data.Updated, "idempotent second run should not update")
	assert.Equal(t, 2, rr2.Data.Unchanged, "matched models should remain unchanged")
	assert.Equal(t, 1, rr2.Data.Unmatched)
	assert.Equal(t, 0, rr2.Data.VendorsCreated, "vendors already seeded")
}

// TestSyncModelVendors_PreservesManualVendorEdits 保证同步不覆盖管理员手工修改后的
// display_name / icon（UpsertVendorByName 幂等语义）。
func TestSyncModelVendors_PreservesManualVendorEdits(t *testing.T) {
	setupSyncVendorsTestDB(t)

	// 先手动建一个已定制的 OpenAI vendor
	custom := &model.Vendor{Name: "OpenAI", DisplayName: "自定义 OpenAI 代理", Icon: "Custom.Icon", Status: 1}
	require.NoError(t, custom.Insert())

	require.NoError(t, model.DB.Create(&model.Model{ModelName: "gpt-4o", ModelType: model.ModelTypeText, Status: 1}).Error)

	rr := doSyncVendors(t)
	require.True(t, rr.Success)
	assert.Equal(t, 1, rr.Data.Updated)

	var v model.Vendor
	require.NoError(t, model.DB.Where("name = ?", "OpenAI").First(&v).Error)
	assert.Equal(t, "自定义 OpenAI 代理", v.DisplayName, "manual display_name must not be overwritten")
	assert.Equal(t, "Custom.Icon", v.Icon, "manual icon must not be overwritten")
}

func doSyncVendors(t *testing.T) syncVendorsResponse {
	t.Helper()
	router := gin.New()
	router.POST("/api/models/sync_vendors", SyncModelVendors)
	req := httptest.NewRequest(http.MethodPost, "/api/models/sync_vendors", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "body=%s", w.Body.String())

	var rr syncVendorsResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &rr))
	return rr
}
