package intelligent_routing

import (
	"sync"
	"time"
)

const (
	HealthHealthy = iota
	HealthDegraded
	HealthProbation
	HealthOpen
)

type HealthSnapshot struct {
	Tier        int
	FailureRate float64
}

type healthEvent struct {
	at      time.Time
	success bool
}

type HealthTracker struct {
	mu     sync.Mutex
	events map[int][]healthEvent
}

var DefaultHealthTracker HealthTracker

func (tracker *HealthTracker) RecordAt(channelID int, success bool, now time.Time) {
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	if tracker.events == nil {
		tracker.events = make(map[int][]healthEvent)
	}
	tracker.events[channelID] = append(recentHealthEvents(tracker.events[channelID], now), healthEvent{at: now, success: success})
}

func (tracker *HealthTracker) Record(channelID int, success bool) {
	tracker.RecordAt(channelID, success, time.Now())
}

func (tracker *HealthTracker) SnapshotAt(channelID int, now time.Time) HealthSnapshot {
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	events := recentHealthEvents(tracker.events[channelID], now)
	if tracker.events != nil {
		tracker.events[channelID] = events
	}
	if len(events) < 20 {
		return HealthSnapshot{Tier: HealthProbation}
	}
	failures := 0
	for _, event := range events {
		if !event.success {
			failures++
		}
	}
	failureRate := float64(failures) / float64(len(events))
	tier := HealthHealthy
	if failureRate >= .05 {
		tier = HealthDegraded
	}
	if failureRate > .05 {
		tier = HealthOpen
	}
	return HealthSnapshot{Tier: tier, FailureRate: failureRate}
}

func (tracker *HealthTracker) Snapshot(channelID int) HealthSnapshot {
	return tracker.SnapshotAt(channelID, time.Now())
}

func recentHealthEvents(events []healthEvent, now time.Time) []healthEvent {
	cutoff := now.Add(-time.Minute)
	first := 0
	for first < len(events) && events[first].at.Before(cutoff) {
		first++
	}
	return events[first:]
}
