package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRetryParamPreservesImageRequirementAcrossSelections(t *testing.T) {
	previousPrices := ratio_setting.ImageResolutionPrice2JSONString()
	require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(`{"gpt-image-2":{"1K":0.25,"4K":1.2}}`))
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(previousPrices)) })
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	model.ClearChannelCacheForTest()
	t.Cleanup(func() {
		model.ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(100)
	oneK := &model.Channel{Id: 65, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	fourK := &model.Channel{Id: 108, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	oneK.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: imageRoutingForServiceTest([]string{"1K"}, []string{"1024x1024"})})
	fourK.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: imageRoutingForServiceTest([]string{"4K"}, []string{"2880x2880"})})
	model.SetChannelCacheForTest(map[int]*model.Channel{65: oneK, 108: fourK}, map[string]map[string][]int{
		"default": {"gpt-image-2": {65, 108}},
	})

	ctx, _ := gin.CreateTestContext(nil)
	requirement := &dto.ImageSelectionRequirement{
		Operation:   dto.ImageOperationGeneration,
		Resolution:  "4K",
		AspectRatio: "1:1",
		Size:        "2880x2880",
		Quality:     "low",
	}
	param := &RetryParam{
		Ctx:              ctx,
		TokenGroup:       "default",
		ModelName:        "gpt-image-2",
		RequestPath:      "/v1/images/generations",
		ImageRequirement: requirement,
	}

	selected, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "default", group)
	assert.Equal(t, 108, selected.Id)

	param.ExcludedChannelIDs = map[int]struct{}{108: {}}
	param.IncreaseRetry()
	selected, _, err = CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	assert.Nil(t, selected, "retry must keep the original image requirement")
}

func TestAutoGroupImageSelectionDoesNotStartOnLegacyGroupAfterExplicitMigration(t *testing.T) {
	_, param := setupAutoGroupImageRoutingMigrationTest(t)
	param.ExcludedChannelIDs = map[int]struct{}{108: {}}

	selected, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	assert.Nil(t, selected)
	assert.Equal(t, "auto", group)
}

func TestAutoGroupImageSelectionDoesNotRetryIntoLegacyGroupAfterExplicitMigration(t *testing.T) {
	_, param := setupAutoGroupImageRoutingMigrationTest(t)

	selected, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, 108, selected.Id)
	assert.Equal(t, "group-a", group)

	param.ExcludedChannelIDs = map[int]struct{}{108: {}}
	param.IncreaseRetry()
	selected, group, err = CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	assert.Nil(t, selected)
	assert.Equal(t, "auto", group)
}

func setupAutoGroupImageRoutingMigrationTest(t *testing.T) (*gin.Context, *RetryParam) {
	t.Helper()
	previousPrices := ratio_setting.ImageResolutionPrice2JSONString()
	oldAutoGroups := setting.AutoGroups2JsonString()
	oldUsableGroups := setting.UserUsableGroups2JSONString()
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(`{"gpt-image-2":{"4K":1.2}}`))
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["group-a","group-b"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"group-a":"A","group-b":"B"}`))
	common.MemoryCacheEnabled = true
	model.ClearChannelCacheForTest()
	t.Cleanup(func() {
		model.ClearChannelCacheForTest()
		require.NoError(t, ratio_setting.UpdateImageResolutionPriceByJSONString(previousPrices))
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(oldAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(oldUsableGroups))
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
	})

	priority := int64(10)
	weight := uint(100)
	legacy := &model.Channel{Id: 31, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	fourK := &model.Channel{Id: 108, Status: common.ChannelStatusEnabled, Weight: &weight, Priority: &priority}
	fourK.SetOtherSettings(dto.ChannelOtherSettings{ImageRouting: imageRoutingForServiceTest([]string{"4K"}, []string{"2880x2880"})})
	model.SetChannelCacheForTest(map[int]*model.Channel{31: legacy, 108: fourK}, map[string]map[string][]int{
		"group-a": {"gpt-image-2": {108}},
		"group-b": {"gpt-image-2": {31}},
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	return ctx, &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "auto",
		ModelName:   "gpt-image-2",
		RequestPath: "/v1/images/generations",
		Retry:       common.GetPointer(0),
		ImageRequirement: &dto.ImageSelectionRequirement{
			Operation:   dto.ImageOperationGeneration,
			Resolution:  "4K",
			AspectRatio: "1:1",
			Size:        "2880x2880",
			Quality:     "low",
		},
	}
}

func imageRoutingForServiceTest(resolutions []string, sizes []string) *dto.ImageRoutingConfig {
	combinations := make([]dto.ImageRoutingCombination, 0, len(resolutions))
	for i, resolution := range resolutions {
		combination := dto.ImageRoutingCombination{Resolution: resolution, AspectRatio: "1:1"}
		if i < len(sizes) {
			combination.Size = sizes[i]
		}
		combinations = append(combinations, combination)
	}
	return &dto.ImageRoutingConfig{
		Version: dto.ImageRoutingVersion1,
		Profiles: []dto.ImageRoutingProfile{
			{
				Model:               "gpt-image-2",
				Protocol:            dto.ImageRoutingProtocolImagesGenerations,
				UpstreamPath:        "/v1/images/generations",
				Operations:          []dto.ImageOperation{dto.ImageOperationGeneration},
				Resolutions:         resolutions,
				AspectRatios:        []string{"1:1"},
				Sizes:               sizes,
				Qualities:           []string{"low"},
				AllowedCombinations: combinations,
				VerificationStatus:  dto.ImageRoutingVerificationProductionVerified,
			},
		},
	}
}
