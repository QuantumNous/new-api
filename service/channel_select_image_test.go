package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRetryParamPreservesImageRequirementAcrossSelections(t *testing.T) {
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
