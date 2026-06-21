package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func testScheduledFlowPool() ChannelFlowPool {
	return ChannelFlowPool{
		Name:             "scheduled pool",
		Enabled:          true,
		Backend:          ChannelFlowBackendMemory,
		MaxInflight:      1,
		QueueTimeoutMs:   1000,
		QueuePolicy:      ChannelFlowQueuePolicyFIFO,
		OnLimit:          ChannelFlowOnLimitQueue,
		ScheduleTimezone: "Asia/Shanghai",
	}
}

func TestChannelFlowPoolScheduleAlwaysActive(t *testing.T) {
	pool := testScheduledFlowPool()
	pool.ScheduleMode = ChannelFlowScheduleAlways

	require.True(t, pool.IsScheduleActiveAt(time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)),
		"always schedule should be active")
}

func TestChannelFlowPoolScheduleDateTimeRange(t *testing.T) {
	pool := testScheduledFlowPool()
	pool.ScheduleMode = ChannelFlowScheduleDateTimeRange
	pool.EffectiveStartTime = time.Date(2026, 6, 15, 10, 0, 0, 0, time.UTC).Unix()
	pool.EffectiveEndTime = time.Date(2026, 6, 15, 11, 0, 0, 0, time.UTC).Unix()

	require.True(t, pool.IsScheduleActiveAt(time.Date(2026, 6, 15, 10, 30, 0, 0, time.UTC)),
		"range schedule should be active inside the window")
	require.False(t, pool.IsScheduleActiveAt(time.Date(2026, 6, 15, 11, 0, 0, 0, time.UTC)),
		"range schedule should be inactive at the exclusive end")
}

func TestChannelFlowPoolScheduleWeeklyCrossDay(t *testing.T) {
	pool := testScheduledFlowPool()
	pool.ScheduleMode = ChannelFlowScheduleWeekly
	pool.ScheduleWindows = `[{"weekdays":[1],"start_minute":1320,"end_minute":120}]`
	loc, err := time.LoadLocation("Asia/Shanghai")
	require.NoError(t, err, "should load timezone")

	require.True(t, pool.IsScheduleActiveAt(time.Date(2026, 6, 15, 23, 0, 0, 0, loc)),
		"weekly schedule should be active on the start day")
	require.True(t, pool.IsScheduleActiveAt(time.Date(2026, 6, 16, 1, 30, 0, 0, loc)),
		"weekly schedule should remain active after midnight")
	require.False(t, pool.IsScheduleActiveAt(time.Date(2026, 6, 16, 3, 0, 0, 0, loc)),
		"weekly schedule should be inactive after the cross-day end")
}

func TestChannelFlowPoolScheduleWeeklyValidation(t *testing.T) {
	pool := testScheduledFlowPool()
	pool.ScheduleMode = ChannelFlowScheduleWeekly
	pool.ScheduleWindows = `[{"weekdays":[7],"start_minute":60,"end_minute":120}]`

	require.Error(t, pool.Validate(), "invalid weekday should fail validation")
}
