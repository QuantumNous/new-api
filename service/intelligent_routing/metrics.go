package intelligent_routing

import (
	"sync"
	"time"
)

type Observation struct {
	NoRoute          bool
	CandidateTier    int
	ExpectedSaving   float64
	PlanningDuration time.Duration
}

type MetricsSnapshot struct {
	Planned                 int64
	NoRoute                 int64
	ByTier                  map[int]int64
	AverageExpectedSaving   float64
	AveragePlanningDuration time.Duration
}

type Metrics struct {
	mu            sync.Mutex
	planned       int64
	noRoute       int64
	byTier        map[int]int64
	totalSaving   float64
	totalDuration time.Duration
}

var DefaultMetrics Metrics

func (metrics *Metrics) Observe(observation Observation) {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	metrics.planned++
	if observation.NoRoute {
		metrics.noRoute++
	} else {
		if metrics.byTier == nil {
			metrics.byTier = make(map[int]int64)
		}
		metrics.byTier[observation.CandidateTier]++
	}
	metrics.totalSaving += observation.ExpectedSaving
	metrics.totalDuration += observation.PlanningDuration
}

func (metrics *Metrics) Snapshot() MetricsSnapshot {
	metrics.mu.Lock()
	defer metrics.mu.Unlock()
	snapshot := MetricsSnapshot{Planned: metrics.planned, NoRoute: metrics.noRoute, ByTier: make(map[int]int64, len(metrics.byTier))}
	for tier, count := range metrics.byTier {
		snapshot.ByTier[tier] = count
	}
	if metrics.planned > 0 {
		snapshot.AverageExpectedSaving = metrics.totalSaving / float64(metrics.planned)
		snapshot.AveragePlanningDuration = metrics.totalDuration / time.Duration(metrics.planned)
	}
	return snapshot
}
