package operation_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// applyMonitorConfig 走真实的热更新路径写入配置，等价于周期同步从数据库同步下来的一轮。
func applyMonitorConfig(t *testing.T, values map[string]string) {
	t.Helper()
	require.NoError(t, config.UpdateConfigFromMap(&monitorSetting, values))
}

// 环境变量的优先级必须高于数据库配置。周期同步每 60 秒会把数据库的值写回 monitorSetting，
// 因此 env 覆盖必须在每次写入后重新套用，否则运维通过 env 做的强制设置会被静默冲掉。
func TestMonitorSettingChannelTestEnabledEnvOverridesEnabledConfig(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_ENABLED", "false")
	t.Setenv("CHANNEL_TEST_FREQUENCY", "5")

	applyMonitorConfig(t, map[string]string{
		"auto_test_channel_enabled": "true",
		"auto_test_channel_minutes": "20",
	})

	setting := GetMonitorSetting()
	require.NotNil(t, setting)
	assert.False(t, setting.AutoTestChannelEnabled)
	assert.Equal(t, float64(5), setting.AutoTestChannelMinutes)
}

func TestMonitorSettingChannelTestEnabledEnvCanEnableDisabledConfig(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_ENABLED", "true")

	applyMonitorConfig(t, map[string]string{
		"auto_test_channel_enabled": "false",
		"auto_test_channel_minutes": "12",
	})

	setting := GetMonitorSetting()
	require.NotNil(t, setting)
	assert.True(t, setting.AutoTestChannelEnabled)
	assert.Equal(t, float64(12), setting.AutoTestChannelMinutes)
}

// 未知的测试模式必须在写入时被收敛，而不是在每次读取时。
func TestMonitorSettingNormalizesUnknownTestModeOnUpdate(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	applyMonitorConfig(t, map[string]string{"channel_test_mode": "bogus_mode"})
	assert.Equal(t, ChannelTestModeScheduledAll, GetMonitorSetting().ChannelTestMode)

	applyMonitorConfig(t, map[string]string{"channel_test_mode": ChannelTestModePassiveRecovery})
	assert.Equal(t, ChannelTestModePassiveRecovery, GetMonitorSetting().ChannelTestMode)
}

// GetMonitorSetting 必须是纯读取。它曾经在每次调用时写入共享结构体，导致两个并发的读取
// 就能互相写同一份状态，与是否有配置更新无关。
func TestGetMonitorSettingDoesNotMutateSharedState(t *testing.T) {
	orig := monitorSetting
	t.Cleanup(func() { monitorSetting = orig })

	t.Setenv("CHANNEL_TEST_FREQUENCY", "7")
	applyMonitorConfig(t, map[string]string{"channel_test_mode": ChannelTestModePassiveRecovery})

	before := monitorSetting
	for i := 0; i < 10; i++ {
		_ = GetMonitorSetting()
	}
	assert.Equal(t, before, monitorSetting, "GetMonitorSetting 不应修改共享状态")
}
