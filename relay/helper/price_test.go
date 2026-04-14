package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelPriceHelperUsesSecondsPriceForChatCompatibleVideo(t *testing.T) {
	original := ratio_setting.ModelPriceBySeconds2JSONString()
	originalQuotaPerUnit := common.QuotaPerUnit
	defer func() {
		_ = ratio_setting.UpdateModelPriceBySecondsByJSONString(original)
		common.QuotaPerUnit = originalQuotaPerUnit
	}()

	common.QuotaPerUnit = 500
	require.NoError(t, ratio_setting.UpdateModelPriceBySecondsByJSONString(`{
		"veo31": {
			"4": 0.4,
			"8": 0.8
		}
	}`))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	duration := 8
	request := &dto.GeneralOpenAIRequest{
		Model:    "veo31",
		Duration: &duration,
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "veo31",
		UsingGroup:      "default",
		Request:         request,
	}

	priceData, err := ModelPriceHelper(c, info, 0, &types.TokenCountMeta{})

	require.NoError(t, err)
	assert.True(t, priceData.UsePrice)
	assert.Equal(t, 0.8, priceData.ModelPrice)
	assert.Equal(t, int(0.8*common.QuotaPerUnit), priceData.QuotaToPreConsume)
}

func TestModelPriceHelperUsesGroupResolutionPriceWithoutGroupRatio(t *testing.T) {
	originalGroupResolution := ratio_setting.GroupModelPriceByResolution2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	originalQuotaPerUnit := common.QuotaPerUnit
	defer func() {
		_ = ratio_setting.UpdateGroupModelPriceByResolutionByJSONString(originalGroupResolution)
		_ = ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio)
		common.QuotaPerUnit = originalQuotaPerUnit
	}()

	common.QuotaPerUnit = 500
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{
		"default": 1,
		"vip": 0.5
	}`))
	require.NoError(t, ratio_setting.UpdateGroupModelPriceByResolutionByJSONString(`{
		"vip": {
			"nano-banana-pro": {
				"2K": 0.12
			}
		}
	}`))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	request := &dto.GeneralOpenAIRequest{
		Model:            "nano-banana-pro",
		OutputResolution: "2K",
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "nano-banana-pro",
		UsingGroup:      "default",
		UserGroup:       "vip",
		Request:         request,
	}

	priceData, err := ModelPriceHelper(c, info, 0, &types.TokenCountMeta{})

	require.NoError(t, err)
	assert.True(t, priceData.UsePrice)
	assert.True(t, priceData.GroupPriceOverride)
	assert.Equal(t, "vip", priceData.GroupPriceOverrideGroup)
	assert.Equal(t, 0.12, priceData.ModelPrice)
	assert.Equal(t, 1.0, priceData.GroupRatioInfo.GroupRatio)
	assert.Equal(t, int(0.12*common.QuotaPerUnit), priceData.QuotaToPreConsume)
}

func TestModelPriceHelperUsesGroupPerCallPriceWithoutGroupRatio(t *testing.T) {
	originalGroupPrice := ratio_setting.GroupModelPrice2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	originalQuotaPerUnit := common.QuotaPerUnit
	defer func() {
		_ = ratio_setting.UpdateGroupModelPriceByJSONString(originalGroupPrice)
		_ = ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio)
		common.QuotaPerUnit = originalQuotaPerUnit
	}()

	common.QuotaPerUnit = 500
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{
		"default": 1,
		"vip": 0.5
	}`))
	require.NoError(t, ratio_setting.UpdateGroupModelPriceByJSONString(`{
		"vip": {
			"grok-imagine-1.0-edit": 0.02
		}
	}`))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	request := &dto.ImageRequest{
		Model: "grok-imagine-1.0-edit",
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-imagine-1.0-edit",
		UsingGroup:      "default",
		UserGroup:       "vip",
		Request:         request,
	}

	priceData, err := ModelPriceHelper(c, info, 0, &types.TokenCountMeta{})

	require.NoError(t, err)
	assert.True(t, priceData.UsePrice)
	assert.True(t, priceData.GroupPriceOverride)
	assert.Equal(t, "vip", priceData.GroupPriceOverrideGroup)
	assert.Equal(t, 0.02, priceData.ModelPrice)
	assert.Equal(t, 1.0, priceData.GroupRatioInfo.GroupRatio)
	assert.Equal(t, int(0.02*common.QuotaPerUnit), priceData.QuotaToPreConsume)
}

func TestModelPriceHelperFallsBackToSecondsMinPrice(t *testing.T) {
	original := ratio_setting.ModelPriceBySeconds2JSONString()
	originalQuotaPerUnit := common.QuotaPerUnit
	defer func() {
		_ = ratio_setting.UpdateModelPriceBySecondsByJSONString(original)
		common.QuotaPerUnit = originalQuotaPerUnit
	}()

	common.QuotaPerUnit = 500
	require.NoError(t, ratio_setting.UpdateModelPriceBySecondsByJSONString(`{
		"veo31": {
			"4": 0.4,
			"8": 0.8
		}
	}`))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	request := &dto.GeneralOpenAIRequest{
		Model: "veo31",
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: "veo31",
		UsingGroup:      "default",
		Request:         request,
	}

	priceData, err := ModelPriceHelper(c, info, 0, &types.TokenCountMeta{})

	require.NoError(t, err)
	assert.True(t, priceData.UsePrice)
	assert.Equal(t, 0.4, priceData.ModelPrice)
	assert.Equal(t, int(0.4*common.QuotaPerUnit), priceData.QuotaToPreConsume)
}
