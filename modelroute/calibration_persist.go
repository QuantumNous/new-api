package modelroute

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// CalibrationPersister snapshots runtime metrics to DB (PRD §17).
type CalibrationPersister struct {
	mu       sync.Mutex
	lastSnap time.Time
	// dirty marks keys needing snapshot
	dirty map[string]struct{}
	stop  chan struct{}
	wg    sync.WaitGroup
}

// GlobalCalibrationPersister is process-local snapshot coordinator.
var GlobalCalibrationPersister = &CalibrationPersister{
	dirty: make(map[string]struct{}),
	stop:  make(chan struct{}),
}

// MarkDirty queues a metrics key for next snapshot.
func (p *CalibrationPersister) MarkDirty(mk model.MetricsKey) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.dirty == nil {
		p.dirty = make(map[string]struct{})
	}
	p.dirty[mk.String()] = struct{}{}
}

// SnapshotNow flushes all dirty (or all runtime) metrics to DB (PRD §17 critical / exit).
func (p *CalibrationPersister) SnapshotNow() (int, error) {
	if p == nil {
		return 0, nil
	}
	p.mu.Lock()
	keys := make([]string, 0, len(p.dirty))
	for k := range p.dirty {
		keys = append(keys, k)
	}
	p.dirty = make(map[string]struct{})
	p.lastSnap = now()
	p.mu.Unlock()

	// also include all runtime entries if dirty empty but force full — flush runtime map
	var rows []model.ChannelModelMetrics
	GlobalMetricsRuntime.mu.RLock()
	if len(keys) == 0 {
		for _, m := range GlobalMetricsRuntime.data {
			if m != nil {
				rows = append(rows, *m)
			}
		}
	} else {
		for _, k := range keys {
			if m, ok := GlobalMetricsRuntime.data[k]; ok && m != nil {
				rows = append(rows, *m)
			}
		}
	}
	GlobalMetricsRuntime.mu.RUnlock()

	if len(rows) == 0 {
		return 0, nil
	}
	if err := model.UpsertChannelModelMetricsBatch(rows); err != nil {
		return 0, err
	}
	return len(rows), nil
}

// SnapshotCritical immediately persists one metrics row after critical state change (PRD §17).
func (p *CalibrationPersister) SnapshotCritical(m *model.ChannelModelMetrics) error {
	if m == nil {
		return nil
	}
	if err := model.UpsertChannelModelMetrics(m); err != nil {
		return err
	}
	p.mu.Lock()
	delete(p.dirty, m.MetricsKey().String())
	p.mu.Unlock()
	return nil
}

// StartPeriodicSnapshot runs 30–60s interval snapshots (PRD §17 / §33 default 60s).
func (p *CalibrationPersister) StartPeriodicSnapshot(interval time.Duration) {
	if p == nil {
		return
	}
	if interval <= 0 {
		interval = time.Duration(model.DefaultCalibrationSnapshotIntervalSec) * time.Second
	}
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-p.stop:
				return
			case <-t.C:
				_, _ = p.SnapshotNow()
			}
		}
	}()
}

// StopPeriodicSnapshot stops the background loop.
func (p *CalibrationPersister) StopPeriodicSnapshot() {
	if p == nil {
		return
	}
	select {
	case <-p.stop:
	default:
		close(p.stop)
	}
	p.wg.Wait()
	p.stop = make(chan struct{})
}
