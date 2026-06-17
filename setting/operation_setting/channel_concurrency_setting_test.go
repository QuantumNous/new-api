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

	original := *setting
	t.Cleanup(func() {
		*setting = original
	})

	setting.SlotTTLMinutes = -1
	setting.WaitTimeoutMS = 0
	setting.WaitIntervalMS = -10
	setting.CooldownSeconds = 0
	setting.MaxWaitingPerChannel = 7

	require.Equal(t, 30, GetChannelConcurrencySlotTTLMinutes())
	require.Equal(t, 5*time.Second, GetChannelConcurrencyWaitTimeout())
	require.Equal(t, 100*time.Millisecond, GetChannelConcurrencyWaitInterval())
	require.Equal(t, 30*time.Second, GetChannelConcurrencyCooldown())
	require.Equal(t, 7, GetChannelConcurrencyMaxWaiting(3))
}
