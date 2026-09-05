package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestAdminOptionEditInvalidatesPricing(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.Log{}))
	saved := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() { _ = ratio_setting.UpdateModelRatioByJSONString(saved); model.InvalidatePricingCache() })
	model.InitOptionMap()
	selfUse := operation_setting.SelfUseModeEnabled
	operation_setting.SelfUseModeEnabled = false
	t.Cleanup(func() { operation_setting.SelfUseModeEnabled = selfUse })
	require.NoError(t, model.UpdateOption("ModelRatio", `{"runtime-price-test":1}`))
	require.NoError(t, db.Create(&model.Channel{Id: 801, Type: 1, Key: "local", Status: common.ChannelStatusEnabled, Name: "runtime", Group: "default", Models: "runtime-price-test"}).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "runtime-price-test", ChannelId: 801, Enabled: true}).Error)
	require.NoError(t, db.Create(&model.Ability{Group: "default", Model: "runtime-unpriced-test", ChannelId: 801, Enabled: true}).Error)
	model.InitChannelCache()
	initial := model.GetPricing()
	require.Len(t, initial, 2)
	for _, price := range initial {
		if price.ModelName == "runtime-price-test" {
			require.True(t, price.PriceConfigured)
			require.Equal(t, 1.0, price.ModelRatio)
		} else {
			require.False(t, price.PriceConfigured)
		}
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(`{"key":"ModelRatio","value":"{\"runtime-price-test\":2}"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")
	UpdateOption(ctx)
	require.Contains(t, recorder.Body.String(), `"success":true`)
	updated := model.GetPricing()
	require.Len(t, updated, 2)
	for _, price := range updated {
		if price.ModelName == "runtime-price-test" {
			require.Equal(t, 2.0, price.ModelRatio)
		}
	}
}
