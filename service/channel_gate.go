package service

import "sync"

// concurrencyGates holds buffered channels used as counting semaphores, keyed by
// gateKey ("channel:<id>" or "channel:<id>:key:<idx>"). In-memory per-process by
// design: the concurrency path must not pay a Redis RTT. Multi-node deployments
// get MaxConcurrency per node (documented in the spec).
var concurrencyGates sync.Map // map[string]chan struct{}

// GetConcurrencyStatus returns the current occupancy and capacity of a tracked
// gate. Unknown and unlimited gates are not tracked and report (0, 0).
func GetConcurrencyStatus(gateKey string) (used int, max int) {
	v, ok := concurrencyGates.Load(gateKey)
	if !ok {
		return 0, 0
	}
	gate := v.(chan struct{})
	return len(gate), cap(gate)
}

// TryAcquireConcurrency acquires one slot non-blockingly. max<=0 means unlimited
// and always succeeds without tracking. Returns false if the gate is full.
func TryAcquireConcurrency(gateKey string, max int) bool {
	if max <= 0 {
		return true
	}
	v, _ := concurrencyGates.LoadOrStore(gateKey, make(chan struct{}, max))
	gate := v.(chan struct{})
	select {
	case gate <- struct{}{}:
		return true
	default:
		return false
	}
}

// ReleaseConcurrency releases one slot. Safe to call when max<=0 was used (no-op).
func ReleaseConcurrency(gateKey string) {
	v, ok := concurrencyGates.Load(gateKey)
	if !ok {
		return
	}
	gate := v.(chan struct{})
	select {
	case <-gate:
	default:
		// already empty; ignore to avoid blocking on over-release
	}
}
