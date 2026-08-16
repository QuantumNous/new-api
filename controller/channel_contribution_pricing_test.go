package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestBuildChannelContributionTestRunResponseUsesCurrentSystemPricing(t *testing.T) {
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
	})
	require.NoError(t, db.AutoMigrate(
		&model.ChannelContributionRevision{},
		&model.ChannelContributionTestRun{},
		&model.ChannelContributionTestResult{},
	))

	previousPrices := ratio_setting.ModelPrice2JSONString()
	previousRatios := ratio_setting.ModelRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(previousPrices))
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousRatios))
	})
	require.NoError(t, ratio_setting.UpdateModelPriceByJSONString(`{}`))
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"central-priced-model":1}`))

	revision := &model.ChannelContributionRevision{
		ContributionId: 1,
		Models:         "central-priced-model",
	}
	require.NoError(t, db.Create(revision).Error)
	run := &model.ChannelContributionTestRun{
		ContributionId: 1,
		RevisionId:     revision.Id,
		PricingReady:   false,
	}
	require.NoError(t, db.Create(run).Error)
	require.NoError(t, db.Create(&model.ChannelContributionTestResult{
		TestRunId:  run.Id,
		RevisionId: revision.Id,
		Model:      "central-priced-model",
		Success:    true,
	}).Error)

	response, err := buildChannelContributionTestRunResponse(run, true)
	require.NoError(t, err)
	assert.True(t, response.PricingReady)
	require.Len(t, response.Results, 1)
	assert.True(t, response.Results[0].PriceConfigured)

	run.PricingReady = true
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{}`))
	response, err = buildChannelContributionTestRunResponse(run, true)
	require.NoError(t, err)
	assert.False(t, response.PricingReady)
	require.Len(t, response.Results, 1)
	assert.False(t, response.Results[0].PriceConfigured)
}
