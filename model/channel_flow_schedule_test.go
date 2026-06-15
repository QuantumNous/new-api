package model

import (
	"testing"
	"time"
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

	if !pool.IsScheduleActiveAt(time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)) {
		t.Fatal("always schedule should be active")
	}
}

func TestChannelFlowPoolScheduleDateTimeRange(t *testing.T) {
	pool := testScheduledFlowPool()
	pool.ScheduleMode = ChannelFlowScheduleDateTimeRange
	pool.EffectiveStartTime = time.Date(2026, 6, 15, 10, 0, 0, 0, time.UTC).Unix()
	pool.EffectiveEndTime = time.Date(2026, 6, 15, 11, 0, 0, 0, time.UTC).Unix()

	if !pool.IsScheduleActiveAt(time.Date(2026, 6, 15, 10, 30, 0, 0, time.UTC)) {
		t.Fatal("range schedule should be active inside the window")
	}
	if pool.IsScheduleActiveAt(time.Date(2026, 6, 15, 11, 0, 0, 0, time.UTC)) {
		t.Fatal("range schedule should be inactive at the exclusive end")
	}
}

func TestChannelFlowPoolScheduleWeeklyCrossDay(t *testing.T) {
	pool := testScheduledFlowPool()
	pool.ScheduleMode = ChannelFlowScheduleWeekly
	pool.ScheduleWindows = `[{"weekdays":[1],"start_minute":1320,"end_minute":120}]`
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Fatal(err)
	}

	if !pool.IsScheduleActiveAt(time.Date(2026, 6, 15, 23, 0, 0, 0, loc)) {
		t.Fatal("weekly schedule should be active on the start day")
	}
	if !pool.IsScheduleActiveAt(time.Date(2026, 6, 16, 1, 30, 0, 0, loc)) {
		t.Fatal("weekly schedule should remain active after midnight")
	}
	if pool.IsScheduleActiveAt(time.Date(2026, 6, 16, 3, 0, 0, 0, loc)) {
		t.Fatal("weekly schedule should be inactive after the cross-day end")
	}
}

func TestChannelFlowPoolScheduleWeeklyValidation(t *testing.T) {
	pool := testScheduledFlowPool()
	pool.ScheduleMode = ChannelFlowScheduleWeekly
	pool.ScheduleWindows = `[{"weekdays":[7],"start_minute":60,"end_minute":120}]`

	if err := pool.Validate(); err == nil {
		t.Fatal("invalid weekday should fail validation")
	}
}
