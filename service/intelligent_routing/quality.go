package intelligent_routing

import "sync"

type qualityKey struct {
	model string
	task  TaskType
}

type qualityCounts struct {
	successes int
	samples   int
}

type QualityTracker struct {
	mu     sync.RWMutex
	counts map[qualityKey]qualityCounts
}

var DefaultQualityTracker QualityTracker

func (tracker *QualityTracker) Record(model string, task TaskType, success bool) {
	if model == "" || task == "" {
		return
	}
	tracker.mu.Lock()
	defer tracker.mu.Unlock()
	if tracker.counts == nil {
		tracker.counts = make(map[qualityKey]qualityCounts)
	}
	key := qualityKey{model: model, task: task}
	counts := tracker.counts[key]
	counts.samples++
	if success {
		counts.successes++
	}
	tracker.counts[key] = counts
}

func (tracker *QualityTracker) Predict(model string, task TaskType, prior float64) float64 {
	tracker.mu.RLock()
	counts := tracker.counts[qualityKey{model: model, task: task}]
	tracker.mu.RUnlock()
	if counts.samples < 30 {
		return prior
	}
	return float64(counts.successes+8) / float64(counts.samples+10)
}
