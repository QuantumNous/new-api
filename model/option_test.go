package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/require"
)

func setupOptionMapForTest(t *testing.T) {
	t.Helper()

	common.OptionMapRWMutex.Lock()
	previousOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()

	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptionMap
		common.OptionMapRWMutex.Unlock()
	})
}

func TestBackfillRequiredModelRatioOptionsAddsMissingClaudeSonnet46(t *testing.T) {
	setupChannelPreparationModelTestDB(t)
	setupOptionMapForTest(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))

	savedRatioConfig := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatioConfig))
	})

	ratioConfig := map[string]float64{
		"anthropic.claude-sonnet-4-6": 1.7,
		"claude-opus-4-7":             2.5,
	}
	payload, err := common.Marshal(ratioConfig)
	require.NoError(t, err)
	require.NoError(t, DB.Create(&Option{Key: "ModelRatio", Value: string(payload)}).Error)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(payload)))

	backfillRequiredModelRatioOptions()

	var option Option
	require.NoError(t, DB.First(&option, "key = ?", "ModelRatio").Error)

	updatedRatioConfig := map[string]float64{}
	require.NoError(t, common.Unmarshal([]byte(option.Value), &updatedRatioConfig))
	require.Equal(t, 1.7, updatedRatioConfig["claude-sonnet-4-6"])
	require.Equal(t, 1.7, updatedRatioConfig["anthropic.claude-sonnet-4-6"])

	ratio, ok, matchedModel := ratio_setting.GetModelRatio("claude-sonnet-4-6")
	require.True(t, ok)
	require.Equal(t, "claude-sonnet-4-6", matchedModel)
	require.Equal(t, 1.7, ratio)
}

func TestBackfillRequiredModelRatioOptionsPreservesExistingClaudeSonnet46(t *testing.T) {
	setupChannelPreparationModelTestDB(t)
	setupOptionMapForTest(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))

	savedRatioConfig := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(savedRatioConfig))
	})

	ratioConfig := map[string]float64{
		"claude-sonnet-4-6":           1.2,
		"anthropic.claude-sonnet-4-6": 1.7,
	}
	payload, err := common.Marshal(ratioConfig)
	require.NoError(t, err)
	require.NoError(t, DB.Create(&Option{Key: "ModelRatio", Value: string(payload)}).Error)
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(string(payload)))

	backfillRequiredModelRatioOptions()

	var option Option
	require.NoError(t, DB.First(&option, "key = ?", "ModelRatio").Error)

	updatedRatioConfig := map[string]float64{}
	require.NoError(t, common.Unmarshal([]byte(option.Value), &updatedRatioConfig))
	require.Equal(t, 1.2, updatedRatioConfig["claude-sonnet-4-6"])
}
