package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelMonitorAvailabilityAndRecentHistory(t *testing.T) {
	truncateTables(t)

	monitor := &ChannelMonitor{
		Name:            "ChatGPT Pro",
		ApiURL:          "https://example.com/v1",
		ApiKeyEncrypted: "encrypted",
		TestModel:       "gpt-test",
		IntervalSeconds: 60,
		TimeoutSeconds:  15,
		Enabled:         true,
		Visible:         true,
	}
	require.NoError(t, CreateChannelMonitor(monitor))

	results := []*ChannelMonitorHistory{
		{MonitorId: monitor.Id, Success: true, LatencyMs: 100, StatusCode: 200, CheckedAt: 1000},
		{MonitorId: monitor.Id, Success: false, LatencyMs: 200, StatusCode: 500, CheckedAt: 1100},
		{MonitorId: monitor.Id, Success: true, LatencyMs: 150, StatusCode: 200, CheckedAt: 1200},
	}
	for _, result := range results {
		require.NoError(t, DB.Create(result).Error)
	}

	availability, err := GetChannelMonitorAvailability(monitor.Id, 900)
	require.NoError(t, err)
	require.NotNil(t, availability)
	assert.Equal(t, 66.67, *availability)

	history, err := ListChannelMonitorHistory(monitor.Id, 2)
	require.NoError(t, err)
	require.Len(t, history, 2)
	assert.Equal(t, int64(1200), history[0].CheckedAt)
	assert.Equal(t, int64(1100), history[1].CheckedAt)
}

func TestClaimDueChannelMonitorsOnlyClaimsOncePerLease(t *testing.T) {
	truncateTables(t)

	now := int64(2000)
	monitor := &ChannelMonitor{
		Name:            "Claude Max",
		ApiURL:          "https://example.com/v1",
		ApiKeyEncrypted: "encrypted",
		TestModel:       "claude-test",
		IntervalSeconds: 60,
		TimeoutSeconds:  15,
		Enabled:         true,
		Visible:         true,
		NextCheckAt:     &now,
	}
	require.NoError(t, CreateChannelMonitor(monitor))

	first, err := ClaimDueChannelMonitors(now, 180, 10)
	require.NoError(t, err)
	require.Len(t, first, 1)
	assert.Equal(t, monitor.Id, first[0].Id)

	second, err := ClaimDueChannelMonitors(now, 180, 10)
	require.NoError(t, err)
	assert.Empty(t, second)
}

func TestUpdateChannelMonitorAvailabilityOverrides(t *testing.T) {
	truncateTables(t)

	manual7d := 99.5
	manual30d := 98.25
	monitor := &ChannelMonitor{
		Name:                  "Manual availability",
		ApiURL:                "https://example.com/v1",
		ApiKeyEncrypted:       "encrypted",
		TestModel:             "gpt-test",
		IntervalSeconds:       60,
		TimeoutSeconds:        15,
		Enabled:               true,
		Visible:               true,
		ManualAvailability7d:  &manual7d,
		ManualAvailability30d: &manual30d,
	}
	require.NoError(t, CreateChannelMonitor(monitor))

	manual7d = 97.75
	monitor.ManualAvailability7d = &manual7d
	monitor.ManualAvailability30d = nil
	require.NoError(t, UpdateChannelMonitor(monitor))

	updated, err := GetChannelMonitorByID(monitor.Id)
	require.NoError(t, err)
	require.NotNil(t, updated.ManualAvailability7d)
	assert.Equal(t, 97.75, *updated.ManualAvailability7d)
	assert.Nil(t, updated.ManualAvailability30d)
}
