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

// restoreMonitorSetting 同时还原写入目标与已发布的快照。
func restoreMonitorSetting(t *testing.T) {
	t.Helper()
	orig := monitorSetting
	origSnapshot := monitorSnapshot.Load()
	t.Cleanup(func() {
		monitorSetting = orig
		monitorSnapshot.Store(origSnapshot)
	})
}

// 环境变量的优先级必须高于数据库配置。周期同步每 60 秒会把数据库的值写回 monitorSetting，
// 因此 env 覆盖必须在每次写入后重新套用，否则运维通过 env 做的强制设置会被静默冲掉。
func TestMonitorSettingChannelTestEnabledEnvOverridesEnabledConfig(t *testing.T) {
	restoreMonitorSetting(t)

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
	restoreMonitorSetting(t)

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
	restoreMonitorSetting(t)

	applyMonitorConfig(t, map[string]string{"channel_test_mode": "bogus_mode"})
	assert.Equal(t, ChannelTestModeScheduledAll, GetMonitorSetting().ChannelTestMode)

	applyMonitorConfig(t, map[string]string{"channel_test_mode": ChannelTestModePassiveRecovery})
	assert.Equal(t, ChannelTestModePassiveRecovery, GetMonitorSetting().ChannelTestMode)
}

// GetMonitorSetting 必须是纯读取。它曾经在每次调用时写入共享结构体，导致两个并发的读取
// 就能互相写同一份状态，与是否有配置更新无关。
func TestGetMonitorSettingDoesNotMutateSharedState(t *testing.T) {
	restoreMonitorSetting(t)

	t.Setenv("CHANNEL_TEST_FREQUENCY", "7")
	applyMonitorConfig(t, map[string]string{"channel_test_mode": ChannelTestModePassiveRecovery})

	before := monitorSetting
	for i := 0; i < 10; i++ {
		_ = GetMonitorSetting()
	}
	assert.Equal(t, before, monitorSetting, "GetMonitorSetting 不应修改共享状态")
}

// 返回的快照必须与热更新的写入目标解耦。ChannelTestMode 是 string，属于指针 + 长度的
// 双字写入，读者直接持有写入目标的指针就可能读到"新指针 + 旧长度"的撕裂组合。
func TestGetMonitorSettingReturnsDecoupledSnapshot(t *testing.T) {
	restoreMonitorSetting(t)

	applyMonitorConfig(t, map[string]string{
		"channel_test_mode":         ChannelTestModePassiveRecovery,
		"auto_test_channel_minutes": "15",
	})
	held := GetMonitorSetting()
	require.Equal(t, ChannelTestModePassiveRecovery, held.ChannelTestMode)
	require.Equal(t, float64(15), held.AutoTestChannelMinutes)

	applyMonitorConfig(t, map[string]string{
		"channel_test_mode":         ChannelTestModeScheduledAll,
		"auto_test_channel_minutes": "99",
	})

	assert.Equal(t, ChannelTestModePassiveRecovery, held.ChannelTestMode, "已取得的快照不应被后续热更新改写")
	assert.Equal(t, float64(15), held.AutoTestChannelMinutes)
	assert.Equal(t, ChannelTestModeScheduledAll, GetMonitorSetting().ChannelTestMode, "新快照应反映最新配置")
}

// 快照必须在任何配置写入之前就可用，否则启动早期的读取会拿到 nil。
func TestMonitorSnapshotAvailableBeforeAnyUpdate(t *testing.T) {
	setting := GetMonitorSetting()
	require.NotNil(t, setting)
	assert.NotEmpty(t, setting.ChannelTestMode)
}
