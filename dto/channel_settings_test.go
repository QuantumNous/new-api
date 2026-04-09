package dto

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/QuantumNous/new-api/common"
)

func TestChannelSettings_GovernorRoundTrip(t *testing.T) {
	raw := `
{
  "proxy": "https://example.com/proxy",
  "governor": {
    "enabled": true,
    "channel_max_rpm": 120,
    "channel_cooldown_seconds": 30,
    "channel_cooldown_on_statuses": [2, 3],
    "key_max_concurrency": 5,
    "key_cooldown_seconds": 10,
    "key_cooldown_on_statuses": [2],
    "reservation_lease_seconds": 60,
    "reservation_heartbeat_seconds": 15,
    "short_wait_ms": 200,
    "respect_retry_after": true
  }
}
`

	var settings ChannelSettings
	require.NoError(t, common.Unmarshal([]byte(raw), &settings))
	require.NotNil(t, settings.Governor)
	require.True(t, settings.Governor.Enabled)
	require.Equal(t, 120, settings.Governor.ChannelMaxRPM)
	require.Equal(t, 30, settings.Governor.ChannelCooldownSeconds)
	require.Equal(t, []int{2, 3}, settings.Governor.ChannelCooldownOnStatuses)
	require.Equal(t, 5, settings.Governor.KeyMaxConcurrency)
	require.Equal(t, 10, settings.Governor.KeyCooldownSeconds)
	require.Equal(t, []int{2}, settings.Governor.KeyCooldownOnStatuses)
	require.Equal(t, 60, settings.Governor.ReservationLeaseSeconds)
	require.Equal(t, 15, settings.Governor.ReservationHeartbeatSeconds)
	require.Equal(t, 200, settings.Governor.ShortWaitMs)
	require.True(t, settings.Governor.RespectRetryAfter)

	marshaled, err := common.Marshal(settings)
	require.NoError(t, err)

	var roundTrip ChannelSettings
	require.NoError(t, common.Unmarshal(marshaled, &roundTrip))
	require.NotNil(t, roundTrip.Governor)
	require.Equal(t, settings.Governor, roundTrip.Governor)
}
