package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMonitorSetting_ChannelTestEnabledEnvOverridesEnabledConfig(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_ENABLED", "false")
	t.Setenv("CHANNEL_TEST_FREQUENCY", "5")
	monitorSetting = MonitorSetting{
		AutoTestChannelEnabled: true,
		AutoTestChannelMinutes: 20,
	}

	setting := GetMonitorSetting()

	require.NotNil(t, setting)
	assert.False(t, setting.AutoTestChannelEnabled)
	assert.Equal(t, float64(5), setting.AutoTestChannelMinutes)
}

func TestGetMonitorSetting_ChannelTestEnabledEnvCanEnableDisabledConfig(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_ENABLED", "true")
	monitorSetting = MonitorSetting{
		AutoTestChannelEnabled: false,
		AutoTestChannelMinutes: 12,
	}

	setting := GetMonitorSetting()

	require.NotNil(t, setting)
	assert.True(t, setting.AutoTestChannelEnabled)
	assert.Equal(t, float64(12), setting.AutoTestChannelMinutes)
}

func TestGetMonitorSetting_ChannelTestConcurrencyNormalizedToAtLeastOne(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	// A non-positive stored value (e.g. an unset legacy option) must normalize to 1
	// so the batch test never runs with a zero-sized worker pool.
	monitorSetting = MonitorSetting{ChannelTestConcurrency: 0}

	setting := GetMonitorSetting()

	require.NotNil(t, setting)
	assert.Equal(t, 1, setting.ChannelTestConcurrency)
}

func TestGetMonitorSetting_ChannelTestConcurrencyEnvOverride(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_CONCURRENCY", "8")
	monitorSetting = MonitorSetting{ChannelTestConcurrency: 1}

	setting := GetMonitorSetting()

	require.NotNil(t, setting)
	assert.Equal(t, 8, setting.ChannelTestConcurrency)
}
