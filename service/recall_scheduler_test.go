package service

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestRecallMaintenanceDelayUsesEarlierPacingWakeup(t *testing.T) {
	delay := recallMaintenanceDelay(30, 120_000, 100_000)

	require.Equal(t, 20*time.Second, delay)
}

func TestRecallMaintenanceDelayKeepsShorterGeneralTick(t *testing.T) {
	delay := recallMaintenanceDelay(5, 120_000, 100_000)

	require.Equal(t, 5*time.Second, delay)
}

func TestRecallMaintenanceDelayPacingDeadlineDueDoesNotWaitFullTick(t *testing.T) {
	delay := recallMaintenanceDelay(30, 100_000, 100_000)

	require.Less(t, delay, 30*time.Second)
}

func TestRecallMaintenanceDelayUsesPacingCheckedAtWhenLocalClockIsAhead(t *testing.T) {
	delay := recallMaintenanceDelayFromPacingStatus(30, model.RecallEmailPacingStatus{
		CheckedAtMillis:     100_000,
		NextAllowedAtMillis: 120_000,
		Allowed:             false,
	}, 130_000)

	require.Equal(t, 20*time.Second, delay)
}

func TestNotifyRecallSchedulerConfigChangedIsNonBlockingAndMerged(t *testing.T) {
	drainRecallSchedulerWake()

	NotifyRecallSchedulerConfigChanged()
	NotifyRecallSchedulerConfigChanged()

	requireSchedulerWakeAvailable(t)
	requireSchedulerWakeEmpty(t)
}

func TestRecallMaintenanceWaitCanBeInterruptedByWake(t *testing.T) {
	wake := make(chan struct{}, 1)
	done := make(chan bool, 1)
	go func() {
		done <- recallWaitForNextMaintenance(context.Background(), time.Hour, wake)
	}()

	wake <- struct{}{}

	select {
	case woke := <-done:
		require.True(t, woke)
	case <-time.After(100 * time.Millisecond):
		t.Fatal("scheduler wait was not interrupted by wake notification")
	}
}

func requireSchedulerWakeAvailable(t *testing.T) {
	t.Helper()
	select {
	case <-recallSchedulerWakeCh:
	default:
		t.Fatal("expected recall scheduler wake notification")
	}
}

func requireSchedulerWakeEmpty(t *testing.T) {
	t.Helper()
	select {
	case <-recallSchedulerWakeCh:
		t.Fatal("expected merged recall scheduler wake notifications")
	default:
	}
}
