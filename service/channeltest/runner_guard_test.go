package channeltest

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestRunGuardQueuesPendingTask(t *testing.T) {
	guard := newRunGuard()

	firstStarted := make(chan struct{}, 1)
	releaseFirst := make(chan struct{})
	secondRan := make(chan struct{}, 1)

	err := guard.submit(TaskKindAllChannels, func() {
		firstStarted <- struct{}{}
		<-releaseFirst
	}, true)
	if err != nil {
		t.Fatalf("first submit failed: %v", err)
	}

	select {
	case <-firstStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("first task did not start")
	}

	err = guard.submit(TaskKindAutoDisabledChannel, func() {
		secondRan <- struct{}{}
	}, true)
	if !errors.Is(err, ErrTaskRunning) {
		t.Fatalf("expected ErrTaskRunning, got: %v", err)
	}

	close(releaseFirst)

	select {
	case <-secondRan:
	case <-time.After(2 * time.Second):
		t.Fatal("pending task did not run")
	}
}

func TestRunGuardCoalescesSameKindPendingTask(t *testing.T) {
	guard := newRunGuard()

	releaseFirst := make(chan struct{})
	var pendingRuns atomic.Int32

	err := guard.submit(TaskKindAllChannels, func() {
		<-releaseFirst
	}, true)
	if err != nil {
		t.Fatalf("first submit failed: %v", err)
	}

	err = guard.submit(TaskKindAutoDisabledChannel, func() {
		pendingRuns.Add(1)
	}, true)
	if !errors.Is(err, ErrTaskRunning) {
		t.Fatalf("expected ErrTaskRunning, got: %v", err)
	}

	err = guard.submit(TaskKindAutoDisabledChannel, func() {
		pendingRuns.Add(1)
	}, true)
	if !errors.Is(err, ErrTaskRunning) {
		t.Fatalf("expected ErrTaskRunning, got: %v", err)
	}

	close(releaseFirst)
	time.Sleep(300 * time.Millisecond)

	if got := pendingRuns.Load(); got != 1 {
		t.Fatalf("expected exactly one pending run, got %d", got)
	}
}

func TestRunGuardNoQueueOnBusy(t *testing.T) {
	guard := newRunGuard()

	releaseFirst := make(chan struct{})
	ran := make(chan struct{}, 1)

	err := guard.submit(TaskKindAllChannels, func() {
		<-releaseFirst
	}, false)
	if err != nil {
		t.Fatalf("first submit failed: %v", err)
	}

	err = guard.submit(TaskKindAutoDisabledChannel, func() {
		ran <- struct{}{}
	}, false)
	if !errors.Is(err, ErrTaskRunning) {
		t.Fatalf("expected ErrTaskRunning, got: %v", err)
	}

	close(releaseFirst)
	select {
	case <-ran:
		t.Fatal("second task should not be queued")
	case <-time.After(500 * time.Millisecond):
	}
}
