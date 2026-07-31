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

func TestUpdateChannelMonitorAvailabilityBoost(t *testing.T) {
	truncateTables(t)

	monitor := &ChannelMonitor{
		Name:                     "Availability boost",
		ApiURL:                   "https://example.com/v1",
		ApiKeyEncrypted:          "encrypted",
		TestModel:                "gpt-test",
		IntervalSeconds:          60,
		TimeoutSeconds:           15,
		Enabled:                  true,
		Visible:                  true,
		AvailabilityBoostPercent: 12.5,
	}
	require.NoError(t, CreateChannelMonitor(monitor))

	monitor.AvailabilityBoostPercent = 7.75
	require.NoError(t, UpdateChannelMonitor(monitor))

	updated, err := GetChannelMonitorByID(monitor.Id)
	require.NoError(t, err)
	assert.Equal(t, 7.75, updated.AvailabilityBoostPercent)
}

func TestRemoveLegacyChannelMonitorAvailabilityColumns(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&ChannelMonitor{}))
	legacy := &channelMonitorLegacyAvailability{}
	require.NoError(t, DB.Migrator().AddColumn(legacy, "ManualAvailability7d"))
	require.NoError(t, DB.Migrator().AddColumn(legacy, "ManualAvailability30d"))
	require.True(t, DB.Migrator().HasColumn(legacy, "manual_availability_7d"))
	require.True(t, DB.Migrator().HasColumn(legacy, "manual_availability_30d"))

	require.NoError(t, removeLegacyChannelMonitorAvailabilityColumns())

	assert.False(t, DB.Migrator().HasColumn(legacy, "manual_availability_7d"))
	assert.False(t, DB.Migrator().HasColumn(legacy, "manual_availability_30d"))
}

func TestClaimChannelMonitorUserTestEnforcesSharedCooldown(t *testing.T) {
	truncateTables(t)

	monitor := &ChannelMonitor{
		Name:            "User test cooldown",
		ApiURL:          "https://example.com/v1",
		ApiKeyEncrypted: "encrypted",
		TestModel:       "gpt-test",
		IntervalSeconds: 60,
		TimeoutSeconds:  15,
		Enabled:         true,
		Visible:         true,
	}
	require.NoError(t, CreateChannelMonitor(monitor))

	claimed, err := ClaimChannelMonitorUserTest(monitor.Id, 100, 125)
	require.NoError(t, err)
	assert.True(t, claimed)

	claimed, err = ClaimChannelMonitorUserTest(monitor.Id, 110, 135)
	require.NoError(t, err)
	assert.False(t, claimed)

	require.NoError(t, CompleteChannelMonitorUserTest(monitor.Id, 120))
	claimed, err = ClaimChannelMonitorUserTest(monitor.Id, 119, 144)
	require.NoError(t, err)
	assert.False(t, claimed)

	claimed, err = ClaimChannelMonitorUserTest(monitor.Id, 120, 145)
	require.NoError(t, err)
	assert.True(t, claimed)
}
