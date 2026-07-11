package modelroute

import (
	"sync"
	"time"
)

// lastShadowCaptures keeps recent production captures for async shadow executors (process-local).
// Keyed by requested_model; also by request id when present.
type shadowCaptureStore struct {
	mu   sync.RWMutex
	byID map[string]*ProductionShadowCapture
	byModel map[string]*ProductionShadowCapture
}

var globalShadowCaptures = &shadowCaptureStore{
	byID:    make(map[string]*ProductionShadowCapture),
	byModel: make(map[string]*ProductionShadowCapture),
}

// RememberShadowCapture stores a production capture for subsequent probe execution.
func RememberShadowCapture(c *ProductionShadowCapture) {
	if c == nil {
		return
	}
	globalShadowCaptures.mu.Lock()
	defer globalShadowCaptures.mu.Unlock()
	if c.RequestID != "" {
		globalShadowCaptures.byID[c.RequestID] = c
	}
	if c.OriginModel != "" {
		globalShadowCaptures.byModel[c.OriginModel] = c
	}
	// opportunistic prune of stale request-id keys (keep map bounded)
	if len(globalShadowCaptures.byID) > 256 {
		// drop arbitrary half by recreating — captures are short-lived
		globalShadowCaptures.byID = map[string]*ProductionShadowCapture{}
		if c.RequestID != "" {
			globalShadowCaptures.byID[c.RequestID] = c
		}
	}
}

// LookupShadowCapture finds the best capture for a probe.
func LookupShadowCapture(productionRequestID, requestedModel string) *ProductionShadowCapture {
	globalShadowCaptures.mu.RLock()
	defer globalShadowCaptures.mu.RUnlock()
	if productionRequestID != "" {
		if c := globalShadowCaptures.byID[productionRequestID]; c != nil {
			return c
		}
	}
	if requestedModel != "" {
		return globalShadowCaptures.byModel[requestedModel]
	}
	return nil
}

// ClearShadowCaptures is for tests.
func ClearShadowCaptures() {
	globalShadowCaptures.mu.Lock()
	defer globalShadowCaptures.mu.Unlock()
	globalShadowCaptures.byID = make(map[string]*ProductionShadowCapture)
	globalShadowCaptures.byModel = make(map[string]*ProductionShadowCapture)
}

// ShadowCaptureAge is a helper for tests / diagnostics.
func ShadowCaptureAge(_ *ProductionShadowCapture) time.Duration { return 0 }
