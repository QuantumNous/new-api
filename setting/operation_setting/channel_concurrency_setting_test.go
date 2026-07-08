package operation_setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestChannelConcurrencySettingDefaultsAndClamps(t *testing.T) {
	setting := GetChannelConcurrencySetting()

	require.True(t, setting.WaitEnabled)
	require.True(t, setting.CooldownEnabled)
	require.Equal(t, 30, GetChannelConcurrencySlotTTLMinutes())
	require.Equal(t, 5*time.Second, GetChannelConcurrencyWaitTimeout())
	require.Equal(t, 100*time.Millisecond, GetChannelConcurrencyWaitInterval())
	require.Equal(t, 30*time.Second, GetChannelConcurrencyCooldown())
	require.Equal(t, 3, GetChannelConcurrencyMaxWaiting(3))
	require.Equal(t, 1, GetChannelConcurrencyMaxWaiting(0))

	original := setting
	t.Cleanup(func() {
		SetChannelConcurrencySettingForTest(original)
	})

	setting.SlotTTLMinutes = -1
	setting.WaitTimeoutMS = 0
	setting.WaitIntervalMS = -10
	setting.CooldownSeconds = 0
	setting.MaxWaitingPerChannel = 7
	SetChannelConcurrencySettingForTest(setting)

	require.Equal(t, 30, GetChannelConcurrencySlotTTLMinutes())
	require.Equal(t, 5*time.Second, GetChannelConcurrencyWaitTimeout())
	require.Equal(t, 100*time.Millisecond, GetChannelConcurrencyWaitInterval())
	require.Equal(t, 30*time.Second, GetChannelConcurrencyCooldown())
	require.Equal(t, 7, GetChannelConcurrencyMaxWaiting(3))
}

func TestChannelConcurrencySettingRejectsExtremeDurations(t *testing.T) {
	original := GetChannelConcurrencySetting()
	t.Cleanup(func() {
		SetChannelConcurrencySettingForTest(original)
	})

	setting := original
	setting.SlotTTLMinutes = maxChannelConcurrencySlotTTLMinutes + 1
	setting.WaitTimeoutMS = maxChannelConcurrencyWaitTimeoutMS + 1
	setting.WaitIntervalMS = maxChannelConcurrencyWaitIntervalMS + 1
	setting.CooldownSeconds = maxChannelConcurrencyCooldownSeconds + 1
	setting.MaxWaitingPerChannel = maxChannelConcurrencyMaxWaitingPerChannel + 1
	SetChannelConcurrencySettingForTest(setting)

	require.Equal(t, defaultChannelConcurrencySlotTTLMinutes, GetChannelConcurrencySlotTTLMinutes())
	require.Equal(t, time.Duration(defaultChannelConcurrencyWaitTimeoutMS)*time.Millisecond, GetChannelConcurrencyWaitTimeout())
	require.Equal(t, time.Duration(defaultChannelConcurrencyWaitIntervalMS)*time.Millisecond, GetChannelConcurrencyWaitInterval())
	require.Equal(t, time.Duration(defaultChannelConcurrencyCooldownSecs)*time.Second, GetChannelConcurrencyCooldown())
	require.Equal(t, maxChannelConcurrencyMaxWaitingPerChannel, GetChannelConcurrencyMaxWaiting(1))
}

func TestGetChannelConcurrencySettingReturnsSnapshot(t *testing.T) {
	original := GetChannelConcurrencySetting()
	t.Cleanup(func() {
		SetChannelConcurrencySettingForTest(original)
	})

	snapshot := GetChannelConcurrencySetting()
	snapshot.WaitTimeoutMS = 1

	require.NotEqual(t, 1*time.Millisecond, GetChannelConcurrencyWaitTimeout())
}
