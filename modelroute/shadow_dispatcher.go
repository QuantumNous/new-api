package modelroute

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// ShadowExecutor runs a shadow request against upstream. Production injects relay-based impl.
// Must not bill, log to user-facing logs, or write response to client (PRD §12).
type ShadowExecutor func(ctx context.Context, req *ShadowRequest) ShadowResult

// ShadowResult is the executor outcome used for metrics (PRD §12 / §14).
type ShadowResult struct {
	BuildResult   ShadowBuildResult
	TransportOK   bool
	StatusCode    int
	TTFT          time.Duration
	TotalLatency  time.Duration
	SourceRequest string // id of production request that spawned this probe
}

// ShadowTransportTracker tracks consecutive transport failures across distinct production requests (PRD §14).
// OPEN on standby only after ≥3 transport fails from ≥2 different real requests.
type ShadowTransportTracker struct {
	mu       sync.Mutex
	// key → ordered unique production request ids that failed transport
	fails map[string][]string
}

// GlobalShadowTransport tracks shadow transport failures process-locally.
var GlobalShadowTransport = &ShadowTransportTracker{fails: make(map[string][]string)}

func (t *ShadowTransportTracker) Clear() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.fails = make(map[string][]string)
}

func (t *ShadowTransportTracker) Record(metricsKey string, productionRequestID string) (consecutive int, distinctReqs int) {
	t.mu.Lock()
	defer t.mu.Unlock()
	list := t.fails[metricsKey]
	// append if new request id or same continuing streak
	if productionRequestID != "" {
		if len(list) == 0 || list[len(list)-1] != productionRequestID {
			list = append(list, productionRequestID)
		} else {
			// same request counts as another consecutive fail but not new distinct
			list = append(list, productionRequestID)
		}
	} else {
		list = append(list, "")
	}
	// keep last 16
	if len(list) > 16 {
		list = list[len(list)-16:]
	}
	t.fails[metricsKey] = list
	// consecutive from end
	consecutive = 0
	for i := len(list) - 1; i >= 0; i-- {
		consecutive++
	}
	// count distinct
	seen := map[string]struct{}{}
	for _, id := range list {
		seen[id] = struct{}{}
	}
	return consecutive, len(seen)
}

func (t *ShadowTransportTracker) Reset(metricsKey string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.fails, metricsKey)
}

// AllowsOpenOnShadowTransport implements PRD §14 threshold.
func AllowsOpenOnShadowTransport(consecutive, distinctReqs int) bool {
	return consecutive >= 3 && distinctReqs >= 2
}

// ShadowDispatcher schedules async probes without blocking production (PRD §12 / §15).
type ShadowDispatcher struct {
	Executor ShadowExecutor
	Builder  ShadowRequestBuilder

	// per-route concurrency: max 1 (PRD §33)
	inFlight sync.Map // metrics key → struct{}
	// total in-flight for observability
	active atomic.Int64
}

// GlobalShadowDispatcher is the process singleton; Executor must be set by wiring layer.
var GlobalShadowDispatcher = &ShadowDispatcher{
	Builder: TextShadowBuilder{},
}

// MaybeDispatchShadowProbeAsync picks at most one due PROBING/stale standby and runs async (PRD §12 / §15).
// Never blocks caller; never returns to user.
func (d *ShadowDispatcher) MaybeDispatchShadowProbeAsync(
	prod *ProductionRequestView,
	requestedModel string,
	productionRequestID string,
	excludePrimary model.MetricsKey,
) {
	if d == nil || d.Executor == nil || prod == nil {
		return
	}
	item, ok := GlobalProbeQueue.PopDue(now())
	if !ok {
		return
	}
	if item.MetricsKey.String() == excludePrimary.String() {
		// requeue later
		item.NextProbeAt = now().Add(time.Second)
		GlobalProbeQueue.Upsert(item)
		return
	}
	key := item.MetricsKey.String()
	if _, loaded := d.inFlight.LoadOrStore(key, struct{}{}); loaded {
		// already probing this route
		GlobalProbeQueue.Upsert(item)
		return
	}

	d.active.Add(1)
	go func() {
		defer func() {
			d.inFlight.Delete(key)
			d.active.Add(-1)
		}()
		timeout := time.Duration(model.DefaultShadowProbeTimeoutSec) * time.Second
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		builder := d.Builder
		if builder == nil {
			builder = SelectShadowBuilder(prod)
		}
		req, buildRes := builder.BuildShadowRequest(prod, item.MetricsKey.ChannelID, requestedModel, item.MetricsKey.EffectiveModel)
		if buildRes != ShadowBuildOK || req == nil {
			// weight 0 — do not OPEN
			return
		}
		res := d.Executor(ctx, req)
		res.BuildResult = buildRes
		res.SourceRequest = productionRequestID
		d.applyShadowResult(item, res)
	}()
}

func (d *ShadowDispatcher) applyShadowResult(item model.ProbeQueueItem, res ShadowResult) {
	m := GlobalMetricsRuntime.Get(item.MetricsKey)
	if m == nil {
		var err error
		m, err = model.GetChannelModelMetrics(item.MetricsKey.ChannelID, item.MetricsKey.EffectiveModel)
		if err != nil || m == nil {
			return
		}
	}
	ts := now().Unix()
	m.LastProbeAt = &ts
	m.ShadowSampleCount++

	if res.TransportOK {
		GlobalShadowTransport.Reset(item.MetricsKey.String())
		if res.TTFT > 0 {
			ms := float64(res.TTFT.Milliseconds())
			m.ShadowTTFTEMAMs = emaUpdate(m.ShadowTTFTEMAMs, ms, model.DefaultTTFTEMAAlpha)
		}
		ApplyTransition(m, EventProbeSuccess, 0)
		// re-enqueue recovering for further probes handled by state machine callers
		return
	}

	if res.BuildResult == ShadowTransportFailure || !res.TransportOK {
		consec, distinct := GlobalShadowTransport.Record(item.MetricsKey.String(), res.SourceRequest)
		weight := ShadowFailureWeight(ShadowTransportFailure)
		if weight > 0 {
			// only OPEN standby when threshold met
			if AllowsOpenOnShadowTransport(consec, distinct) {
				m.SetLastErrorClass(model.ErrorTemporary)
				ApplyTransition(m, EventTripOpen, 0)
			} else if m.State() == model.RouteProbing {
				// stay probing; schedule next
				item.NextProbeAt = now().Add(time.Duration(model.DefaultOpenBackoffSeconds[minInt(m.BackoffLevel, len(model.DefaultOpenBackoffSeconds)-1)]) * time.Second)
				item.LastProbeAt = now()
				GlobalProbeQueue.Upsert(item)
			}
		}
	}
	GlobalMetricsRuntime.Put(m)
}

func emaUpdate(prev *float64, sample, alpha float64) *float64 {
	p := 0.0
	if prev != nil {
		p = *prev
	} else {
		v := sample
		return &v
	}
	v := alpha*sample + (1-alpha)*p
	return &v
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ActiveShadowProbes returns in-flight shadow count.
func (d *ShadowDispatcher) ActiveShadowProbes() int64 {
	if d == nil {
		return 0
	}
	return d.active.Load()
}
