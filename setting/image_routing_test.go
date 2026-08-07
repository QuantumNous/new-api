package setting

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestReadImageRoutingPlanUsesOneRevisionedOptionSnapshot(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = map[string]string{
		ImageRoutingConfigOption: `{
  "version": 1,
  "revision": 11,
  "enabled": true,
  "public_model": "image-auto",
  "public_group": "imageauto",
  "max_n": 4,
  "routes": [
    {"id":"alt","channel_id":36,"priority":30,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000},
    {"id":"enterprise","channel_id":108,"priority":10,"enabled":true,"billing_mode":"metered","upstream_model":"gpt-image-2","billing_model":"gpt-image-2","billing_group":"GPT企业旗舰","reserve_quota_by_quality":{"low":400000,"medium":800000,"high":2000000},"missing_usage_quota_by_quality":{"low":100000,"medium":400000,"high":1600000}}
  ]
	}`,
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = original
		common.OptionMapRWMutex.Unlock()
	})

	plan, enabled, err := BuildImageRoutingPlan("image-auto", "high", 1)
	require.NoError(t, err)
	require.True(t, enabled)
	require.Equal(t, 11, plan.Revision)
	require.Equal(t, 2000000, plan.ReserveQuota)

	plan, enabled, err = BuildImageRoutingPlan("another-model", "low", 1)
	require.NoError(t, err)
	require.False(t, enabled)
	require.Nil(t, plan)
}

func TestReadImageRoutingPlanRejectsMalformedOption(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = map[string]string{ImageRoutingConfigOption: `{not-json`}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = original
		common.OptionMapRWMutex.Unlock()
	})

	_, _, err := BuildImageRoutingPlan("image-auto", "low", 1)
	require.ErrorContains(t, err, "invalid image routing configuration")
}

func TestValidateImageRoutingConfigRejectsIncompleteMeteredQualityBounds(t *testing.T) {
	_, err := ValidateImageRoutingConfigJSON(`{
  "version":1,"revision":1,"enabled":true,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"enterprise","channel_id":108,"priority":1,"enabled":true,"billing_mode":"metered","upstream_model":"gpt-image-2","billing_model":"gpt-image-2","billing_group":"GPT企业旗舰","reserve_quota_by_quality":{"low":400000},"missing_usage_quota_by_quality":{"low":100000}}]
}`)
	require.ErrorContains(t, err, "medium")
}

func TestValidateImageRoutingConfigAcceptsDisabledButCompleteConfig(t *testing.T) {
	config, err := ValidateImageRoutingConfigJSON(`{
  "version":1,"revision":2,"enabled":false,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"alt","channel_id":36,"priority":1,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000}]
}`)
	require.NoError(t, err)
	require.False(t, config.Enabled)
}

func TestValidateImageRoutingConfigRejectsReferenceCapacityOutsideOneToSixteen(t *testing.T) {
	_, err := ValidateImageRoutingConfigJSON(`{
  "version":1,"revision":2,"enabled":true,"public_model":"image-auto","public_group":"imageauto","max_n":4,
  "routes":[{"id":"alt","channel_id":36,"priority":1,"enabled":true,"billing_mode":"fixed","upstream_model":"gpt-image-2","fixed_quota_per_image":100000,"max_reference_images":17}]
}`)
	require.ErrorContains(t, err, "max_reference_images")
}
