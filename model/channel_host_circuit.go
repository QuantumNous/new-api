package model

import (
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	channelHostFailureWindow            = time.Minute
	channelHostFailureThreshold         = 3
	channelHostDistinctChannelThreshold = 2
	channelHostCooldownDuration         = 2 * time.Minute
	channelHostCircuitIdleTTL           = 15 * time.Minute
	channelHostCircuitMaxEntries        = 10_000
)

type channelHostCircuitKey struct {
	host  string
	model string
	path  string
}

type channelHostFailure struct {
	at        time.Time
	channelID int
}

type channelHostCircuitEntry struct {
	failures  []channelHostFailure
	reason    string
	openUntil time.Time
	lastSeen  time.Time
}

type channelHostCircuitRegistry struct {
	sync.Mutex
	items map[channelHostCircuitKey]*channelHostCircuitEntry
	now   func() time.Time
}

func newChannelHostCircuitRegistry(now func() time.Time) *channelHostCircuitRegistry {
	return &channelHostCircuitRegistry{
		items: make(map[channelHostCircuitKey]*channelHostCircuitEntry),
		now:   now,
	}
}

var channelHostCircuits = newChannelHostCircuitRegistry(time.Now)

func newChannelHostCircuitKey(host, modelName, path string) (channelHostCircuitKey, bool) {
	host = NormalizeChannelBaseURLHost(host)
	modelName = strings.TrimSpace(modelName)
	path = strings.TrimSpace(path)
	if host == "" || modelName == "" || path == "" {
		return channelHostCircuitKey{}, false
	}
	return channelHostCircuitKey{host: host, model: modelName, path: path}, true
}

func (r *channelHostCircuitRegistry) prune(now time.Time) {
	idleCutoff := now.Add(-channelHostCircuitIdleTTL)
	for key, entry := range r.items {
		if entry.lastSeen.Before(idleCutoff) {
			delete(r.items, key)
			continue
		}
		if !entry.openUntil.IsZero() && !now.Before(entry.openUntil) {
			entry.openUntil = time.Time{}
			entry.reason = ""
			entry.failures = nil
		}
	}
}

func (r *channelHostCircuitRegistry) recordFailure(key channelHostCircuitKey, channelID int, reason string) bool {
	if channelID <= 0 {
		return false
	}

	r.Lock()
	defer r.Unlock()

	now := r.now()
	entry := r.items[key]
	if entry == nil {
		if len(r.items) >= channelHostCircuitMaxEntries {
			r.prune(now)
			if len(r.items) >= channelHostCircuitMaxEntries {
				return false
			}
		}
		entry = &channelHostCircuitEntry{}
		r.items[key] = entry
	}
	entry.lastSeen = now
	if now.Before(entry.openUntil) {
		return false
	}

	cutoff := now.Add(-channelHostFailureWindow)
	failures := entry.failures[:0]
	for _, failure := range entry.failures {
		if failure.at.After(cutoff) {
			failures = append(failures, failure)
		}
	}
	failures = append(failures, channelHostFailure{at: now, channelID: channelID})
	entry.failures = failures
	if len(failures) < channelHostFailureThreshold {
		return false
	}

	distinctChannels := make(map[int]struct{}, channelHostDistinctChannelThreshold)
	for _, failure := range failures {
		distinctChannels[failure.channelID] = struct{}{}
	}
	if len(distinctChannels) < channelHostDistinctChannelThreshold {
		return false
	}

	entry.reason = reason
	entry.openUntil = now.Add(channelHostCooldownDuration)
	entry.failures = nil
	return true
}

func (r *channelHostCircuitRegistry) isOpen(key channelHostCircuitKey) bool {
	r.Lock()
	defer r.Unlock()

	now := r.now()
	entry := r.items[key]
	if entry == nil {
		return false
	}
	entry.lastSeen = now
	if now.Before(entry.openUntil) {
		return true
	}
	entry.openUntil = time.Time{}
	entry.reason = ""
	entry.failures = nil
	return false
}

// RecordChannelHostFailure records a transient failure shared by an upstream
// host. It opens only after repeated evidence from multiple channel IDs.
func RecordChannelHostFailure(host, modelName, path string, channelID int, reason string) bool {
	key, ok := newChannelHostCircuitKey(host, modelName, path)
	if !ok {
		return false
	}
	return channelHostCircuits.recordFailure(key, channelID, reason)
}

func IsChannelHostCoolingDown(host, modelName, path string) bool {
	key, ok := newChannelHostCircuitKey(host, modelName, path)
	if !ok {
		return false
	}
	return channelHostCircuits.isOpen(key)
}

func shouldEnforceChannelHostCircuit(host, modelName, path string) bool {
	return common.UpstreamHostCircuitMode == common.UpstreamHostCircuitModeEnforce &&
		IsChannelHostCoolingDown(host, modelName, path)
}

func ClearChannelHostCooldownsForTest() {
	channelHostCircuits.Lock()
	defer channelHostCircuits.Unlock()
	channelHostCircuits.items = make(map[channelHostCircuitKey]*channelHostCircuitEntry)
}
