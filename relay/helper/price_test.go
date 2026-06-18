package helper

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestModelPriceHelperTieredUsesPreloadedRequestInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	saved := map[string]string{}
	require.NoError(t, config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}))
	t.Cleanup(func() {
		require.NoError(t, config.GlobalConfig.LoadFromDB(saved))
	})

	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"tiered-test-model":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"tiered-test-model":"param(\"stream\") == true ? tier(\"stream\", p * 3) : tier(\"base\", p * 2)"}`,
	}))

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/api/channel/test/1", nil)
	req.Body = nil
	req.ContentLength = 0
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	ctx.Set("group", "default")

	info := &relaycommon.RelayInfo{
		OriginModelName: "tiered-test-model",
		UserGroup:       "default",
		UsingGroup:      "default",
		RequestHeaders:  map[string]string{"Content-Type": "application/json"},
		BillingRequestInput: &billingexpr.RequestInput{
			Headers: map[string]string{"Content-Type": "application/json"},
			Body:    []byte(`{"stream":true}`),
		},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	require.Equal(t, 1500, priceData.QuotaToPreConsume)
	require.NotNil(t, info.TieredBillingSnapshot)
	require.Equal(t, "stream", info.TieredBillingSnapshot.EstimatedTier)
	require.Equal(t, billing_setting.BillingModeTieredExpr, info.TieredBillingSnapshot.BillingMode)
	require.Equal(t, common.QuotaPerUnit, info.TieredBillingSnapshot.QuotaPerUnit)
}

func TestModelPriceHelperGroupPerRequestOverridesRatioModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	helperSeedGroupPricingModel(t,
		"grp-mode-model",
		map[string]float64{"grp-mode-model": 2}, // model ratio (per-token)
		`{"c":{"billing_mode":"per-request","model_price":0.03}}`,
		[]string{"c"},
	)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set("group", "c")

	info := &relaycommon.RelayInfo{
		OriginModelName: "grp-mode-model",
		UserGroup:       "c",
		UsingGroup:      "c",
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	require.True(t, priceData.UsePrice, "group pinned per-request -> UsePrice forced true")
	require.Equal(t, 0.03, priceData.ModelPrice, "group model_price applied")
}

func TestModelPriceHelperGroupTieredExprUsesGroupExpression(t *testing.T) {
	gin.SetMode(gin.TestMode)
	helperSeedGroupPricingModel(t,
		"grp-expr-model",
		map[string]float64{"grp-expr-model": 2},
		`{"c":{"billing_mode":"tiered_expr","billing_expr":"tier(\"base\", p * 7)"}}`,
		[]string{"c"},
	)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req.Body = nil
	req.ContentLength = 0
	ctx.Request = req
	ctx.Set("group", "c")

	info := &relaycommon.RelayInfo{
		OriginModelName: "grp-expr-model",
		UserGroup:       "c",
		UsingGroup:      "c",
		BillingRequestInput: &billingexpr.RequestInput{
			Headers: map[string]string{},
			Body:    []byte(`{}`),
		},
	}

	priceData, err := ModelPriceHelper(ctx, info, 1000, &types.TokenCountMeta{})
	require.NoError(t, err)
	require.NotNil(t, info.TieredBillingSnapshot)
	require.Equal(t, `tier("base", p * 7)`, info.TieredBillingSnapshot.ExprString)
	require.Equal(t, int(7000.0/1_000_000*common.QuotaPerUnit), priceData.QuotaToPreConsume)
}

func helperSeedGroupPricingModel(t *testing.T, modelName string, ratios map[string]float64, groupPricingJSON string, groups []string) {
	t.Helper()

	oldDB := model.DB
	oldUsingSQLite := common.UsingSQLite
	oldRedis := common.RedisEnabled
	common.UsingSQLite = true
	common.RedisEnabled = false

	dsn := "file:" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.Model{}, &model.Vendor{}, &model.Channel{}, &model.Ability{}))
	model.InvalidatePricingCache()

	require.NoError(t, db.Create(&model.Model{
		ModelName: modelName, Status: 1, SyncOfficial: 1, GroupPricing: groupPricingJSON,
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id: 1, Type: constant.ChannelTypeOpenAI, Key: "k", Status: 1, Name: "ch",
	}).Error)
	for _, g := range groups {
		require.NoError(t, db.Create(&model.Ability{
			Group: g, Model: modelName, ChannelId: 1, Enabled: true,
		}).Error)
	}

	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(mustJSON(t, ratios)))
	model.GetPricing()

	t.Cleanup(func() {
		model.InvalidatePricingCache()
		model.DB = oldDB
		common.UsingSQLite = oldUsingSQLite
		common.RedisEnabled = oldRedis
		_ = ratio_setting.UpdateModelRatioByJSONString("{}")
		if sqlDB, e := db.DB(); e == nil {
			_ = sqlDB.Close()
		}
	})
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return string(b)
}

func TestModelPriceHelperPerCallGroupPerRequestForcesPerCall(t *testing.T) {
	gin.SetMode(gin.TestMode)
	helperSeedGroupPricingModel(t,
		"task-grp-model",
		map[string]float64{"task-grp-model": 2},
		`{"c":{"billing_mode":"per-request","model_price":0.05}}`,
		[]string{"c"},
	)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/mj/submit", nil)
	ctx.Set("group", "c")

	info := &relaycommon.RelayInfo{
		OriginModelName: "task-grp-model",
		UserGroup:       "c",
		UsingGroup:      "c",
	}

	priceData, err := ModelPriceHelperPerCall(ctx, info)
	require.NoError(t, err)
	require.True(t, priceData.UsePrice, "group per-request forces per-call billing on task surface")
	require.Equal(t, 0.05, priceData.ModelPrice)
	require.Equal(t, int(0.05*common.QuotaPerUnit), priceData.Quota)
}
