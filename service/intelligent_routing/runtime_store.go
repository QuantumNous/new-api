package intelligent_routing

import "sync/atomic"

type HealthStore interface {
	Record(channelID int, success bool)
	Snapshot(channelID int) HealthSnapshot
}

type QualityStore interface {
	Record(model string, task TaskType, success bool)
	Predict(model string, task TaskType, prior float64) float64
}

type StickyStore interface {
	Record(key string, task TaskType, route StickyRoute)
	Get(key string, task TaskType) (StickyRoute, bool)
	RecordValidationFailure(key string)
}

type SharedRuntime struct {
	configured atomic.Bool
	healthy    atomic.Bool
}

var DefaultSharedRuntime SharedRuntime

func (runtime *SharedRuntime) Configure(configured bool) {
	runtime.configured.Store(configured)
	if !configured {
		runtime.healthy.Store(false)
	}
}

func (runtime *SharedRuntime) SetHealthy(healthy bool) {
	runtime.healthy.Store(healthy)
}

func (runtime *SharedRuntime) Ready() bool {
	return runtime.configured.Load() && runtime.healthy.Load()
}
