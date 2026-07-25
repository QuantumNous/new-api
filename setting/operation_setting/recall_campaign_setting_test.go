package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

func TestRecallCampaignSettingDefaultsDisabled(t *testing.T) {
	require.False(t, IsRecallCampaignEnabled())
}

func TestRecallCampaignSettingDefaultsBatchSize(t *testing.T) {
	require.Equal(t, 100, GetRecallCampaignSetting().BatchSize)
}

func TestRecallCampaignSettingDefaultsTickSeconds(t *testing.T) {
	require.Equal(t, 30, GetRecallCampaignSetting().TickSeconds)
}

func TestRecallCampaignSettingLoadsFromConfigMap(t *testing.T) {
	cfg := RecallCampaignSetting{}

	err := config.UpdateConfigFromMap(&cfg, map[string]string{
		"enabled":      "true",
		"batch_size":   "25",
		"tick_seconds": "15",
	})

	require.NoError(t, err)
	require.True(t, cfg.Enabled)
	require.Equal(t, 25, cfg.BatchSize)
	require.Equal(t, 15, cfg.TickSeconds)
}

func TestRecallCampaignSettingNormalizeAndValidate(t *testing.T) {
	cfg := RecallCampaignSetting{BatchSize: 25, TickSeconds: 15}
	require.NoError(t, cfg.NormalizeAndValidate())

	cfg = RecallCampaignSetting{BatchSize: 0, TickSeconds: 30}
	require.Error(t, cfg.NormalizeAndValidate())
}
